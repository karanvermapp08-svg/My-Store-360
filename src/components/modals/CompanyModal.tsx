import React, { useState } from 'react';
import { X, Building2, Save } from 'lucide-react';
import { useVyapar } from '../../context/VyaparContext';

export const CompanyModal: React.FC = () => {
  const { isCompanyModalOpen, setIsCompanyModalOpen, company, updateCompany, showToast } = useVyapar();

  const [name, setName] = useState(company.name);
  const [phone, setPhone] = useState(company.phone);
  const [email, setEmail] = useState(company.email);
  const [address, setAddress] = useState(company.address);
  const [gstin, setGstin] = useState(company.gstin);
  const [state, setState] = useState(company.state);
  const [bankName, setBankName] = useState(company.bankName);
  const [accountNo, setAccountNo] = useState(company.accountNo);
  const [ifsc, setIfsc] = useState(company.ifsc);
  const [upiId, setUpiId] = useState(company.upiId);

  if (!isCompanyModalOpen) return null;

  const handleSave = () => {
    updateCompany({
      name,
      phone,
      email,
      address,
      gstin,
      state,
      bankName,
      accountNo,
      ifsc,
      upiId,
    });
    setIsCompanyModalOpen(false);
    showToast('Company profile & bank details saved successfully');
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden text-xs text-slate-800">
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-rose-400" />
            <h2 className="text-sm font-bold tracking-tight">Company / Firm Profile</h2>
          </div>
          <button
            onClick={() => setIsCompanyModalOpen(false)}
            className="text-slate-400 hover:text-white p-1 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Business / Firm Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 focus:border-rose-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Phone Number
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 focus:border-rose-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 focus:border-rose-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Business Address
            </label>
            <textarea
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 focus:border-rose-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                GSTIN / Tax ID
              </label>
              <input
                type="text"
                value={gstin}
                onChange={(e) => setGstin(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 uppercase font-mono focus:border-rose-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                State &amp; Code
              </label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 focus:border-rose-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Bank Details */}
          <div className="pt-2 border-t border-slate-200">
            <h3 className="font-bold text-slate-900 mb-2">Bank &amp; Payment Details (Printed on Invoices)</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-600 mb-1">Bank Name</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-600 mb-1">Account Number</label>
                <input
                  type="text"
                  value={accountNo}
                  onChange={(e) => setAccountNo(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-600 mb-1">IFSC Code</label>
                <input
                  type="text"
                  value={ifsc}
                  onChange={(e) => setIfsc(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs uppercase font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-600 mb-1">UPI ID (GooglePay / PhonePe)</label>
                <input
                  type="text"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 py-3 bg-slate-100 border-t border-slate-200 flex justify-end gap-2 shrink-0">
          <button
            onClick={() => setIsCompanyModalOpen(false)}
            className="px-4 py-1.5 rounded text-slate-600 hover:bg-slate-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-5 py-1.5 rounded bg-rose-600 hover:bg-rose-700 text-white font-semibold"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Profile</span>
          </button>
        </div>
      </div>
    </div>
  );
};
