import { useRef, useEffect, useState } from 'react';
import { X, Plus, AlertCircle } from 'lucide-react';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";

export default function InwardModal({ isOpen, onClose, inventoryItems, onSubmitSuccess }) {
  const dialogRef = useRef(null);
  
  const [itemId, setItemId] = useState('');
  const [tons, setTons] = useState('');
  const [pieces, setPieces] = useState('');
  const [gatePassNumber, setGatePassNumber] = useState('');
  const [partyName, setPartyName] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [operatorName, setOperatorName] = useState('Yash Sharma'); // Preset floor manager
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Handle open/close state sync
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
        // Reset form
        setItemId(inventoryItems[0]?.id || '');
        setTons('');
        setPieces('');
        setGatePassNumber('');
        setPartyName('');
        setVehicleNumber('');
        setDriverName('');
        setError('');
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen, inventoryItems]);

  // Handle ESC close sync
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => {
      onClose();
    };
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onClose]);

  // Light dismiss on clicking backdrop
  const handleBackdropClick = (e) => {
    if (e.target === dialogRef.current) {
      onClose();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!itemId || !tons || !pieces || !operatorName) {
      setError('Please fill out all required fields.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${BACKEND_URL}/api/stock/inward`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId,
          tons: parseFloat(tons),
          pieces: parseInt(pieces),
          gatePassNumber,
          partyName,
          vehicleNumber,
          driverName,
          operatorName,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to submit inward transaction.');
      }

      onSubmitSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      className="p-0 bg-transparent border-0 outline-none max-w-lg w-full rounded-2xl glass-panel shadow-2xl backdrop:backdrop-blur-md"
    >
      <div className="p-6 md:p-8 text-slate-100 flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-700/60 pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-wide">Inward Stock Entry</h2>
              <p className="text-xs text-slate-400">Receive steel inventory into the yards</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Item Selection */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Select Steel Product <span className="text-emerald-400">*</span>
            </label>
            <select
              required
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
              className="px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-800 focus:border-emerald-500/70 focus:outline-none text-slate-100 text-sm transition-colors cursor-pointer"
            >
              <option value="" disabled>-- Choose Steel Product --</option>
              {inventoryItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.grade}) - Current: {item.totalTons.toFixed(2)}t ({item.totalPieces} pcs)
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Quantity in Tons */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Weight (Tons) <span className="text-emerald-400">*</span>
              </label>
              <input
                required
                type="number"
                step="0.001"
                min="0.001"
                placeholder="e.g. 15.540"
                value={tons}
                onChange={(e) => setTons(e.target.value)}
                className="px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-800 focus:border-emerald-500/70 focus:outline-none text-slate-100 text-sm transition-colors"
              />
            </div>

            {/* Quantity in Pieces */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Quantity (Pieces) <span className="text-emerald-400">*</span>
              </label>
              <input
                required
                type="number"
                min="1"
                placeholder="e.g. 150"
                value={pieces}
                onChange={(e) => setPieces(e.target.value)}
                className="px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-800 focus:border-emerald-500/70 focus:outline-none text-slate-100 text-sm transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Gate Pass Number */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Gate Pass No.
              </label>
              <input
                type="text"
                placeholder="e.g. GP-5432"
                value={gatePassNumber}
                onChange={(e) => setGatePassNumber(e.target.value)}
                className="px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-800 focus:border-emerald-500/70 focus:outline-none text-slate-100 text-sm transition-colors"
              />
            </div>

            {/* Party Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Supplier/Manufacturer
              </label>
              <input
                type="text"
                placeholder="e.g. SAIL, Tata Steel"
                value={partyName}
                onChange={(e) => setPartyName(e.target.value)}
                className="px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-800 focus:border-emerald-500/70 focus:outline-none text-slate-100 text-sm transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Vehicle Number */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Vehicle No.
              </label>
              <input
                type="text"
                placeholder="e.g. MH-12-PQ-9876"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
                className="px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-800 focus:border-emerald-500/70 focus:outline-none text-slate-100 text-sm transition-colors"
              />
            </div>

            {/* Driver Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Driver Name
              </label>
              <input
                type="text"
                placeholder="e.g. Suresh Kumar"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                className="px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-800 focus:border-emerald-500/70 focus:outline-none text-slate-100 text-sm transition-colors"
              />
            </div>
          </div>

          {/* Operator Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Operator Logged In <span className="text-emerald-400">*</span>
            </label>
            <input
              required
              type="text"
              readOnly
              value={operatorName}
              className="px-3.5 py-2.5 rounded-lg bg-slate-850 border border-slate-800/80 text-slate-400 text-sm focus:outline-none cursor-not-allowed select-none"
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 mt-4 border-t border-slate-700/60 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-5 py-2.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 hover:text-slate-100 text-sm font-semibold transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-slate-950 text-sm font-bold shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 stroke-[3]" />
                  Receive Stock
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
