import React, { useEffect, useState } from 'react';
import { X, UserPlus, Save, Plus, Trash2 } from 'lucide-react';
import { useVyapar } from '../../context/VyaparContext';
import { PartyShippingAddress } from '../../types';

export const AddPartyModal: React.FC = () => {
  const {
    isAddPartyModalOpen,
    setIsAddPartyModalOpen,
    editingParty,
    setEditingParty,
    addParty,
    updateParty,
    partyGroups,
    businessSettings,
    company,
    showToast,
  } = useVyapar();

  const partyCfg = businessSettings.party;
  const enabledCustomFields = partyCfg.additionalFields.filter((f) => f.enabled);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [type, setType] = useState<'Customer' | 'Supplier'>('Customer');
  const [gstin, setGstin] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [pincode, setPincode] = useState('');
  const [sameAsBilling, setSameAsBilling] = useState(true);
  const [shippingAddress, setShippingAddress] = useState('');
  const [shippingAddresses, setShippingAddresses] = useState<PartyShippingAddress[]>([]);
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [state, setState] = useState(company.state || 'Karnataka (29)');
  const [creditLimit, setCreditLimit] = useState<number>(50000);
  const [creditPeriodDays, setCreditPeriodDays] = useState<number>(30);
  const [groupId, setGroupId] = useState<string>('');
  const [status, setStatus] = useState<'Active' | 'Inactive' | 'Blocked'>('Active');
  const [contactPerson, setContactPerson] = useState('');
  const [notes, setNotes] = useState('');
  const [customFields, setCustomFields] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isAddPartyModalOpen) return;

    if (editingParty) {
      setName(editingParty.name || '');
      setPhone(editingParty.phone || '');
      setEmail(editingParty.email || '');
      setType(editingParty.type === 'Supplier' ? 'Supplier' : 'Customer');
      setGstin(editingParty.gstin || '');
      setAddress(editingParty.address || '');
      setCity(editingParty.city || '');
      setPincode(editingParty.pincode || '');
      setShippingAddress(editingParty.shippingAddress || '');
      setSameAsBilling(
        !editingParty.shippingAddress || editingParty.shippingAddress === editingParty.address
      );
      setShippingAddresses(editingParty.shippingAddresses || []);
      setOpeningBalance(editingParty.balance || 0);
      setState(editingParty.state || company.state || 'Karnataka (29)');
      setCreditLimit(editingParty.creditLimit ?? 50000);
      setCreditPeriodDays(editingParty.creditPeriodDays ?? 30);
      setGroupId(editingParty.groupId || '');
      setStatus(editingParty.status || 'Active');
      setContactPerson(editingParty.contactPerson || '');
      setNotes(editingParty.notes || '');
      setCustomFields(editingParty.customFields || {});
    } else {
      setName('');
      setPhone('');
      setEmail('');
      setType('Customer');
      setGstin('');
      setAddress('');
      setCity('');
      setPincode('');
      setSameAsBilling(true);
      setShippingAddress('');
      setShippingAddresses([]);
      setOpeningBalance(0);
      setState(company.state || 'Karnataka (29)');
      setCreditLimit(50000);
      setCreditPeriodDays(30);
      setGroupId('');
      setStatus('Active');
      setContactPerson('');
      setNotes('');
      const defaults: Record<string, string> = {};
      enabledCustomFields.forEach((f) => {
        if (f.defaultValue) defaults[f.id] = f.defaultValue;
      });
      setCustomFields(defaults);
    }
  }, [isAddPartyModalOpen, editingParty]);

  if (!isAddPartyModalOpen) return null;

  const closeModal = () => {
    setIsAddPartyModalOpen(false);
    setEditingParty(null);
  };

  const addExtraShippingAddress = () => {
    setShippingAddresses((prev) => [
      ...prev,
      {
        id: `ship-${Date.now()}`,
        label: `Branch / Godown ${prev.length + 1}`,
        address: '',
        city: '',
        state,
        pincode: '',
        country: 'India',
        isDefault: prev.length === 0,
      },
    ]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Party Name is required', 'warning');
      return;
    }

    if (type === 'Customer' && partyCfg.customerMobileMandatory && !phone.trim()) {
      showToast('Customer mobile number is mandatory per Party Settings.', 'warning');
      return;
    }
    if (type === 'Supplier' && partyCfg.supplierMobileMandatory && !phone.trim()) {
      showToast('Supplier mobile number is mandatory per Party Settings.', 'warning');
      return;
    }
    if (partyCfg.gstinRequirement === 'Always Required' && !gstin.trim()) {
      showToast('GSTIN is mandatory per Party Settings.', 'warning');
      return;
    }

    for (const f of enabledCustomFields) {
      if (f.required && !(customFields[f.id] || '').trim()) {
        showToast(`"${f.name}" is a required party field.`, 'warning');
        return;
      }
    }

    const matchedGroup = partyGroups.find((g) => g.id === groupId);
    const resolvedShipping = partyCfg.enableShippingAddress
      ? sameAsBilling
        ? address.trim()
        : shippingAddress.trim()
      : undefined;

    const payload = {
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      type,
      balance: Number(openingBalance) || 0,
      gstin: gstin.trim().toUpperCase(),
      address: address.trim(),
      city: city.trim() || undefined,
      pincode: pincode.trim() || undefined,
      shippingAddress: resolvedShipping,
      shippingAddresses: partyCfg.allowMultipleShippingAddresses ? shippingAddresses : undefined,
      state,
      creditLimit: Number(creditLimit) || 0,
      creditPeriodDays: Number(creditPeriodDays) || 0,
      groupId: partyCfg.enablePartyGrouping ? groupId || undefined : undefined,
      groupName: partyCfg.enablePartyGrouping ? matchedGroup?.name : undefined,
      status: partyCfg.enablePartyStatus ? status : 'Active',
      contactPerson: contactPerson.trim() || undefined,
      notes: notes.trim() || undefined,
      customFields,
    };

    if (editingParty) {
      updateParty(editingParty.id, payload);
    } else {
      addParty(payload);
    }

    closeModal();
  };

  const scopedGroups = partyGroups.filter(
    (g) => g.partyType === 'Both' || g.partyType === type
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden text-xs text-slate-800 dark:text-slate-100">
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-bold tracking-tight">
              {editingParty ? `Edit Party — ${editingParty.name}` : 'Add New Party'}
            </h2>
          </div>
          <button
            type="button"
            onClick={closeModal}
            className="text-slate-400 hover:text-white p-1 rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
          {/* Type & Status */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer font-semibold">
                <input
                  type="radio"
                  name="partyType"
                  checked={type === 'Customer'}
                  onChange={() => setType('Customer')}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span>Customer</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer font-semibold">
                <input
                  type="radio"
                  name="partyType"
                  checked={type === 'Supplier'}
                  onChange={() => setType('Supplier')}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span>Supplier / Vendor</span>
              </label>
            </div>

            {partyCfg.enablePartyStatus && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-500">Status:</span>
                <select
                  value={status}
                  onChange={(e) =>
                    setStatus(e.target.value as 'Active' | 'Inactive' | 'Blocked')
                  }
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 text-xs font-semibold"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Blocked">Blocked</option>
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className={partyCfg.enablePartyGrouping ? 'sm:col-span-2' : 'sm:col-span-3'}>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Party Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ramesh Trading Co."
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 focus:border-blue-600 focus:outline-none font-semibold"
              />
            </div>

            {partyCfg.enablePartyGrouping && (
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Party Group
                </label>
                <select
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 focus:border-blue-600 focus:outline-none"
                >
                  <option value="">Unassigned</option>
                  {scopedGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Mobile Number{' '}
                {((type === 'Customer' && partyCfg.customerMobileMandatory) ||
                  (type === 'Supplier' && partyCfg.supplierMobileMandatory)) &&
                  '*'}
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 9876543210"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="party@domain.com"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Contact Person
              </label>
              <input
                type="text"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder="Primary representative"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                GSTIN {partyCfg.gstinRequirement === 'Always Required' && '*'}
              </label>
              <input
                type="text"
                value={gstin}
                onChange={(e) => setGstin(e.target.value.toUpperCase())}
                placeholder="29AAAAA0000A1Z5"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 uppercase font-mono focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Opening Balance (₹)
              </label>
              <input
                type="number"
                value={openingBalance}
                disabled={Boolean(editingParty)}
                onChange={(e) => setOpeningBalance(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 tabular-nums disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Credit Limit (₹)
              </label>
              <input
                type="number"
                min="0"
                value={creditLimit}
                onChange={(e) => setCreditLimit(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Credit Period (Days)
              </label>
              <input
                type="number"
                min="0"
                value={creditPeriodDays}
                onChange={(e) => setCreditPeriodDays(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 tabular-nums"
              />
            </div>
          </div>

          {/* Billing Address */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                State of Supply
              </label>
              <select
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs"
              >
                <option value="Karnataka (29)">Karnataka (29)</option>
                <option value="Maharashtra (27)">Maharashtra (27)</option>
                <option value="Delhi (07)">Delhi (07)</option>
                <option value="Tamil Nadu (33)">Tamil Nadu (33)</option>
                <option value="Gujarat (24)">Gujarat (24)</option>
                <option value="Uttar Pradesh (09)">Uttar Pradesh (09)</option>
                <option value="Telangana (36)">Telangana (36)</option>
                <option value="West Bengal (19)">West Bengal (19)</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                City
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Pincode
              </label>
              <input
                type="text"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                placeholder="560001"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-mono"
              />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Billing Address
              </label>
              <textarea
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street, Landmark, Area"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5"
              />
            </div>
          </div>

          {/* Shipping Address */}
          {partyCfg.enableShippingAddress && (
            <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-xs">
                  <input
                    type="checkbox"
                    checked={sameAsBilling}
                    onChange={(e) => setSameAsBilling(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span>Shipping Address same as Billing Address</span>
                </label>
                {partyCfg.allowMultipleShippingAddresses && (
                  <button
                    type="button"
                    onClick={addExtraShippingAddress}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Delivery Branch</span>
                  </button>
                )}
              </div>

              {!sameAsBilling && (
                <textarea
                  rows={2}
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  placeholder="Primary Shipping / Delivery Address"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5"
                />
              )}

              {partyCfg.allowMultipleShippingAddresses &&
                shippingAddresses.map((sa, idx) => (
                  <div
                    key={sa.id}
                    className="grid grid-cols-12 gap-2 items-center bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-700"
                  >
                    <input
                      type="text"
                      value={sa.label}
                      onChange={(e) =>
                        setShippingAddresses((prev) =>
                          prev.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x))
                        )
                      }
                      placeholder="Label"
                      className="col-span-3 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 text-xs"
                    />
                    <input
                      type="text"
                      value={sa.address}
                      onChange={(e) =>
                        setShippingAddresses((prev) =>
                          prev.map((x, i) => (i === idx ? { ...x, address: e.target.value } : x))
                        )
                      }
                      placeholder="Delivery Address"
                      className="col-span-6 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 text-xs"
                    />
                    <input
                      type="text"
                      value={sa.pincode || ''}
                      onChange={(e) =>
                        setShippingAddresses((prev) =>
                          prev.map((x, i) => (i === idx ? { ...x, pincode: e.target.value } : x))
                        )
                      }
                      placeholder="PIN"
                      className="col-span-2 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 text-xs font-mono"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShippingAddresses((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="col-span-1 text-slate-400 hover:text-rose-600 flex justify-center cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
            </div>
          )}

          {/* Dynamic Party Additional Custom Fields */}
          {enabledCustomFields.length > 0 && (
            <div className="p-3.5 rounded-lg border border-blue-200 dark:border-blue-900/60 bg-blue-50/30 dark:bg-blue-950/20 space-y-3">
              <div className="text-[11px] font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider">
                Additional Party Information
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {enabledCustomFields.map((field) => {
                  const val = customFields[field.id] ?? '';
                  return (
                    <div key={field.id}>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        {field.name} {field.required && '*'}
                        {field.showInPrint && (
                          <span className="ml-1 text-[9px] text-blue-600 font-bold">(Prints)</span>
                        )}
                      </label>
                      {field.fieldType === 'Dropdown' ? (
                        <select
                          value={val}
                          required={field.required}
                          onChange={(e) =>
                            setCustomFields((prev) => ({ ...prev, [field.id]: e.target.value }))
                          }
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs"
                        >
                          <option value="">Select {field.name}</option>
                          {(field.options || []).map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={
                            field.fieldType === 'Number'
                              ? 'number'
                              : field.fieldType === 'Date'
                              ? 'date'
                              : field.fieldType === 'Email'
                              ? 'email'
                              : field.fieldType === 'URL'
                              ? 'url'
                              : 'text'
                          }
                          value={val}
                          required={field.required}
                          onChange={(e) =>
                            setCustomFields((prev) => ({ ...prev, [field.id]: e.target.value }))
                          }
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Internal Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional delivery or credit remarks..."
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={closeModal}
              className="px-4 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{editingParty ? 'Update Party' : 'Save Party'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
