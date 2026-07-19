const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // In production, replace with specific frontend URL
    methods: ['GET', 'POST'],
  },
});

const prisma = new PrismaClient();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

// Serve frontend static assets from public folder
app.use(express.static(path.join(__dirname, 'public')));

// API: Get all inventory items
app.get('/api/inventory', async (req, res) => {
  try {
    const inventory = await prisma.inventoryItem.findMany({
      orderBy: { name: 'asc' },
    });
    res.json(inventory);
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

// API: Get transaction history (limit to last 50)
app.get('/api/transactions', async (req, res) => {
  try {
    const transactions = await prisma.stockTransaction.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: {
        item: {
          select: {
            name: true,
            category: true,
            grade: true,
            sectionSize: true,
          },
        },
      },
    });
    res.json(transactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// API: Add stock (Inward)
app.post('/api/stock/inward', async (req, res) => {
  const {
    itemId,
    tons,
    pieces,
    gatePassNumber,
    partyName,
    vehicleNumber,
    driverName,
    operatorName,
  } = req.body;

  if (!itemId || !tons || !pieces || !operatorName) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const parsedTons = parseFloat(tons);
  const parsedPieces = parseInt(pieces);

  if (isNaN(parsedTons) || parsedTons <= 0 || isNaN(parsedPieces) || parsedPieces <= 0) {
    return res.status(400).json({ error: 'Invalid tons or pieces quantity' });
  }

  try {
    // Perform updates in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update Inventory Item
      const updatedItem = await tx.inventoryItem.update({
        where: { id: itemId },
        data: {
          totalTons: { increment: parsedTons },
          totalPieces: { increment: parsedPieces },
        },
      });

      // 2. Create Stock Transaction
      const transaction = await tx.stockTransaction.create({
        data: {
          itemId,
          type: 'INWARD',
          tons: parsedTons,
          pieces: parsedPieces,
          gatePassNumber,
          partyName: partyName || 'Local Supplier',
          vehicleNumber,
          driverName,
          operatorName,
        },
        include: {
          item: {
            select: {
              name: true,
              category: true,
              grade: true,
              sectionSize: true,
            },
          },
        },
      });

      return { updatedItem, transaction };
    });

    // Broadcast update to all clients
    io.emit('stock_update', {
      type: 'INWARD',
      updatedItem: result.updatedItem,
      transaction: result.transaction,
    });

    res.status(201).json(result);
  } catch (error) {
    console.error('Error logging inward stock:', error);
    res.status(500).json({ error: 'Failed to process inward transaction' });
  }
});

// API: Remove stock (Outward/Dispatch)
app.post('/api/stock/outward', async (req, res) => {
  const {
    itemId,
    tons,
    pieces,
    invoiceNumber,
    gatePassNumber,
    partyName,
    vehicleNumber,
    driverName,
    operatorName,
  } = req.body;

  if (!itemId || !tons || !pieces || !operatorName) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const parsedTons = parseFloat(tons);
  const parsedPieces = parseInt(pieces);

  if (isNaN(parsedTons) || parsedTons <= 0 || isNaN(parsedPieces) || parsedPieces <= 0) {
    return res.status(400).json({ error: 'Invalid tons or pieces quantity' });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch item to verify stock levels
      const item = await tx.inventoryItem.findUnique({
        where: { id: itemId },
      });

      if (!item) {
        throw new Error('ITEM_NOT_FOUND');
      }

      // Round to 3 decimal places to avoid float errors
      const currentTons = Math.round(item.totalTons * 1000) / 1000;
      const currentPieces = item.totalPieces;

      if (currentTons < parsedTons || currentPieces < parsedPieces) {
        throw new Error('INSUFFICIENT_STOCK');
      }

      // 2. Update Inventory Item
      const updatedItem = await tx.inventoryItem.update({
        where: { id: itemId },
        data: {
          totalTons: { decrement: parsedTons },
          totalPieces: { decrement: parsedPieces },
        },
      });

      // 3. Create Stock Transaction
      const transaction = await tx.stockTransaction.create({
        data: {
          itemId,
          type: 'OUTWARD',
          tons: parsedTons,
          pieces: parsedPieces,
          invoiceNumber,
          gatePassNumber,
          partyName: partyName || 'Local Customer',
          vehicleNumber,
          driverName,
          operatorName,
        },
        include: {
          item: {
            select: {
              name: true,
              category: true,
              grade: true,
              sectionSize: true,
            },
          },
        },
      });

      return { updatedItem, transaction };
    });

    // Broadcast update to all clients
    io.emit('stock_update', {
      type: 'OUTWARD',
      updatedItem: result.updatedItem,
      transaction: result.transaction,
    });

    res.status(201).json(result);
  } catch (error) {
    console.error('Error logging outward stock:', error);
    if (error.message === 'ITEM_NOT_FOUND') {
      return res.status(404).json({ error: 'Item not found in inventory' });
    }
    if (error.message === 'INSUFFICIENT_STOCK') {
      return res.status(400).json({ error: 'Insufficient stock: Dispatch quantity exceeds current stock level' });
    }
    res.status(500).json({ error: 'Failed to process outward transaction' });
  }
});

// Websocket Events
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// Catch-all route to serve the Next.js index.html (supports client routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
server.listen(PORT, () => {
  console.log(`Express Backend Server is running on port ${PORT}`);
});
