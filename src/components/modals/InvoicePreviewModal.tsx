import React, { useMemo, useState } from 'react';
import {
  X,
  Printer,
  Share2,
  FileDown,
  Ban,
  AlertTriangle,
  Copy,
  ExternalLink,
  RotateCcw,
  History,
  Paperclip,
  QrCode,
  Stamp,
} from 'lucide-react';
import { useVyapar } from '../../context/VyaparContext';
import { formatBaseQtyHuman, isWeightOrVolumeUnit } from '../../utils/kiranaBilling';
import { InvoiceTemplateType } from '../../types';
import { exportSingleInvoicePdf } from '../../utils/pdfExport';
import { interpolateMessageTemplate } from '../../data/defaultSettings';
import { buildUpiPaymentQrPayload } from '../../utils/transactionEngine';

function numberToWords(num: number): string {
  const a = [
    '',
    'One ',
    'Two ',
    'Three ',
    'Four ',
    'Five ',
    'Six ',
    'Seven ',
    'Eight ',
    'Nine ',
    'Ten ',
    'Eleven ',
    'Twelve ',
    'Thirteen ',
    'Fourteen ',
    'Fifteen ',
    'Sixteen ',
    'Seventeen ',
    'Eighteen ',
    'Nineteen ',
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const n = Math.floor(Math.abs(num));
  if (n === 0) return 'Zero Rupees Only';

  function inWords(val: number): string {
    let str = '';
    if (val > 10000000) {
      str += inWords(Math.floor(val / 10000000)) + 'Crore ';
      val %= 10000000;
    }
    if (val > 100000) {
      str += inWords(Math.floor(val / 100000)) + 'Lakh ';
      val %= 100000;
    }
    if (val > 1000) {
      str += inWords(Math.floor(val / 1000)) + 'Thousand ';
      val %= 1000;
    }
    if (val > 100) {
      str += inWords(Math.floor(val / 100)) + 'Hundred ';
      val %= 100;
    }
    if (val > 0) {
      if (val < 20) str += a[val];
      else str += b[Math.floor(val / 10)] + ' ' + a[val % 10];
    }
    return str;
  }

  return inWords(n).trim() + ' Rupees Only';
}

export const InvoicePreviewModal: React.FC = () => {
  const {
    isInvoicePreviewOpen,
    setIsInvoicePreviewOpen,
    selectedInvoice,
    company,
    parties,
    items,
    businessSettings,
    showToast,
    selectedTemplate,
    setSelectedTemplate,
    cancelInvoice,
    reverseTransaction,
    logTransactionActivity,
  } = useVyapar();

  const [activeTemplate, setActiveTemplate] = useState<InvoiceTemplateType>(
    businessSettings.print.defaultTemplate || selectedTemplate || 'gst-tax-invoice'
  );
  const [showCancelPrompt, setShowCancelPrompt] = useState(false);
  const [showReversePrompt, setShowReversePrompt] = useState(false);
  const [showSharePrompt, setShowSharePrompt] = useState(false);
  const [showActivityPanel, setShowActivityPanel] = useState(false);
  const [showStampAndQr, setShowStampAndQr] = useState(true);
  const [cancellationReason, setCancellationReason] = useState('Customer requested order cancellation');
  const [reversalReason, setReversalReason] = useState('Billing correction / contra entry reversal');

  const printCfg = businessSettings.print;

  const matchedParty = useMemo(
    () =>
      selectedInvoice
        ? parties.find(
            (p) => p.name.trim().toLowerCase() === selectedInvoice.partyName.trim().toLowerCase()
          )
        : undefined,
    [parties, selectedInvoice]
  );

  const printablePartyCustomFields = useMemo(() => {
    if (!printCfg.showAdditionalCustomFields || !matchedParty?.customFields) return [];
    return businessSettings.party.additionalFields
      .filter((f) => f.enabled && f.showInPrint && matchedParty.customFields?.[f.id])
      .map((f) => ({ name: f.name, value: matchedParty.customFields?.[f.id] || '' }));
  }, [printCfg.showAdditionalCustomFields, matchedParty, businessSettings.party.additionalFields]);

  const whatsAppMessage = useMemo(() => {
    if (!selectedInvoice) return '';
    const tpl =
      businessSettings.messages.templates.find((t) => t.type === 'Sales Invoice')?.body ||
      'Hello {customer_name}, Invoice #{invoice_number} for ₹{total_amount} from {business_name}. Balance: ₹{balance_amount}.';
    return interpolateMessageTemplate(tpl, {
      business_name: company.name,
      customer_name: selectedInvoice.partyName,
      invoice_number: selectedInvoice.invoiceNo,
      invoice_date: selectedInvoice.date,
      due_date: selectedInvoice.dueDate,
      total_amount: selectedInvoice.totalAmount.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
      }),
      paid_amount: selectedInvoice.receivedAmount.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
      }),
      balance_amount: selectedInvoice.balance.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
      }),
      transaction_link: `${window.location.origin}/?doc=${selectedInvoice.invoiceNo}`,
      business_mobile: company.phone,
    });
  }, [selectedInvoice, businessSettings.messages.templates, company]);

  if (!isInvoicePreviewOpen || !selectedInvoice) return null;

  const isChallanHiddenPrice =
    selectedInvoice.type === 'Delivery Challan' && !printCfg.showPricesOnChallan;

  const handlePrint = () => {
    logTransactionActivity(selectedInvoice.id, 'Printed', `Printed using ${activeTemplate} template`);
    window.print();
  };

  const handleDownloadPdf = () => {
    exportSingleInvoicePdf(selectedInvoice, company, businessSettings, matchedParty, items);
    logTransactionActivity(selectedInvoice.id, 'Exported', `Exported PDF for #${selectedInvoice.invoiceNo}`);
    showToast(`Document #${selectedInvoice.invoiceNo} PDF generated!`);
  };

  const handleConfirmCancel = () => {
    if (!cancellationReason.trim()) {
      showToast('Please provide a reason for cancellation');
      return;
    }
    const ok = cancelInvoice(selectedInvoice.id, cancellationReason);
    if (ok) {
      setShowCancelPrompt(false);
      setIsInvoicePreviewOpen(false);
    }
  };

  const handleConfirmReverse = () => {
    if (!reversalReason.trim()) {
      showToast('Please provide a reversal reason', 'warning');
      return;
    }
    const rev = reverseTransaction(selectedInvoice.id, reversalReason.trim());
    if (rev) {
      setShowReversePrompt(false);
      setIsInvoicePreviewOpen(false);
    }
  };

  const upiPayload = buildUpiPaymentQrPayload({
    upiId: company.upiId || 'merchant@upi',
    payeeName: company.name,
    amount: selectedInvoice.balance > 0 ? selectedInvoice.balance : selectedInvoice.totalAmount,
    invoiceNo: selectedInvoice.invoiceNo,
  });

  // Deterministic 9x9 visual QR matrix seeded from payload
  const qrCells = Array.from({ length: 81 }, (_, idx) => {
    const r = Math.floor(idx / 9);
    const c = idx % 9;
    const isCorner = (r < 3 && c < 3) || (r < 3 && c > 5) || (r > 5 && c < 3);
    if (isCorner) return (r === 1 && c === 1) || (r === 1 && c === 7) || (r === 7 && c === 1) || r === 0 || r === 2 || r === 6 || r === 8 || c === 0 || c === 2 || c === 6 || c === 8;
    const ch = upiPayload.charCodeAt(idx % upiPayload.length) || 41;
    return ((ch * (idx + 7)) % 3) === 0;
  });

  const phoneDigits = (selectedInvoice.partyPhone || matchedParty?.phone || '')
    .replace(/\D/g, '')
    .slice(-10);
  const waHref = phoneDigits
    ? `https://wa.me/91${phoneDigits}?text=${encodeURIComponent(whatsAppMessage)}`
    : `https://wa.me/?text=${encodeURIComponent(whatsAppMessage)}`;

  const isIntraState = selectedInvoice.gstType === 'Intra-State' || !selectedInvoice.gstType;
  const isThermal = activeTemplate === 'thermal-2' || activeTemplate === 'thermal-3';
  const docTitle =
    selectedInvoice.type === 'Delivery Challan'
      ? printCfg.documentTitles?.['Delivery Challan'] || 'DELIVERY CHALLAN'
      : printCfg.documentTitles?.['Sales Invoice'] ||
        (businessSettings.gst.isGstRegistered ? 'TAX INVOICE' : 'BILL OF SUPPLY');

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-2xs flex items-center justify-center p-3 z-50 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden text-xs text-slate-800">
        {/* Modal Top Actions */}
        <div className="px-5 py-3 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 shrink-0 no-print">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="font-semibold text-sm">Invoice Print &amp; PDF Center</span>
            <span className="text-slate-400 text-xs font-mono">#{selectedInvoice.invoiceNo}</span>
            <span className="text-[10px] font-mono text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded">
              v{selectedInvoice.version || 1}
            </span>
            {selectedInvoice.isReversed && (
              <span className="px-2 py-0.5 rounded bg-amber-900 text-amber-200 border border-amber-700 font-bold uppercase text-[10px]">
                REVERSED
              </span>
            )}
            {selectedInvoice.isCancelled && !selectedInvoice.isReversed && (
              <span className="px-2 py-0.5 rounded bg-rose-900 text-rose-200 border border-rose-700 font-bold uppercase text-[10px]">
                CANCELLED
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 bg-slate-800 p-1 rounded-lg border border-slate-700 text-[11px]">
            {[
              { id: 'gst-tax-invoice', label: 'GST Tax A4' },
              { id: 'modern', label: 'Modern A4' },
              { id: 'classic', label: 'Classic' },
              { id: 'thermal-3', label: 'POS 3"' },
              { id: 'thermal-2', label: 'POS 2"' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setActiveTemplate(t.id as InvoiceTemplateType);
                  setSelectedTemplate(t.id as InvoiceTemplateType);
                }}
                className={`px-2 py-1 rounded font-medium transition-colors cursor-pointer ${
                  activeTemplate === t.id
                    ? 'bg-blue-600 text-white shadow-2xs font-semibold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setShowStampAndQr((v) => !v)}
              title="Toggle UPI QR & Stamp"
              className={`flex items-center gap-1 px-2 py-1 rounded border text-[11px] font-medium cursor-pointer ${
                showStampAndQr
                  ? 'bg-slate-700 text-emerald-300 border-emerald-700/60'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>QR/Stamp</span>
            </button>

            <button
              type="button"
              onClick={() => setShowActivityPanel((v) => !v)}
              className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-medium cursor-pointer"
            >
              <History className="w-3.5 h-3.5" />
              <span>Activity ({selectedInvoice.activityHistory?.length || 0})</span>
            </button>

            {!selectedInvoice.isCancelled && !selectedInvoice.isReversed && (
              <>
                <button
                  type="button"
                  onClick={() => { setShowReversePrompt((v) => !v); setShowCancelPrompt(false); }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-amber-950 text-amber-300 border border-amber-800/60 font-medium cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reverse</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setShowCancelPrompt((v) => !v); setShowReversePrompt(false); }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-rose-950 text-rose-300 border border-rose-800/60 font-medium cursor-pointer"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>Cancel</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={handleDownloadPdf}
              className="flex items-center gap-1.5 px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-medium cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </button>

            <button
              type="button"
              onClick={() => setShowSharePrompt((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-medium cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-white font-medium cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>

            <button
              type="button"
              onClick={() => setIsInvoicePreviewOpen(false)}
              className="text-slate-400 hover:text-white p-1 rounded cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Share Confirmation Strip (Transaction Message Integration) */}
        {showSharePrompt && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-3 space-y-2 no-print">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-900">
                Transaction Message Preview (Configured in Settings)
              </span>
              <button
                type="button"
                onClick={() => setShowSharePrompt(false)}
                className="text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs text-slate-800 bg-white p-2.5 rounded border border-emerald-200 whitespace-pre-wrap">
              {whatsAppMessage}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(whatsAppMessage);
                  logTransactionActivity(selectedInvoice.id, 'Shared', 'Copied WhatsApp invoice message');
                  showToast('Invoice message copied to clipboard.');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-white border border-slate-300 text-xs font-semibold cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Message</span>
              </button>
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => logTransactionActivity(selectedInvoice.id, 'Shared', 'Sent invoice link via WhatsApp')}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Send via WhatsApp</span>
              </a>
            </div>
          </div>
        )}

        {/* Cancellation Prompt */}
        {showCancelPrompt && (
          <div className="bg-rose-50 border-b border-rose-200 px-6 py-3 flex flex-wrap items-center justify-between gap-3 no-print">
            <div className="flex items-center gap-2 text-rose-900">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <div>
                <strong>Confirm Invoice Cancellation:</strong>
                <p className="text-[11px] text-rose-700">
                  Reverses inventory movement and party balance while retaining audit trail.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                className="bg-white border border-rose-300 rounded px-2.5 py-1 text-xs w-64"
              />
              <button
                type="button"
                onClick={handleConfirmCancel}
                className="px-3 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs cursor-pointer"
              >
                Confirm Cancel
              </button>
              <button
                type="button"
                onClick={() => setShowCancelPrompt(false)}
                className="px-3 py-1 rounded bg-white border border-slate-300 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Keep Active
              </button>
            </div>
          </div>
        )}

        {/* Reversal Prompt */}
        {showReversePrompt && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex flex-wrap items-center justify-between gap-3 no-print">
            <div className="flex items-center gap-2 text-amber-900">
              <RotateCcw className="w-4 h-4 text-amber-700 shrink-0" />
              <div>
                <strong>Reverse Invoice (Contra Entry):</strong>
                <p className="text-[11px] text-amber-800">
                  Creates linked reversal voucher #REV-{selectedInvoice.invoiceNo}, restores stock &amp; resets party balance.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                className="bg-white border border-amber-300 rounded px-2.5 py-1 text-xs w-64"
              />
              <button
                type="button"
                onClick={handleConfirmReverse}
                className="px-3 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs cursor-pointer"
              >
                Create Reversal
              </button>
              <button
                type="button"
                onClick={() => setShowReversePrompt(false)}
                className="px-3 py-1 rounded bg-white border border-slate-300 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Activity & Attachments Drawer */}
        {showActivityPanel && (
          <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px] no-print max-h-52 overflow-y-auto">
            <div>
              <div className="font-bold text-slate-800 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-slate-500" />
                <span>Document Activity &amp; Audit History</span>
              </div>
              {(!selectedInvoice.activityHistory || selectedInvoice.activityHistory.length === 0) ? (
                <p className="text-slate-500">No activity recorded yet.</p>
              ) : (
                <div className="space-y-1">
                  {selectedInvoice.activityHistory.map((act) => (
                    <div key={act.id} className="flex justify-between gap-2 bg-white px-2.5 py-1 rounded border border-slate-200">
                      <span><strong>{act.action}</strong> by {act.actor} — {act.details}</span>
                      <span className="text-slate-400 font-mono shrink-0">{new Date(act.timestamp).toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <div className="font-bold text-slate-800 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5 text-slate-500" />
                <span>Attachments &amp; Document Links</span>
              </div>
              <div className="space-y-1">
                {selectedInvoice.uuid && (
                  <div className="text-[10px] font-mono text-slate-500">UUID: {selectedInvoice.uuid}</div>
                )}
                {selectedInvoice.tags && selectedInvoice.tags.length > 0 && (
                  <div className="text-[10px] text-slate-700">Tags: {selectedInvoice.tags.join(', ')}</div>
                )}
                {(selectedInvoice.attachments || []).length === 0 ? (
                  <p className="text-slate-500">No files attached to this transaction.</p>
                ) : (
                  (selectedInvoice.attachments || []).map((att) => (
                    <a
                      key={att.id}
                      href={att.dataUrl}
                      download={att.name}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-white border border-slate-200 text-blue-700 font-semibold mr-2"
                    >
                      <Paperclip className="w-3 h-3" />
                      <span>{att.name}</span>
                    </a>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
        <div
          className={`p-8 overflow-y-auto bg-slate-100 flex justify-center ${
            isThermal ? 'bg-slate-200' : ''
          }`}
          id="printable-invoice"
        >
          {/* TEMPLATE 1: GST TAX INVOICE */}
          {activeTemplate === 'gst-tax-invoice' && (
            <div className="border border-slate-400 rounded-sm p-6 bg-white space-y-4 w-full max-w-3xl shadow-sm text-slate-800">
              <div className="text-center pb-2 border-b border-slate-300">
                <span className="text-[12px] font-bold tracking-widest text-slate-700 uppercase">
                  {docTitle}
                </span>
                {printCfg.customHeaderNote && (
                  <p className="text-[10px] text-slate-500 italic">{printCfg.customHeaderNote}</p>
                )}
              </div>

              <div className="flex justify-between items-start gap-4 pt-1">
                <div className="flex items-start gap-3">
                  {printCfg.showLogo && company.logoDataUrl && (
                    <img
                      src={company.logoDataUrl}
                      alt={company.name}
                      className="w-14 h-14 object-contain rounded border border-slate-200 p-0.5 shrink-0"
                    />
                  )}
                  <div>
                    {printCfg.showBusinessName && (
                      <h1 className="text-lg font-bold text-slate-900 tracking-tight">{company.name}</h1>
                    )}
                    {printCfg.showBusinessAddress && (
                      <p className="text-slate-600 max-w-sm mt-0.5">{company.address}</p>
                    )}
                    {printCfg.showContactInfo && (
                      <p className="text-slate-600 mt-1">
                        <strong>Phone:</strong> {company.phone}
                        {printCfg.showWebsiteEmail && company.email ? ` | Email: ${company.email}` : ''}
                      </p>
                    )}
                    {printCfg.showGstin && (
                      <p className="text-slate-900 font-semibold mt-0.5">
                        GSTIN: {company.gstin} | State: {company.state}
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-right space-y-1 bg-slate-50 p-3 rounded border border-slate-200 shrink-0">
                  <div>
                    <span className="text-slate-500">Invoice No: </span>
                    <strong className="text-slate-900 text-sm">#{selectedInvoice.invoiceNo}</strong>
                  </div>
                  {printCfg.showInvoiceDate && (
                    <div>
                      <span className="text-slate-500">Date: </span>
                      <strong className="text-slate-900">{selectedInvoice.date}</strong>
                    </div>
                  )}
                  {printCfg.showDueDate && (
                    <div>
                      <span className="text-slate-500">Due Date: </span>
                      <strong className="text-slate-900">{selectedInvoice.dueDate}</strong>
                    </div>
                  )}
                  <div>
                    <span className="text-slate-500">Mode: </span>
                    <span className="font-semibold text-blue-700">{selectedInvoice.paymentType}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border border-slate-300 rounded p-3 bg-slate-50/50">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Billed To
                  </span>
                  <div className="font-bold text-slate-900 text-sm">{selectedInvoice.partyName}</div>
                  {selectedInvoice.partyPhone && (
                    <div className="text-slate-600">Contact: {selectedInvoice.partyPhone}</div>
                  )}
                  {printCfg.showCustomerAddress && selectedInvoice.partyAddress && (
                    <div className="text-slate-600">{selectedInvoice.partyAddress}</div>
                  )}
                  {printCfg.showCustomerGstin && selectedInvoice.partyGstin && (
                    <div className="text-slate-800 font-semibold mt-1">
                      GSTIN: {selectedInvoice.partyGstin}
                    </div>
                  )}
                </div>

                <div className="border-l border-slate-200 pl-4 space-y-0.5">
                  {printCfg.showShippingAddress &&
                    (matchedParty?.shippingAddress || selectedInvoice.shippingAddress) && (
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                          Shipped To
                        </span>
                        <div className="text-slate-700">
                          {selectedInvoice.shippingAddress || matchedParty?.shippingAddress}
                        </div>
                      </div>
                    )}
                  {printablePartyCustomFields.map((pf) => (
                    <div key={pf.name} className="text-slate-700 text-[11px]">
                      <strong>{pf.name}:</strong> {pf.value}
                    </div>
                  ))}
                  {selectedInvoice.vehicleNumber && printCfg.showVehicleNumber && (
                    <div className="text-slate-700">
                      <span className="text-slate-500">Vehicle No: </span>
                      <strong className="font-mono">{selectedInvoice.vehicleNumber}</strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-slate-300 rounded overflow-hidden">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 border-b border-slate-300 text-[10px] font-bold uppercase">
                      {printCfg.showSerialNo && <th className="py-2 px-2.5 w-8">#</th>}
                      {printCfg.showItemName && <th className="py-2 px-2.5">Item Description</th>}
                      {printCfg.showHsnSac && <th className="py-2 px-2 w-16">HSN/SAC</th>}
                      {printCfg.showQty && <th className="py-2 px-2 w-14 text-right">Qty</th>}
                      {printCfg.showUnit && <th className="py-2 px-2 w-14">Unit</th>}
                      {!isChallanHiddenPrice && printCfg.showRate && (
                        <th className="py-2 px-2 w-20 text-right">Rate (₹)</th>
                      )}
                      {!isChallanHiddenPrice && printCfg.showDiscountCol && (
                        <th className="py-2 px-2 w-16 text-right">Disc %</th>
                      )}
                      {!isChallanHiddenPrice && printCfg.showGstPercent && (
                        <th className="py-2 px-2 w-14 text-right">GST %</th>
                      )}
                      {!isChallanHiddenPrice && printCfg.showAmount && (
                        <th className="py-2 px-2.5 w-24 text-right">Amount (₹)</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-[11px]">
                    {selectedInvoice.items.map((item, idx) => (
                      <tr key={item.id}>
                        {printCfg.showSerialNo && (
                          <td className="py-2 px-2.5 text-slate-400 font-mono">{idx + 1}</td>
                        )}
                        {printCfg.showItemName && (
                          <td className="py-2 px-2.5 font-medium text-slate-900">
                            <div>{item.name}</div>
                            {printCfg.showAdditionalCustomFields && (() => {
                              const invItem = items.find(
                                (it) =>
                                  it.name.trim().toLowerCase() === item.name.trim().toLowerCase() ||
                                  (item.hsn && it.code === item.hsn)
                              );
                              if (!invItem?.customFields) return null;
                              const printMeta = businessSettings.item.additionalFields
                                .filter((f) => f.enabled && f.showInPrint && invItem.customFields?.[f.id])
                                .map((f) => `${f.name}: ${invItem.customFields?.[f.id]}`);
                              if (printMeta.length === 0) return null;
                              return (
                                <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                                  {printMeta.join(' · ')}
                                </div>
                              );
                            })()}
                          </td>
                        )}
                        {printCfg.showHsnSac && (
                          <td className="py-2 px-2 text-slate-600 font-mono text-[10px]">
                            {item.hsn || '-'}
                          </td>
                        )}
                        {printCfg.showQty && (
                          <td className="py-2 px-2 text-right font-semibold tabular-nums">
                            {item.displayWeightLabel || (isWeightOrVolumeUnit(item.unit) ? formatBaseQtyHuman(item.qty, item.unit) : item.qty)}
                          </td>
                        )}
                        {printCfg.showUnit && (
                          <td className="py-2 px-2 text-slate-600">{item.displayWeightLabel ? '' : item.unit}</td>
                        )}
                        {!isChallanHiddenPrice && printCfg.showRate && (
                          <td className="py-2 px-2 text-right tabular-nums">
                            ₹{item.price.toFixed(2)}{isWeightOrVolumeUnit(item.unit) ? `/${item.unit.toLowerCase()}` : ''}
                          </td>
                        )}
                        {!isChallanHiddenPrice && printCfg.showDiscountCol && (
                          <td className="py-2 px-2 text-right tabular-nums text-slate-500">
                            {item.discountPercent ? `${item.discountPercent}%` : '-'}
                          </td>
                        )}
                        {!isChallanHiddenPrice && printCfg.showGstPercent && (
                          <td className="py-2 px-2 text-right tabular-nums text-slate-600">
                            {item.taxPercent}%
                          </td>
                        )}
                        {!isChallanHiddenPrice && printCfg.showAmount && (
                          <td className="py-2 px-2.5 text-right font-bold text-slate-900 tabular-nums">
                            {item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {!isChallanHiddenPrice && (
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-3">
                    <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">
                        Amount In Words
                      </span>
                      <p className="font-semibold text-slate-800 italic mt-0.5 text-xs">
                        {numberToWords(selectedInvoice.totalAmount)}
                      </p>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded border border-slate-200 text-[11px] space-y-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                        Bank Details
                      </span>
                      <div>Bank: <strong>{company.bankName}</strong> • A/C: <strong className="font-mono">{company.accountNo}</strong></div>
                      <div>IFSC: <strong className="font-mono">{company.ifsc}</strong> • UPI: <strong className="font-mono">{company.upiId}</strong></div>
                    </div>
                  </div>

                  <div className="space-y-1.5 p-3.5 bg-slate-50 rounded border border-slate-200">
                      {printCfg.showTaxDetails && (
                        <>
                          <div className="flex justify-between text-slate-600">
                            <span>Taxable Value:</span>
                            <strong className="tabular-nums">
                              ₹{(selectedInvoice.taxableAmount || selectedInvoice.totalAmount * 0.85).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </strong>
                          </div>
                          {isIntraState ? (
                            <div className="flex justify-between text-slate-600">
                              <span>CGST + SGST:</span>
                              <strong className="tabular-nums">
                                ₹{((selectedInvoice.cgstAmount || 0) + (selectedInvoice.sgstAmount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </strong>
                            </div>
                          ) : (
                            <div className="flex justify-between text-slate-600">
                              <span>IGST:</span>
                              <strong className="tabular-nums">
                                ₹{(selectedInvoice.igstAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </strong>
                            </div>
                          )}
                        </>
                      )}
                      {(selectedInvoice.shippingCharges || 0) > 0 && (
                        <div className="flex justify-between text-slate-600">
                          <span>Shipping Charges:</span>
                          <strong className="tabular-nums">₹{selectedInvoice.shippingCharges!.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                        </div>
                      )}
                      {(selectedInvoice.packagingCharges || 0) > 0 && (
                        <div className="flex justify-between text-slate-600">
                          <span>Packaging Charges:</span>
                          <strong className="tabular-nums">₹{selectedInvoice.packagingCharges!.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                        </div>
                      )}
                      {(selectedInvoice.otherCharges || 0) > 0 && (
                        <div className="flex justify-between text-slate-600">
                          <span>Other Charges:</span>
                          <strong className="tabular-nums">₹{selectedInvoice.otherCharges!.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                        </div>
                      )}
                      {Boolean(selectedInvoice.adjustmentAmount) && (
                        <div className="flex justify-between text-slate-600">
                          <span>Adjustment:</span>
                          <strong className="tabular-nums">₹{selectedInvoice.adjustmentAmount!.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                        </div>
                      )}
                      <div className="flex justify-between text-slate-900 font-bold text-sm pt-2 border-t border-slate-300">
                        <span>Grand Total:</span>
                        <span className="text-base text-blue-700 tabular-nums">
                          ₹{selectedInvoice.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      {printCfg.showPaymentDetails && (
                        <>
                          <div className="flex justify-between text-slate-700">
                            <span>Received:</span>
                            <strong className="tabular-nums">
                              ₹{selectedInvoice.receivedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </strong>
                          </div>
                          {(selectedInvoice.changeReturned || 0) > 0 && (
                            <div className="flex justify-between text-sky-700 text-[11px]">
                              <span>Change Returned:</span>
                              <strong className="tabular-nums">₹{selectedInvoice.changeReturned!.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                            </div>
                          )}
                          <div className="flex justify-between text-slate-900 font-bold pt-1 border-t border-slate-200">
                            <span>Balance Due:</span>
                            <span className={`tabular-nums ${selectedInvoice.balance > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                              ₹{selectedInvoice.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-200 items-end">
                  <div>
                    {printCfg.showTermsAndConditions && (
                      <>
                        <span className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">
                          Terms &amp; Conditions
                        </span>
                        <p className="text-[10px] text-slate-600 leading-relaxed">
                          {businessSettings.transaction.sales.defaultTerms}
                        </p>
                      </>
                    )}
                    {printCfg.customFooterNote && (
                      <p className="text-[10px] font-semibold text-slate-700 mt-1">
                        {printCfg.customFooterNote}
                      </p>
                    )}
                  </div>

                  {showStampAndQr ? (
                    <div className="flex flex-col items-center justify-center text-center">
                      <div
                        title={upiPayload}
                        className="grid grid-cols-9 gap-[1px] p-1 bg-white border border-slate-300 rounded w-16 h-16"
                      >
                        {qrCells.map((filled, idx) => (
                          <div key={idx} className={filled ? 'bg-slate-900' : 'bg-white'} />
                        ))}
                      </div>
                      <span className="text-[9px] font-mono text-slate-500 mt-1">
                        Scan UPI: {company.upiId || 'merchant@upi'}
                      </span>
                    </div>
                  ) : (
                    <div />
                  )}

                  {printCfg.showAuthorizedSignature && (
                    <div className="text-right flex flex-col justify-end items-end">
                      <span className="text-[10px] text-slate-500">For {company.name}</span>
                      {showStampAndQr ? (
                        <div className="my-1.5 px-2.5 py-1 rounded-full border-2 border-blue-700/60 text-blue-800/80 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 -rotate-3">
                          <Stamp className="w-3 h-3" />
                          <span>Verified Seal</span>
                        </div>
                      ) : (
                        <div className="h-10" />
                      )}
                      <span className="border-t border-slate-400 pt-1 text-[11px] font-semibold text-slate-800">
                        Authorized Signatory
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

          {/* TEMPLATE 2: MODERN */}
          {activeTemplate === 'modern' && (
            <div className="border border-slate-300 rounded-lg p-6 bg-white space-y-5 w-full max-w-3xl shadow-sm text-slate-800">
              <div className="flex justify-between items-center pb-4 border-b-2 border-blue-600">
                <div>
                  <h1 className="text-2xl font-black text-blue-700 tracking-tight">{company.name}</h1>
                  <p className="text-slate-500 text-xs">{company.address}</p>
                  <p className="text-slate-600 text-[11px] font-medium">GSTIN: {company.gstin}</p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-slate-900 uppercase tracking-tight block">
                    {docTitle}
                  </span>
                  <span className="text-sm font-bold text-blue-600 font-mono">
                    #{selectedInvoice.invoiceNo}
                  </span>
                  <p className="text-slate-500 text-xs mt-1">Date: {selectedInvoice.date}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg">
                <div>
                  <span className="text-[10px] font-bold text-blue-700 uppercase">Invoiced To</span>
                  <h3 className="text-sm font-bold text-slate-900 mt-0.5">{selectedInvoice.partyName}</h3>
                  <p className="text-slate-600 text-xs">{selectedInvoice.partyAddress || 'Counter Customer'}</p>
                </div>
                <div className="text-right font-bold">
                  <span className={selectedInvoice.balance === 0 ? 'text-emerald-700' : 'text-amber-700'}>
                    {selectedInvoice.balance === 0 ? 'PAID IN FULL' : `DUE: ₹${selectedInvoice.balance.toLocaleString('en-IN')}`}
                  </span>
                </div>
              </div>
              <table className="w-full text-left border border-slate-200 rounded-lg overflow-hidden">
                <thead className="bg-slate-900 text-white text-[10px] uppercase font-bold">
                  <tr>
                    <th className="py-2.5 px-3">Item</th>
                    <th className="py-2.5 px-2 text-right">Qty</th>
                    {!isChallanHiddenPrice && <th className="py-2.5 px-2 text-right">Rate</th>}
                    {!isChallanHiddenPrice && <th className="py-2.5 px-2 text-right">GST</th>}
                    {!isChallanHiddenPrice && <th className="py-2.5 px-3 text-right">Total</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {selectedInvoice.items.map((it) => (
                    <tr key={it.id}>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{it.name}</td>
                      <td className="py-2.5 px-2 text-right font-medium tabular-nums">
                        {it.displayWeightLabel || formatBaseQtyHuman(it.qty, it.unit)}
                      </td>
                      {!isChallanHiddenPrice && (
                        <td className="py-2.5 px-2 text-right tabular-nums">
                          ₹{it.price.toFixed(2)}{isWeightOrVolumeUnit(it.unit) ? `/${it.unit.toLowerCase()}` : ''}
                        </td>
                      )}
                      {!isChallanHiddenPrice && <td className="py-2.5 px-2 text-right tabular-nums">{it.taxPercent}%</td>}
                      {!isChallanHiddenPrice && <td className="py-2.5 px-3 text-right font-bold tabular-nums">₹{it.amount.toLocaleString('en-IN')}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TEMPLATE 3: CLASSIC */}
          {activeTemplate === 'classic' && (
            <div className="border border-slate-400 rounded p-6 bg-white space-y-4 w-full max-w-3xl shadow-sm font-serif text-slate-900">
              <div className="text-center pb-3 border-b-2 border-slate-800">
                <h2 className="text-xl font-bold uppercase tracking-wide">{company.name}</h2>
                <p className="text-xs font-sans text-slate-600">{company.address} • Ph: {company.phone}</p>
                <p className="text-xs font-sans font-semibold">GSTIN: {company.gstin}</p>
              </div>
              <div className="flex justify-between text-xs font-sans py-2">
                <div>
                  <strong>Bill To:</strong> {selectedInvoice.partyName}
                </div>
                <div className="text-right">
                  <div><strong>No:</strong> #{selectedInvoice.invoiceNo}</div>
                  <div><strong>Date:</strong> {selectedInvoice.date}</div>
                </div>
              </div>
              <table className="w-full border-collapse border border-slate-400 text-xs font-sans">
                <thead className="bg-slate-100 font-bold border-b border-slate-400">
                  <tr>
                    <th className="border border-slate-400 py-1.5 px-2 text-left">Item</th>
                    <th className="border border-slate-400 py-1.5 px-2 text-right">Qty</th>
                    {!isChallanHiddenPrice && <th className="border border-slate-400 py-1.5 px-2 text-right">Rate</th>}
                    {!isChallanHiddenPrice && <th className="border border-slate-400 py-1.5 px-2 text-right">Amount</th>}
                  </tr>
                </thead>
                <tbody>
                  {selectedInvoice.items.map((it) => (
                    <tr key={it.id}>
                      <td className="border border-slate-400 py-1 px-2">{it.name}</td>
                      <td className="border border-slate-400 py-1 px-2 text-right tabular-nums">
                        {it.displayWeightLabel || formatBaseQtyHuman(it.qty, it.unit)}
                      </td>
                      {!isChallanHiddenPrice && (
                        <td className="border border-slate-400 py-1 px-2 text-right tabular-nums">
                          ₹{it.price}{isWeightOrVolumeUnit(it.unit) ? `/${it.unit.toLowerCase()}` : ''}
                        </td>
                      )}
                      {!isChallanHiddenPrice && <td className="border border-slate-400 py-1 px-2 text-right font-semibold tabular-nums">₹{it.amount}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TEMPLATE 4 & 5: THERMAL */}
          {isThermal && (
            <div
              className={`bg-white p-4 shadow-md font-mono text-[11px] leading-tight text-black border border-slate-300 ${
                activeTemplate === 'thermal-2' ? 'w-[240px]' : 'w-[320px]'
              }`}
            >
              <div className="text-center space-y-1 pb-2 border-b border-dashed border-black">
                <h3 className="font-bold text-sm uppercase">{company.name}</h3>
                <p className="text-[9px]">{company.address}</p>
                <p className="text-[10px]">Ph: {company.phone}</p>
                {printCfg.showGstin && <p className="text-[10px] font-bold">GST: {company.gstin}</p>}
              </div>
              <div className="py-2 border-b border-dashed border-black text-[10px] space-y-0.5">
                <div className="flex justify-between">
                  <span>BILL: #{selectedInvoice.invoiceNo}</span>
                  <span>{selectedInvoice.date.split(',')[0]}</span>
                </div>
                <div>PARTY: {selectedInvoice.partyName}</div>
              </div>
              <div className="py-2 border-b border-dashed border-black space-y-1">
                {selectedInvoice.items.map((it) => (
                  <div key={it.id} className="flex justify-between items-start">
                    <div className="pr-1">
                      <div>{it.name}</div>
                      <div className="text-[9px] text-slate-600">
                        {it.displayWeightLabel || formatBaseQtyHuman(it.qty, it.unit)} x ₹{it.price}{isWeightOrVolumeUnit(it.unit) ? `/${it.unit.toLowerCase()}` : ''}
                      </div>
                    </div>
                    <div className="font-bold tabular-nums">₹{it.amount}</div>
                  </div>
                ))}
              </div>
              <div className="py-2 border-b border-dashed border-black space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span>TOTAL:</span>
                  <span>₹{selectedInvoice.totalAmount.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span>PAID:</span>
                  <span>₹{selectedInvoice.receivedAmount.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-xs font-bold">
                  <span>BALANCE:</span>
                  <span>₹{selectedInvoice.balance.toLocaleString('en-IN')}</span>
                </div>
              </div>
              <div className="text-center pt-3 text-[10px]">
                <p className="font-bold">{printCfg.customFooterNote || 'Thank you for your business!'}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
