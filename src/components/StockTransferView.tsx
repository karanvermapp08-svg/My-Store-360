import React, { useState } from 'react';
import {
  Boxes,
  Plus,
  Search,
  Filter,
  Download,
  ArrowRight,
  CheckCircle2,
  Building2,
  Calendar
} from 'lucide-react';
import { useVyapar } from '../context/VyaparContext';
import { Godown, StockTransfer } from '../types';
import { safeGetStoredData, safeSetStoredData } from '../utils/storage';
import { DEFAULT_GODOWNS } from './WarehousesView';

const DEFAULT_TRANSFERS: StockTransfer[] = [
  {
    id: 'trf-1',
    transferNo: 'TRF-1001',
    date: '11/11/2026',
    fromGodownId: 'gdw-1',
    fromGodownName: 'Central Godown (Hub 1)',
    toGodownId: 'gdw-2',
    toGodownName: 'South City Retail Depot',
    itemId: 'item-1',
    itemName: 'Cotton Casual Shirt',
    quantity: 15,
    unit: 'PCS',
    notes: 'Replenishing festive display stock',
    dispatchedBy: 'Warehouse Dispatcher',
    status: 'Completed',
  },
  {
    id: 'trf-2',
    transferNo: 'TRF-1002',
    date: '10/11/2026',
    fromGodownId: 'gdw-1',
    fromGodownName: 'Central Godown (Hub 1)',
    toGodownId: 'gdw-3',
    toGodownName: 'Airport Road Dispatch Center',
    itemId: 'item-3',
    itemName: 'Wireless Bluetooth Earbuds',
    quantity: 10,
    unit: 'PCS',
    notes: 'Online order fulfillment transfer',
    dispatchedBy: 'Warehouse Dispatcher',
    status: 'Completed',
  },
];

export const StockTransferView: React.FC = () => {
  const {
    items,
    showToast,
    exportCurrentViewPdf,
    recordGodownTransferStock,
  } = useVyapar();

  const [godowns] = useState<Godown[]>(() =>
    safeGetStoredData<Godown[]>('mystore_godowns', DEFAULT_GODOWNS, Array.isArray)
  );

  const [stockTransfers, setStockTransfers] = useState<StockTransfer[]>(() =>
    safeGetStoredData<StockTransfer[]>('mystore_stock_transfers', DEFAULT_TRANSFERS, Array.isArray)
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [fromGodown, setFromGodown] = useState<string>(godowns[0]?.id || 'gdw-1');
  const [toGodown, setToGodown] = useState<string>(godowns[1]?.id || godowns[0]?.id || 'gdw-2');
  const [selectedItemId, setSelectedItemId] = useState<string>(items[0]?.id || '');
  const [quantity, setQuantity] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const addStockTransfer = (transferData: Omit<StockTransfer, 'id'>) => {
    const newTransfer: StockTransfer = {
      ...transferData,
      id: `trf-${Date.now()}`,
    };
    const updated = [newTransfer, ...stockTransfers];
    setStockTransfers(updated);
    safeSetStoredData('mystore_stock_transfers', updated);
    return newTransfer;
  };

  const handleCreateTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (fromGodown === toGodown) {
      showToast('Source and Destination godowns cannot be identical', 'warning');
      return;
    }

    const item = items.find((i) => i.id === selectedItemId) || items[0];
    const qtyNum = parseInt(quantity, 10);
    if (!item || isNaN(qtyNum) || qtyNum <= 0) {
      showToast('Please select an item and valid quantity', 'warning');
      return;
    }

    const fromG = godowns.find((g: Godown) => g.id === fromGodown);
    const toG = godowns.find((g: Godown) => g.id === toGodown);
    const transferNo = `TRF-${Math.floor(1000 + Math.random() * 9000)}`;

    recordGodownTransferStock({
      itemId: item.id,
      fromGodownId: fromGodown,
      toGodownId: toGodown,
      quantity: qtyNum,
      transferNo,
    });

    addStockTransfer({
      transferNo,
      date: new Date().toLocaleDateString('en-GB'),
      fromGodownId: fromGodown,
      fromGodownName: fromG?.name || 'Central Godown',
      toGodownId: toGodown,
      toGodownName: toG?.name || 'Branch Depot',
      itemId: item.id,
      itemName: item.name,
      quantity: qtyNum,
      unit: item.unit || 'PCS',
      notes: notes || 'Inter-store inventory replenishment',
      dispatchedBy: 'Store Supervisor',
      status: 'Completed',
    });

    setIsModalOpen(false);
    setQuantity('');
    setNotes('');
    showToast(`Transferred ${qtyNum} ${item.unit || 'PCS'} to ${toG?.name || 'destination'} & logged in ledger.`);
  };

  const filteredTransfers = stockTransfers.filter(
    (st: StockTransfer) =>
      st.transferNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      st.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      st.fromGodownName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      st.toGodownName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 bg-[#f8fafc] flex flex-col overflow-hidden select-none text-xs text-slate-800">
      {/* Header */}
      <div className="bg-white border-b border-[#e2e8f0] px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <Boxes className="w-5 h-5 text-emerald-600" />
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Inter-Godown Stock Transfers</h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
              {stockTransfers.length} Transfers
            </span>
          </div>
          <p className="text-slate-500 text-xs mt-0.5">
            Record inventory movements between warehouses, dispatch notes and inter-branch delivery slips
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => exportCurrentViewPdf({ title: 'Stock Transfer Register' })}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold shadow-2xs transition-colors"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Export Register</span>
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>New Stock Transfer</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-2.5 flex items-center justify-between gap-4 shrink-0">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search transfer #, item, origin or destination..."
            className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Transfers Table */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4">Transfer #</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Origin Godown</th>
                <th className="py-3 px-4 text-center">Movement</th>
                <th className="py-3 px-4">Destination Godown</th>
                <th className="py-3 px-4">Item Transferred</th>
                <th className="py-3 px-4 text-right">Quantity</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransfers.map((st: StockTransfer) => (
                <tr key={st.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-slate-900">{st.transferNo}</td>
                  <td className="py-3.5 px-4 text-slate-600">{st.date}</td>
                  <td className="py-3.5 px-4 font-medium text-slate-800">
                    <span className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      {st.fromGodownName}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-center text-slate-400">
                    <ArrowRight className="w-4 h-4 mx-auto text-emerald-500" />
                  </td>
                  <td className="py-3.5 px-4 font-medium text-slate-800">
                    <span className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      {st.toGodownName}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-slate-900">{st.itemName}</td>
                  <td className="py-3.5 px-4 text-right font-bold text-emerald-600">
                    {st.quantity} {st.unit}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      <CheckCircle2 className="w-3 h-3" />
                      Dispatched
                    </span>
                  </td>
                </tr>
              ))}
              {filteredTransfers.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 text-xs">
                    No stock transfers found matching search criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Create Stock Transfer */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h2 className="font-bold text-sm text-slate-900">Initiate Inter-Godown Stock Transfer</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateTransfer} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1 text-[11px]">From Godown (Source) *</label>
                  <select
                    value={fromGodown}
                    onChange={(e) => setFromGodown(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:border-emerald-500"
                  >
                    {godowns.map((g: Godown) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1 text-[11px]">To Godown (Destination) *</label>
                  <select
                    value={toGodown}
                    onChange={(e) => setToGodown(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:border-emerald-500"
                  >
                    {godowns.map((g: Godown) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1 text-[11px]">Select Product Item *</label>
                <select
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:border-emerald-500"
                >
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} (In Stock: {i.stock} {i.unit || 'PCS'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1 text-[11px]">Transfer Quantity *</label>
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="e.g. 20"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1 text-[11px]">Transfer Notes / Gate Pass Ref</label>
                <input
                  type="text"
                  placeholder="e.g. Dispatch memo #4492 - Van KA-04-1234"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs"
                >
                  Confirm &amp; Dispatch Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
