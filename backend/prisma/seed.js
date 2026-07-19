const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Clean database
  await prisma.stockTransaction.deleteMany({});
  await prisma.inventoryItem.deleteMany({});

  const initialItems = [
    {
      name: "TMT Rebar 8mm Fe 550D",
      category: "Rebars",
      grade: "Fe 550D",
      sectionSize: "8mm",
      totalTons: 45.8,
      totalPieces: 9660,
      unitWeight: 0.00474, // ~4.74 kg per 12m bar
      minStockLimit: 15.0,
      location: "Yard A - Bay 1",
    },
    {
      name: "TMT Rebar 12mm Fe 550D",
      category: "Rebars",
      grade: "Fe 550D",
      sectionSize: "12mm",
      totalTons: 85.2,
      totalPieces: 8000,
      unitWeight: 0.01065, // ~10.65 kg per 12m bar
      minStockLimit: 20.0,
      location: "Yard A - Bay 2",
    },
    {
      name: "TMT Rebar 16mm Fe 550D",
      category: "Rebars",
      grade: "Fe 550D",
      sectionSize: "16mm",
      totalTons: 113.76,
      totalPieces: 6000,
      unitWeight: 0.01896, // ~18.96 kg per 12m bar
      minStockLimit: 25.0,
      location: "Yard A - Bay 3",
    },
    {
      name: "MS Angle 50x50x6mm",
      category: "Angles",
      grade: "IS 2062",
      sectionSize: "50x50x6mm",
      totalTons: 28.5,
      totalPieces: 1050,
      unitWeight: 0.02714, // ~27.14 kg per 6m angle
      minStockLimit: 10.0,
      location: "Yard B - Bay 1",
    },
    {
      name: "MS Channel 100x50mm",
      category: "Channels",
      grade: "IS 2062",
      sectionSize: "100x50mm",
      totalTons: 54.72,
      totalPieces: 950,
      unitWeight: 0.0576, // ~57.6 kg per 6m channel
      minStockLimit: 15.0,
      location: "Yard B - Bay 3",
    },
    {
      name: "MS Channel 150x75mm",
      category: "Channels",
      grade: "IS 2062",
      sectionSize: "150x75mm",
      totalTons: 10.08,
      totalPieces: 100,
      unitWeight: 0.1008, // ~100.8 kg per 6m channel
      minStockLimit: 15.0, // This is below safety limit to trigger warning
      location: "Yard B - Bay 4",
    },
    {
      name: "HR Plate 10mm",
      category: "Plates",
      grade: "IS 2062",
      sectionSize: "10mm (2.5m x 6m)",
      totalTons: 70.68,
      totalPieces: 60,
      unitWeight: 1.178, // ~1.178 Tons per plate
      minStockLimit: 12.0,
      location: "Yard C - Plate Section",
    },
    {
      name: "HR Plate 20mm",
      category: "Plates",
      grade: "IS 2062",
      sectionSize: "20mm (2.5m x 6m)",
      totalTons: 47.12,
      totalPieces: 20,
      unitWeight: 2.356, // ~2.356 Tons per plate
      minStockLimit: 15.0,
      location: "Yard C - Plate Section",
    },
    {
      name: "CR Coil 2.0mm",
      category: "Coils",
      grade: "IS 513",
      sectionSize: "2.0mm Width 1250mm",
      totalTons: 125.0,
      totalPieces: 25,
      unitWeight: 5.0, // ~5.0 Tons per coil
      minStockLimit: 30.0,
      location: "Yard D - Coil Bay",
    }
  ];

  console.log("Seeding inventory items...");
  for (const item of initialItems) {
    const createdItem = await prisma.inventoryItem.create({
      data: item,
    });
    
    // Seed initial transaction for each
    await prisma.stockTransaction.create({
      data: {
        itemId: createdItem.id,
        type: "INWARD",
        tons: item.totalTons,
        pieces: item.totalPieces,
        gatePassNumber: "GP-INIT-" + Math.floor(1000 + Math.random() * 9000),
        partyName: "Steel Authority of India Ltd (SAIL)",
        vehicleNumber: "MH-12-QW-5678",
        driverName: "Ramesh Singh",
        operatorName: "System Initializer",
      }
    });
  }

  console.log("Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
