import React, { useState, useMemo } from 'react';
import {
  Layers,
  Plus,
  Search,
  Download,
  Trash2,
  X,
} from 'lucide-react';
import { useVyapar } from '../context/VyaparContext';
import { safeGetStoredData, safeSetStoredData } from '../utils/storage';

interface CategoryEntry {
  id: string;
  name: string;
  subCategories: string[];
}

const DEFAULT_CATEGORY_ENTRIES: CategoryEntry[] = [
  { id: 'cat-groc', name: 'Grocery', subCategories: ['Rice', 'Wheat', 'Sugar', 'Pulses', 'Edible Oil', 'Spices'] },
  { id: 'cat-dairy', name: 'Dairy', subCategories: ['Milk', 'Curd', 'Butter', 'Cheese', 'Tea & Coffee'] },
  { id: 'cat-pcare', name: 'Personal Care', subCategories: ['Soap', 'Shampoo', 'Toothpaste'] },
  { id: 'cat-fmcg', name: 'FMCG', subCategories: ['Detergents', 'Home Care', 'Snacks'] },
  { id: 'cat-elec', name: 'Electronics & POS', subCategories: ['Scanners', 'Thermal Paper', 'Accessories'] },
  { id: 'cat-gen', name: 'General', subCategories: ['Daily Needs', 'Misc'] },
];

export const CategoriesView: React.FC = () => {
  const {
    items,
    showToast,
    exportCurrentViewPdf,
    requestConfirmation,
    businessSettings,
    updateBusinessSettingsSection,
  } = useVyapar();

  const [categoriesList, setCategoriesList] = useState<CategoryEntry[]>(() => {
    const saved = safeGetStoredData<CategoryEntry[]>('bm360_item_categories_v2', []);
    if (saved.length > 0) return saved;
    const map = new Map<string, CategoryEntry>();
    DEFAULT_CATEGORY_ENTRIES.forEach((c) => map.set(c.name.toLowerCase(), { ...c }));
    (businessSettings?.item?.categories || []).forEach((c, idx) => {
      if (!c.name) return;
      const key = c.name.toLowerCase();
      const prev = map.get(key);
      map.set(key, {
        id: c.id || prev?.id || `cat-${idx}`,
        name: c.name,
        subCategories: Array.from(new Set([...(prev?.subCategories || []), ...(c.subCategories || [])])),
      });
    });
    items.forEach((i, idx) => {
      if (!i.category) return;
      const key = i.category.toLowerCase();
      const prev = map.get(key) || {
        id: `cat-item-${idx}`,
        name: i.category,
        subCategories: [],
      };
      if (i.subcategory && !prev.subCategories.includes(i.subcategory)) {
        prev.subCategories = [...prev.subCategories, i.subcategory];
      }
      map.set(key, prev);
    });
    return Array.from(map.values());
  });

  const [newCatName, setNewCatName] = useState('');
  const [newSubCatsInput, setNewSubCatsInput] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [subCatDrafts, setSubCatDrafts] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');

  const persistCategories = (next: CategoryEntry[]) => {
    setCategoriesList(next);
    safeSetStoredData('bm360_item_categories_v2', next);
    safeSetStoredData('bm360_item_categories', next.map((c) => c.name));
    updateBusinessSettingsSection(
      'item',
      'item',
      {
        categories: next.map((c) => ({
          id: c.id,
          name: c.name,
          subCategories: c.subCategories,
        })),
      },
      'Updated product categories & subcategories from Categories Master'
    );
  };

  const categoryStats = useMemo(() => {
    return categoriesList.map((cat) => {
      const catItems = items.filter((i) => (i.category || 'General').toLowerCase() === cat.name.toLowerCase());
      const itemCount = catItems.length;
      const totalStock = catItems.reduce((sum, i) => sum + Math.max(0, i.stock || 0), 0);
      const totalValuation = catItems.reduce((sum, i) => sum + Math.max(0, i.stock || 0) * (i.purchasePrice || 0), 0);
      const potentialSelling = catItems.reduce((sum, i) => sum + Math.max(0, i.stock || 0) * (i.salePrice || 0), 0);
      return { ...cat, itemCount, totalStock, totalValuation, potentialSelling };
    });
  }, [categoriesList, items]);

  const filteredCategories = categoryStats.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.subCategories.some((sc) => sc.toLowerCase().includes(search.toLowerCase()))
  );

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCatName.trim();
    if (!trimmed) return;
    if (categoriesList.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      showToast('Category already exists', 'warning');
      return;
    }
    const parsedSubs = newSubCatsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const nextEntry: CategoryEntry = {
      id: `cat-${Date.now()}`,
      name: trimmed,
      subCategories: parsedSubs,
    };
    persistCategories([...categoriesList, nextEntry]);
    setNewCatName('');
    setNewSubCatsInput('');
    setIsModalOpen(false);
    showToast(`Category "${trimmed}" added with ${parsedSubs.length} subcategories.`, 'success');
  };

  const handleAddSubCategory = (catId: string) => {
    const raw = (subCatDrafts[catId] || '').trim();
    if (!raw) return;
    const next = categoriesList.map((c) => {
      if (c.id !== catId) return c;
      if (c.subCategories.some((s) => s.toLowerCase() === raw.toLowerCase())) {
        showToast(`Subcategory "${raw}" already exists in ${c.name}.`, 'warning');
        return c;
      }
      return { ...c, subCategories: [...c.subCategories, raw] };
    });
    persistCategories(next);
    setSubCatDrafts((prev) => ({ ...prev, [catId]: '' }));
    showToast(`Added subcategory "${raw}"`, 'success');
  };

  const handleRemoveSubCategory = (catId: string, subName: string) => {
    const next = categoriesList.map((c) =>
      c.id === catId ? { ...c, subCategories: c.subCategories.filter((s) => s !== subName) } : c
    );
    persistCategories(next);
  };

  const handleDeleteCategory = (catName: string) => {
    requestConfirmation({
      title: 'Delete Category',
      message: `Remove category "${catName}" from the master list? Existing products remain intact.`,
      confirmLabel: 'Delete Category',
      variant: 'danger',
      onConfirm: () => {
        persistCategories(categoriesList.filter((c) => c.name !== catName));
        showToast(`Category "${catName}" removed.`, 'info');
      },
    });
  };

  return (
    <div className="flex-1 bg-[#f8fafc] dark:bg-slate-950 flex flex-col overflow-hidden select-none text-xs text-slate-800 dark:text-slate-100">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 flex items-center justify-center border border-purple-200 dark:border-purple-800">
            <Layers className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-white">
              Item Categories &amp; Subcategories ({categoriesList.length})
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Create unlimited categories &amp; subcategories, view stock distribution, and sync with Item Master
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => exportCurrentViewPdf({ title: 'Product Categories & Subcategories' })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 font-semibold text-slate-700 dark:text-slate-200 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export PDF</span>
          </button>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold shadow-2xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Category</span>
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-2.5 flex items-center justify-between gap-4 shrink-0">
        <div className="relative w-80">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search category or subcategory..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
          />
        </div>
      </div>

      {/* Grid */}
      <div className="p-6 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCategories.map((c) => (
          <div
            key={c.id}
            className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-2xs space-y-3 hover:border-purple-300 dark:hover:border-purple-700 transition-colors flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-bold text-sm text-slate-900 dark:text-white">{c.name}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {c.subCategories.length} subcategories
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteCategory(c.name)}
                  className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                  title={`Delete ${c.name}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Subcategories list */}
              <div className="flex flex-wrap gap-1.5">
                {c.subCategories.map((sub) => (
                  <span
                    key={sub}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-semibold text-slate-700 dark:text-slate-200"
                  >
                    <span>{sub}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSubCategory(c.id, sub)}
                      className="text-slate-400 hover:text-rose-600 cursor-pointer"
                      aria-label={`Remove ${sub}`}
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>

              {/* Quick Add Subcategory */}
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={subCatDrafts[c.id] || ''}
                  onChange={(e) => setSubCatDrafts((prev) => ({ ...prev, [c.id]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSubCategory(c.id);
                    }
                  }}
                  placeholder="Add subcategory..."
                  className="flex-1 min-w-0 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[11px]"
                />
                <button
                  type="button"
                  onClick={() => handleAddSubCategory(c.id)}
                  className="px-2 py-1 rounded bg-slate-900 dark:bg-slate-700 text-white text-[10px] font-semibold cursor-pointer"
                >
                  + Add
                </button>
              </div>
            </div>

            <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Total Products:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">{c.itemCount} SKUs</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Units in Stock:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">{c.totalStock.toLocaleString('en-IN', { maximumFractionDigits: 3 })}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Cost Valuation:</span>
                <span className="font-bold text-purple-700 dark:text-purple-400 tabular-nums">
                  ₹ {c.totalValuation.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Retail Value:</span>
                <span className="font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                  ₹ {c.potentialSelling.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-sm w-full border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <h3 className="font-bold text-sm">Add Item Category</h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                ✕
              </button>
            </div>
            <form onSubmit={handleAddCategory} className="p-5 space-y-4">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Category Name *</label>
                <input
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  required
                  placeholder="e.g. Sanitary Ware"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Subcategories (comma-separated)</label>
                <input
                  type="text"
                  value={newSubCatsInput}
                  onChange={(e) => setNewSubCatsInput(e.target.value)}
                  placeholder="e.g. Rice, Wheat, Sugar, Pulses"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold shadow-xs cursor-pointer"
                >
                  Save Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
