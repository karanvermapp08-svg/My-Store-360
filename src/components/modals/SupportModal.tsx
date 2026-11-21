import React, { useState } from 'react';
import {
  X,
  Phone,
  Radio,
  MessageSquare,
  Send,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  User,
  Headphones,
  CheckCheck,
} from 'lucide-react';
import { useVyapar } from '../../context/VyaparContext';
import { SupportTicket } from '../../types';

export const SupportModal: React.FC = () => {
  const {
    isSupportModalOpen,
    setIsSupportModalOpen,
    supportTickets,
    addSupportTicket,
    currentUser,
    showToast,
  } = useVyapar();

  const [activeTab, setActiveTab] = useState<'create' | 'list'>('create');

  // Form state
  const [customerName, setCustomerName] = useState(currentUser?.name || 'Store Manager');
  const [phone, setPhone] = useState(currentUser?.phone || '+91 98765 43210');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [category, setCategory] = useState<SupportTicket['category']>('Billing & GST');
  const [priority, setPriority] = useState<SupportTicket['priority']>('Medium');
  const [message, setMessage] = useState('');
  const [submittedTicket, setSubmittedTicket] = useState<SupportTicket | null>(null);

  if (!isSupportModalOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      showToast('Please describe your issue or question.');
      return;
    }
    if (!phone.trim()) {
      showToast('Please provide your callback phone number.');
      return;
    }

    const created = addSupportTicket({
      customerName: customerName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      category,
      priority,
      message: message.trim(),
      resolutionNotes: 'Ticket queued for desk engineer assignment.',
    });

    setSubmittedTicket(created);
    setMessage('');
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden text-xs text-slate-800">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
            <div>
              <h2 className="text-sm font-bold tracking-tight">Vyapar Official Desk &amp; Priority Support</h2>
              <p className="text-[10px] text-slate-400">Direct technical helpdesk for billing, hardware &amp; GST compliance</p>
            </div>
          </div>
          <button
            onClick={() => setIsSupportModalOpen(false)}
            className="text-slate-400 hover:text-white p-1 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Strip */}
        <div className="bg-slate-100 border-b border-slate-200 px-5 flex items-center gap-4 text-xs font-semibold shrink-0">
          <button
            onClick={() => {
              setActiveTab('create');
              setSubmittedTicket(null);
            }}
            className={`py-2.5 border-b-2 transition-colors ${
              activeTab === 'create'
                ? 'border-rose-600 text-rose-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Submit New Ticket
          </button>

          <button
            onClick={() => {
              setActiveTab('list');
              setSubmittedTicket(null);
            }}
            className={`py-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'list'
                ? 'border-rose-600 text-rose-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Ticket Registry ({supportTickets.length})</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Direct Hotlines Card */}
          <div className="p-3 bg-sky-50 border border-sky-200 rounded-lg text-sky-900 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="font-bold flex items-center gap-1.5 text-xs text-sky-800">
                <Phone className="w-3.5 h-3.5 text-sky-700" />
                <span>Customer Care Hotlines:</span>
                <span className="font-mono font-bold text-sky-900">+91-9333911911 / +91-7795687633</span>
              </div>
              <p className="text-[11px] text-sky-700">
                Mon - Sat: 9:00 AM – 9:00 PM IST • Email: support@vyaparapp.in
              </p>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-200 text-sky-800 shrink-0">
              LIVE AGENTS
            </span>
          </div>

          {/* Submitted confirmation banner */}
          {submittedTicket && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 space-y-2 animate-in fade-in">
              <div className="flex items-center gap-2 font-bold text-sm text-emerald-800">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Ticket #{submittedTicket.ticketNo} Submitted &amp; Saved</span>
              </div>
              <p className="text-xs text-emerald-800">
                Your request has been officially recorded in local records. A support executive will contact you at{' '}
                <strong>{submittedTicket.phone}</strong>.
              </p>
              <div className="pt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('list')}
                  className="px-3 py-1 rounded bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs"
                >
                  View in Ticket Registry
                </button>
                <button
                  type="button"
                  onClick={() => setSubmittedTicket(null)}
                  className="px-3 py-1 rounded border border-emerald-300 text-emerald-900 hover:bg-emerald-100 text-xs"
                >
                  Create Another Ticket
                </button>
              </div>
            </div>
          )}

          {/* CREATE TAB */}
          {activeTab === 'create' && !submittedTicket && (
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Your Full Name *</label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Krishna Murthy"
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Callback Phone *</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 9876543210"
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Issue Category *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-rose-500"
                  >
                    <option value="Billing & GST">Billing &amp; GST Invoicing</option>
                    <option value="Printer & Hardware">Thermal Printer &amp; Hardware</option>
                    <option value="Inventory & Sync">Inventory, Barcodes &amp; Sync</option>
                    <option value="Licensing & Activation">Licensing &amp; Key Activation</option>
                    <option value="General Query">General Feature Assistance</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Urgency Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-rose-500"
                  >
                    <option value="Low">Low - General inquiry</option>
                    <option value="Medium">Medium - Regular business operation</option>
                    <option value="High">High - Active store counter affected</option>
                    <option value="Urgent">Urgent - Complete billing stoppage</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Describe what you need assistance with *
                </label>
                <textarea
                  rows={3}
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="e.g. Need assistance configuring ESC/POS thermal printer margins or correcting GST tax rate mapping."
                  className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-rose-500"
                />
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit &amp; Queue Support Ticket</span>
              </button>
            </form>
          )}

          {/* LIST TAB */}
          {activeTab === 'list' && (
            <div className="space-y-3">
              <span className="font-bold text-slate-900 block">Submitted Support Inquiries</span>
              {supportTickets.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <Headphones className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <div className="font-semibold text-slate-600">No support tickets found</div>
                  <div className="text-[11px]">Submit a ticket to request assistance from our desk.</div>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border rounded-lg bg-white overflow-hidden">
                  {supportTickets.map((t) => (
                    <div key={t.id} className="p-3.5 hover:bg-slate-50 transition-colors space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900">#{t.ticketNo}</span>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                            t.status === 'Resolved'
                              ? 'bg-emerald-100 text-emerald-800'
                              : t.status === 'In Progress'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {t.status}
                          </span>
                          <span className="text-[10px] text-slate-500 font-semibold">
                            {t.category}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400">{t.createdAt}</span>
                      </div>

                      <p className="text-xs text-slate-700">{t.message}</p>

                      {t.resolutionNotes && (
                        <div className="bg-slate-50 p-2 rounded border border-slate-200 text-[11px] text-slate-600">
                          <span className="font-bold text-slate-700">Agent Update ({t.assignedAgent || 'Desk Agent'}):</span>{' '}
                          {t.resolutionNotes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
