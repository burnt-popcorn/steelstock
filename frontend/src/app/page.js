'use client';

import { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { 
  BarChart, Bar, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip,
  PieChart, Pie, Legend
} from 'recharts';
import { 
  Package, AlertTriangle, ArrowDownLeft, ArrowUpRight, Search, 
  Filter, Plus, RefreshCw, Truck, FileText, User, MapPin, CheckCircle, Bell
} from 'lucide-react';
import InwardModal from '../components/InwardModal';
import OutwardModal from '../components/OutwardModal';

// Simple Toast Notification component
function Toast({ message, type, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`flex items-start gap-3 p-4 rounded-xl border shadow-xl max-w-sm w-full transition-all duration-300 transform translate-y-0 scale-100 ${
      type === 'INWARD'
        ? 'bg-emerald-950/95 border-emerald-500/30 text-emerald-100'
        : 'bg-rose-950/95 border-rose-500/30 text-rose-100'
    }`}>
      <div className={`p-1.5 rounded-lg shrink-0 ${
        type === 'INWARD' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
      }`}>
        {type === 'INWARD' ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
      </div>
      <div className="flex-1 text-sm">
        <span className="font-semibold block mb-0.5">
          {type === 'INWARD' ? 'Stock Received' : 'Stock Dispatched'}
        </span>
        <p className="text-xs opacity-90">{message}</p>
      </div>
      <button onClick={onClose} className="text-slate-400 hover:text-slate-200 text-xs font-bold shrink-0">
        ✕
      </button>
    </div>
  );
}

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";

export default function Dashboard() {
  const [inventory, setInventory] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  
  // Modals state
  const [isInwardOpen, setIsInwardOpen] = useState(false);
  const [isOutwardOpen, setIsOutwardOpen] = useState(false);
  
  // Toast notifications state
  const [toasts, setToasts] = useState([]);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');

  // Socket instance ref
  const socketRef = useRef(null);

  // Fetch all initial data
  const fetchData = async () => {
    try {
      const invRes = await fetch(`${BACKEND_URL}/api/inventory`);
      const txnRes = await fetch(`${BACKEND_URL}/api/transactions`);
      
      if (invRes.ok) setInventory(await invRes.json());
      if (txnRes.ok) setTransactions(await txnRes.json());
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  };

  useEffect(() => {
    fetchData();

    // Setup Socket.IO Client
    const socket = io(BACKEND_URL);
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Handle real-time stock updates
    socket.on('stock_update', (data) => {
      const { type, updatedItem, transaction } = data;
      
      // Update inventory list
      setInventory((prevInventory) => {
        const index = prevInventory.findIndex((item) => item.id === updatedItem.id);
        if (index === -1) {
          return [...prevInventory, updatedItem].sort((a, b) => a.name.localeCompare(b.name));
        }
        const newInventory = [...prevInventory];
        newInventory[index] = updatedItem;
        return newInventory;
      });

      // Update transactions log
      setTransactions((prevTxns) => [transaction, ...prevTxns.slice(0, 49)]);

      // Create new toast notification
      const toastMsg = type === 'INWARD'
        ? `${updatedItem.name} (${transaction.pieces} pcs / ${transaction.tons.toFixed(2)}t) received from ${transaction.partyName}.`
        : `${updatedItem.name} (${transaction.pieces} pcs / ${transaction.tons.toFixed(2)}t) dispatched to ${transaction.partyName}.`;
      
      setToasts((prevToasts) => [
        { id: transaction.id || Math.random().toString(), message: toastMsg, type },
        ...prevToasts
      ]);
    });

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  // Filtered inventory list
  const filteredInventory = inventory.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.grade.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory ? item.category === selectedCategory : true;
    const matchesLocation = selectedLocation ? item.location.includes(selectedLocation) : true;
    return matchesSearch && matchesCategory && matchesLocation;
  });

  // Calculate live statistics
  const totalStockTons = inventory.reduce((acc, curr) => acc + curr.totalTons, 0);
  const lowStockCount = inventory.filter((item) => item.totalTons <= item.minStockLimit).length;
  
  // Calculate daily inward and outward tons
  const today = new Date().toDateString();
  const todayInwardTons = transactions
    .filter((txn) => txn.type === 'INWARD' && new Date(txn.createdAt).toDateString() === today)
    .reduce((acc, curr) => acc + curr.tons, 0);
  const todayOutwardTons = transactions
    .filter((txn) => txn.type === 'OUTWARD' && new Date(txn.createdAt).toDateString() === today)
    .reduce((acc, curr) => acc + curr.tons, 0);

  // Dynamic lists for filter dropdowns
  const categories = [...new Set(inventory.map((item) => item.category))];
  const locations = ['Yard A', 'Yard B', 'Yard C', 'Yard D'];

  // Prepare chart data: Category stock (in Tons)
  const categoryData = categories.map((cat) => {
    const tons = inventory
      .filter((item) => item.category === cat)
      .reduce((acc, curr) => acc + curr.totalTons, 0);
    return { name: cat, value: parseFloat(tons.toFixed(2)) };
  });

  // Prepare chart data: Safety limits vs Available (only for items with low stock or top 7 filtered)
  const stockBarData = filteredInventory
    .slice(0, 7)
    .map((item) => ({
      name: item.name.split(' ').slice(1).join(' ') || item.name, // Shorten name
      'Available Tons': parseFloat(item.totalTons.toFixed(2)),
      'Min Safety Limit': item.minStockLimit,
    }));

  const COLORS = ['#38bdf8', '#818cf8', '#34d399', '#f472b6', '#fb7185', '#fbbf24', '#a78bfa'];

  return (
    <div className="flex-1 flex flex-col p-4 md:p-8 max-w-7xl w-full mx-auto gap-6 md:gap-8">
      {/* Top Banner Header */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="h-8 w-8 rounded-lg bg-sky-500/10 flex items-center justify-center border border-sky-500/30">
              <span className="text-sky-400 font-extrabold text-lg">S</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-slate-50 via-slate-100 to-sky-400 bg-clip-text text-transparent">
              SteelSync Stock Dashboard
            </h1>
          </div>
          <p className="text-xs text-slate-400">
            Real-time weight (Tons) and piece-level inventory control console.
          </p>
        </div>

        {/* Real-Time Connection Indicator */}
        <div className="flex items-center gap-3 self-end sm:self-center">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold ${
            isConnected 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
          }`}>
            <span className={`h-2.5 w-2.5 rounded-full ${isConnected ? 'bg-emerald-400 glow-green' : 'bg-rose-400 animate-pulse'}`}></span>
            {isConnected ? 'Live Connected' : 'Disconnected'}
          </div>
          <button 
            onClick={fetchData} 
            className="p-2 rounded-lg bg-slate-900 border border-slate-850 hover:border-slate-700 text-slate-400 hover:text-slate-200 transition-all active:scale-95"
            title="Manual Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* KPI Cards Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {/* Card 1: Total Tons */}
        <div className="glass-panel glass-panel-hover rounded-2xl p-5 flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total On-Hand Stock</span>
            <span className="text-2xl md:text-3xl font-bold tracking-tight text-slate-50">
              {totalStockTons.toLocaleString('en-IN', { maximumFractionDigits: 2 })} <span className="text-sm font-medium text-slate-400">Tons</span>
            </span>
            <span className="text-[10px] text-slate-500">Live aggregated yard weight</span>
          </div>
          <div className="p-3.5 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Package className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: Low Stock Warnings */}
        <div className={`glass-panel rounded-2xl p-5 flex items-center justify-between border ${
          lowStockCount > 0 ? 'border-amber-500/30 shadow-lg shadow-amber-500/5' : ''
        }`}>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Critical Low Stock</span>
            <span className={`text-2xl md:text-3xl font-bold tracking-tight ${lowStockCount > 0 ? 'text-amber-400' : 'text-slate-50'}`}>
              {lowStockCount} <span className="text-xs font-medium text-slate-400">products</span>
            </span>
            <span className="text-[10px] text-slate-500">Below minimum safety levels</span>
          </div>
          <div className={`p-3.5 rounded-xl border ${
            lowStockCount > 0 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-slate-800 text-slate-400'
          }`}>
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Inward Today */}
        <div className="glass-panel glass-panel-hover rounded-2xl p-5 flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Inward Shipments (Today)</span>
            <span className="text-2xl md:text-3xl font-bold tracking-tight text-emerald-400">
              +{todayInwardTons.toFixed(2)} <span className="text-xs font-medium text-slate-400">Tons</span>
            </span>
            <span className="text-[10px] text-slate-500">Stock updates received today</span>
          </div>
          <div className="p-3.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <ArrowDownLeft className="w-6 h-6" />
          </div>
        </div>

        {/* Card 4: Outward Today */}
        <div className="glass-panel glass-panel-hover rounded-2xl p-5 flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Outward Dispatches (Today)</span>
            <span className="text-2xl md:text-3xl font-bold tracking-tight text-rose-400">
              -{todayOutwardTons.toFixed(2)} <span className="text-xs font-medium text-slate-400">Tons</span>
            </span>
            <span className="text-[10px] text-slate-500">Stock dispatches completed today</span>
          </div>
          <div className="p-3.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <ArrowUpRight className="w-6 h-6" />
          </div>
        </div>
      </section>

      {/* Analytics Charts Row */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Bar Chart of stock safety levels */}
        <div className="glass-panel rounded-2xl p-5 md:p-6 lg:col-span-2 flex flex-col gap-4">
          <div>
            <h3 className="font-semibold text-slate-100 text-sm md:text-base">Stock Availability vs. Safety Limits</h3>
            <p className="text-[11px] text-slate-400">Comparing current weight level (Tons) with minimum threshold limits</p>
          </div>
          <div className="h-[260px] w-full text-xs">
            {stockBarData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stockBarData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="#64748b" tickLine={false} />
                  <YAxis stroke="#64748b" tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px' }}
                    labelStyle={{ color: '#94a3b8', fontWeight: 'bold' }}
                  />
                  <Legend verticalAlign="top" height={36} />
                  <Bar dataKey="Available Tons" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Min Safety Limit" fill="#fb7185" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500">No data matches current filters</div>
            )}
          </div>
        </div>

        {/* Right: Pie Chart of Category Distribution */}
        <div className="glass-panel rounded-2xl p-5 md:p-6 flex flex-col gap-4">
          <div>
            <h3 className="font-semibold text-slate-100 text-sm md:text-base">Stock By Category</h3>
            <p className="text-[11px] text-slate-400">Total weight distribution across product classes (Tons)</p>
          </div>
          <div className="h-[260px] w-full flex items-center justify-center text-xs">
            {categoryData.some(d => d.value > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="45%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px' }}
                    formatter={(value) => [`${value} Tons`, 'Stock']}
                  />
                  <Legend layout="horizontal" verticalAlign="bottom" align="center" iconSize={10} wrapperStyle={{ bottom: 0 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500">No data available</div>
            )}
          </div>
        </div>
      </section>

      {/* Main Stock Data Grid & Actions */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left/Middle: Live Inventory Table */}
        <div className="glass-panel rounded-2xl p-5 md:p-6 lg:col-span-2 flex flex-col gap-5 overflow-hidden">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="font-semibold text-slate-100 text-base flex items-center gap-2">
                Live Inventory Ledger
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 font-bold border border-sky-500/20">
                  {filteredInventory.length} Items
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">Filtered results of available yard inventory levels</p>
            </div>

            {/* Quick Action Forms Triggers */}
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                onClick={() => setIsInwardOpen(true)}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-slate-950 font-bold text-xs md:text-sm transition-all shadow-md shadow-emerald-500/10"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                Inward (Add)
              </button>
              <button
                onClick={() => setIsOutwardOpen(true)}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 active:scale-95 text-slate-950 font-bold text-xs md:text-sm transition-all shadow-md shadow-rose-500/10"
              >
                <ArrowUpRight className="w-3.5 h-3.5 stroke-[3]" />
                Outward (Dispatch)
              </button>
            </div>
          </div>

          {/* Search and Filters panel */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search name, grade, yard..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 rounded-lg bg-slate-900 border border-slate-800 focus:border-sky-500/50 focus:outline-none text-slate-100 text-xs transition-colors"
              />
            </div>

            {/* Category Dropdown */}
            <div className="relative">
              <Filter className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3.5" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-800 focus:border-sky-500/50 focus:outline-none text-slate-100 text-xs transition-colors cursor-pointer appearance-none"
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Location Dropdown */}
            <div className="relative">
              <MapPin className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3.5" />
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-800 focus:border-sky-500/50 focus:outline-none text-slate-100 text-xs transition-colors cursor-pointer appearance-none"
              >
                <option value="">All Locations</option>
                {locations.map((loc) => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto border border-slate-800/80 rounded-xl bg-slate-900/40">
            <table className="w-full border-collapse text-left text-xs md:text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider bg-slate-900/60">
                  <th className="px-4 py-3.5">Product Details</th>
                  <th className="px-4 py-3.5">Grade</th>
                  <th className="px-4 py-3.5">Location</th>
                  <th className="px-4 py-3.5 text-right">Available Pcs</th>
                  <th className="px-4 py-3.5 text-right">Available Tons</th>
                  <th className="px-4 py-3.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredInventory.length > 0 ? (
                  filteredInventory.map((item) => {
                    const isLow = item.totalTons <= item.minStockLimit;
                    return (
                      <tr key={item.id} className="hover:bg-slate-800/25 transition-colors">
                        <td className="px-4 py-3.5">
                          <span className="font-semibold text-slate-100 block">{item.name}</span>
                          <span className="text-[10px] text-slate-400">{item.category} • Size: {item.sectionSize}</span>
                        </td>
                        <td className="px-4 py-3.5 text-slate-300 font-mono">{item.grade}</td>
                        <td className="px-4 py-3.5 text-slate-400">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-500" />
                            {item.location}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right font-semibold text-slate-200">
                          {item.totalPieces.toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3.5 text-right font-bold text-sky-400">
                          {item.totalTons.toFixed(2)}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          {isLow ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 border border-amber-500/20 text-amber-400">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              Low Stock
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                              <CheckCircle className="w-2.5 h-2.5" />
                              Adequate
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="6" className="text-center py-8 text-slate-500">
                      No steel inventory products found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Live Transaction Log */}
        <div className="glass-panel rounded-2xl p-5 md:p-6 flex flex-col gap-4 overflow-hidden h-[540px]">
          <div>
            <h3 className="font-semibold text-slate-100 text-base flex items-center gap-2">
              <Bell className="w-4 h-4 text-sky-400" />
              Live Audit Trail
            </h3>
            <p className="text-[11px] text-slate-400">Real-time log of inward/outward gate movements</p>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3.5 scrollbar-thin">
            {transactions.length > 0 ? (
              transactions.map((txn) => {
                const isInward = txn.type === 'INWARD';
                const timeStr = new Date(txn.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                const dateStr = new Date(txn.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' });
                
                return (
                  <div key={txn.id} className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col gap-2.5 text-xs hover:border-slate-700 transition-colors">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold border ${
                        isInward 
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                          : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                      }`}>
                        {isInward ? 'INWARD (Add)' : 'OUTWARD (Dispatch)'}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {dateStr}, {timeStr}
                      </span>
                    </div>

                    {/* Content Details */}
                    <div>
                      <span className="font-bold text-slate-100 block text-xs mb-0.5">
                        {txn.item?.name || 'Steel Product'}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Grade: {txn.item?.grade || 'N/A'} • Size: {txn.item?.sectionSize || 'N/A'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px] bg-slate-950/40 p-2 rounded-lg border border-slate-900">
                      <div>
                        <span className="text-slate-500 block">Weight Moved:</span>
                        <span className="font-semibold text-sky-400">{txn.tons.toFixed(2)} Tons</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Pieces:</span>
                        <span className="font-semibold text-slate-300">{txn.pieces} pcs</span>
                      </div>
                    </div>

                    {/* Footer Info */}
                    <div className="flex flex-col gap-1 border-t border-slate-800/60 pt-2 text-[10px] text-slate-400">
                      {txn.partyName && (
                        <span className="flex items-center gap-1 text-[10px]">
                          <Truck className="w-3 h-3 text-slate-500 shrink-0" />
                          <span className="truncate">Party: <strong className="text-slate-300">{txn.partyName}</strong></span>
                        </span>
                      )}
                      
                      <div className="flex justify-between gap-2">
                        {txn.vehicleNumber && (
                          <span className="truncate">Vehicle: <strong className="text-slate-300 font-mono">{txn.vehicleNumber}</strong></span>
                        )}
                        {isInward ? (
                          txn.gatePassNumber && (
                            <span className="shrink-0 flex items-center gap-0.5 font-mono text-[9px] bg-slate-850 px-1 py-0.5 rounded text-slate-400">
                              <FileText className="w-2.5 h-2.5" />
                              GP:{txn.gatePassNumber}
                            </span>
                          )
                        ) : (
                          txn.invoiceNumber && (
                            <span className="shrink-0 flex items-center gap-0.5 font-mono text-[9px] bg-slate-850 px-1 py-0.5 rounded text-slate-400">
                              <FileText className="w-2.5 h-2.5" />
                              INV:{txn.invoiceNumber}
                            </span>
                          )
                        )}
                      </div>
                      
                      <span className="flex items-center gap-1 mt-0.5 border-t border-slate-850 pt-1 text-[9px] text-slate-500">
                        <User className="w-2.5 h-2.5" />
                        Logged by: {txn.operatorName}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                No logs recorded yet.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Floating Stacked Toasts Notifications */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-50 max-w-sm w-full">
        {toasts.map((t) => (
          <Toast 
            key={t.id} 
            message={t.message} 
            type={t.type} 
            onClose={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))} 
          />
        ))}
      </div>

      {/* Modals Containers */}
      <InwardModal 
        isOpen={isInwardOpen} 
        onClose={() => setIsInwardOpen(false)} 
        inventoryItems={inventory} 
        onSubmitSuccess={fetchData} 
      />

      <OutwardModal 
        isOpen={isOutwardOpen} 
        onClose={() => setIsOutwardOpen(false)} 
        inventoryItems={inventory} 
        onSubmitSuccess={fetchData} 
      />
    </div>
  );
}
