import React, { useState } from 'react';
import {
  Boxes,
  Barcode,
  ArrowRightLeft,
  Sliders,
  AlertTriangle,
  Plus,
  Search,
  CheckCircle2,
  PackageCheck,
  Building2,
  FileDown,
} from 'lucide-react';
import { useVyapar } from '../../context/VyaparContext';
import { ItemsView } from '../ItemsView';
import { apiClient } from '../../utils/apiClient';

export const InventoryWorkspace: React.FC = () => {
  const { items, setIsAddItemModalOpen, adjustStock, showToast } = useVyapar();

  const [activeTab, setActiveTab] = useState<'catalog' | 'transfers' | 'reorder_alerts'>('catalog');
  const [selectedTransferItem, setSelectedTransferItem] = useState('');
  const [transferQty, setTransferQty] = useState<number>(5);
  const [sourceWarehouse, setSourceWarehouse] = useState('Central Distribution Warehouse');
  const [destBranch, setDestBranch] = useState('Bengaluru Flagship Store');

  const lowStockItems = items.filter((i) => i.stock <= (i.minStockAlert || 10));

  const handleTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTransferItem) {
      showToast('Please select an item for warehouse transfer');
      return;
    }
    showToast(`Warehouse Transfer #${Date.now().toString().slice(-4)}: Dispatched ${transferQty} units of ${selectedTransferItem} from ${sourceWarehouse} to ${destBranch}.`);
    setSelectedTransferItem('');
  };

  return (
    <div className="flex-1 flex flex-col bg-[#f0f4f9] overflow-hidden select-none text-xs text-slate-800">
      {/* 1. Header */}
      <div className="bg-white p-5 border-b border-slate-200 shrink-0 space-y-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-200">
              <Boxes className="w-6 h-6 stroke-[2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                  Inventory &amp; Warehousing Console
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-300">
                  Ramesh Gowda (Inventory)
                </span>
              </div>
              <p className="text-slate-500 text-xs mt-0.5">
                Central stock valuation, multi-warehouse transfers, barcode tracking, and physical audits
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAddItemModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-2xs transition-colors"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Add New Item Master</span>
            </button>
          </div>
        </div>

        {/* Quick Stock Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <span className="text-[11px] font-semibold text-slate-500">Total Catalog Items</span>
            <div className="text-base font-bold text-slate-900">{items.length} Products</div>
            <span className="text-[10px] text-slate-400">Synchronized across all terminals</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <span className="text-[11px] font-semibold text-slate-500">Low Stock Reorder Alerts</span>
            <div className={`text-base font-bold ${lowStockItems.length > 0 ? 'text-amber-600' : 'text-emerald-700'}`}>
              {lowStockItems.length} SKUs Below Minimum
            </div>
            <span className="text-[10px] text-slate-400">Automatic safety stock alerts</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <span className="text-[11px] font-semibold text-slate-500">Active Warehouses</span>
            <div className="text-base font-bold text-indigo-700">3 Locations</div>
            <span className="text-[10px] text-slate-400">Flagship, Hubballi Depot &amp; Central WH</span>
          </div>
        </div>
      </div>

      {/* 2. Sub-tab navigation */}
      <div className="bg-white border-b border-slate-200 px-6 flex items-center gap-6 shrink-0 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('catalog')}
          className={`py-3 border-b-2 transition-colors ${
            activeTab === 'catalog' ? 'border-indigo-600 text-indigo-700 font-bold' : 'border-transparent text-slate-500'
          }`}
        >
          Product Master &amp; Adjustments
        </button>

        <button
          onClick={() => setActiveTab('transfers')}
          className={`py-3 border-b-2 transition-colors ${
            activeTab === 'transfers' ? 'border-indigo-600 text-indigo-700 font-bold' : 'border-transparent text-slate-500'
          }`}
        >
          Inter-Warehouse Stock Transfers
        </button>

        <button
          onClick={() => setActiveTab('reorder_alerts')}
          className={`py-3 border-b-2 transition-colors ${
            activeTab === 'reorder_alerts' ? 'border-indigo-600 text-indigo-700 font-bold' : 'border-transparent text-slate-500'
          }`}
        >
          Reorder Warnings ({lowStockItems.length})
        </button>
      </div>

      {/* 3. Tab contents */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'catalog' && <ItemsView />}

        {activeTab === 'transfers' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4 max-w-2xl">
              <h3 className="font-bold text-xs text-slate-900 flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-indigo-600" />
                <span>Dispatch Inter-Warehouse Stock Transfer</span>
              </h3>

              <form onSubmit={handleTransferSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Source Depot / Warehouse</label>
                    <select
                      value={sourceWarehouse}
                      onChange={(e) => setSourceWarehouse(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs font-semibold"
                    >
                      <option value="Central Distribution Warehouse">Central Distribution Warehouse</option>
                      <option value="Hubballi Branch & Depot">Hubballi Branch & Depot</option>
                      <option value="Bengaluru Flagship Store">Bengaluru Flagship Store</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Destination Branch / Store</label>
                    <select
                      value={destBranch}
                      onChange={(e) => setDestBranch(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs font-semibold"
                    >
                      <option value="Bengaluru Flagship Store">Bengaluru Flagship Store</option>
                      <option value="Hubballi Branch & Depot">Hubballi Branch & Depot</option>
                      <option value="Central Distribution Warehouse">Central Distribution Warehouse</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-slate-700 font-semibold mb-1">Product Item to Transfer *</label>
                    <select
                      value={selectedTransferItem}
                      onChange={(e) => setSelectedTransferItem(e.target.value)}
                      required
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs font-semibold"
                    >
                      <option value="">-- Choose Item --</option>
                      {items.map((it) => (
                        <option key={it.id} value={it.name}>
                          {it.name} (Current Stock: {it.stock} {it.unit})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Transfer Qty</label>
                    <input
                      type="number"
                      min="1"
                      value={transferQty}
                      onChange={(e) => setTransferQty(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs font-bold"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex justify-end">
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-2xs transition-colors flex items-center gap-1.5"
                  >
                    <PackageCheck className="w-4 h-4" />
                    <span>Authorize &amp; Post Transfer</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'reorder_alerts' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-3">
              <h3 className="font-bold text-xs text-slate-900">Low Stock Reorder Notifications</h3>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                {lowStockItems.length === 0 ? (
                  <div className="p-6 text-center text-slate-400">All product inventories are well-stocked!</div>
                ) : (
                  lowStockItems.map((it) => (
                    <div key={it.id} className="p-3 bg-white flex items-center justify-between text-xs">
                      <div>
                        <strong className="text-slate-900">{it.name}</strong>
                        <p className="text-[11px] text-slate-400">Code: {it.code} • Min Alert Level: {it.minStockAlert || 10}</p>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-rose-600 text-xs">Only {it.stock} {it.unit} Remaining</span>
                        <span className="text-[10px] text-amber-700 block font-semibold">Reorder Required</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
