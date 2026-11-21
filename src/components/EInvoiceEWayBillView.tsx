import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import {
  FileCheck2,
  ShieldCheck,
  AlertTriangle,
  Truck,
  QrCode,
  FileDown,
  XCircle,
  RefreshCw,
  KeyRound,
  Activity,
  CheckCircle2,
  X,
} from 'lucide-react';
import { useVyapar } from '../context/VyaparContext';
import { apiClient } from '../utils/apiClient';
import { EInvoiceRecord, GspCredentialStatus, Transaction } from '../types';
import { exportEInvoicePdf } from '../utils/pdfExport';

type EInvTab = 'queue' | 'records' | 'ewaybills' | 'logs' | 'gsp-config';

export const EInvoiceEWayBillView: React.FC = () => {
  const {
    transactions,
    company,
    currentUser,
    eInvoiceRecords,
    eInvoiceLogs,
    eWayBillRecords,
    refreshEInvoiceData,
    showToast,
  } = useVyapar();

  const [activeSubTab, setActiveSubTab] = useState<EInvTab>('queue');
  const [gspStatus, setGspStatus] = useState<GspCredentialStatus | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Pre-submission validation state
  const [validationTarget, setValidationTarget] = useState<Transaction | null>(null);
  const [validationRes, setValidationRes] = useState<{
    eligible: boolean;
    valid: boolean;
    errors: string[];
    warnings: string[];
    placeOfSupplyCode: string | null;
    needsEWayBill: boolean;
  } | null>(null);

  // QR Viewer Modal
  const [qrViewRec, setQrViewRec] = useState<{ rec: EInvoiceRecord; inv?: Transaction; dataUrl: string } | null>(null);

  // Cancel IRN Modal
  const [cancelTarget, setCancelTarget] = useState<EInvoiceRecord | null>(null);
  const [cancelReason, setCancelReason] = useState('1');
  const [cancelRemarks, setCancelRemarks] = useState('Duplicate or erroneous invoice entry');

  // E-Way Bill Generation Modal
  const [ewbTarget, setEwbTarget] = useState<Transaction | null>(null);
  const [ewbForm, setEwbForm] = useState({
    transporterName: '',
    transporterId: '',
    vehicleNumber: '',
    transportMode: 'Road' as 'Road' | 'Rail' | 'Air' | 'Ship',
    distanceKm: 25,
    dispatchLocation: company.address || 'Main Store',
    deliveryLocation: '',
    transportDocNo: '',
    transportDocDate: new Date().toISOString().slice(0, 10),
  });

  // Backend GSP Config Form (Admin/Owner only; secrets sent only to server vault)
  const [gspForm, setGspForm] = useState({
    providerName: 'Authorized GSP (ClearTax / MasterGST / NIC)',
    environment: 'Sandbox' as 'Sandbox' | 'Production',
    sellerGstin: company.gstin || '',
    irpApiUrl: '',
    ewbApiUrl: '',
    clientId: '',
    clientSecret: '',
    username: '',
    password: '',
  });

  const isAdminOrOwner = useMemo(() => {
    const r = (currentUser?.roleName || '').toLowerCase();
    return r.includes('owner') || r.includes('admin') || currentUser?.accountType === 'ADMIN';
  }, [currentUser]);

  const loadStatusAndRecords = async () => {
    await refreshEInvoiceData();
    try {
      const status = await apiClient.getGspStatus();
      setGspStatus(status);
    } catch {
      setGspStatus(null);
    }
  };

  useEffect(() => {
    void loadStatusAndRecords();
  }, []);

  const b2bInvoices = useMemo(() => {
    return transactions.filter(
      (t) =>
        t.type === 'Sale' &&
        !t.isCancelled &&
        Boolean(t.partyGstin && t.partyGstin.trim().length >= 15)
    );
  }, [transactions]);

  const highValueInvoices = useMemo(() => {
    return transactions.filter(
      (t) => t.type === 'Sale' && !t.isCancelled && (t.totalAmount || 0) >= 50000
    );
  }, [transactions]);

  const getLatestEInvForTx = (txId: string) =>
    eInvoiceRecords.find((r) => r.transactionId === txId && r.status === 'GENERATED') ||
    eInvoiceRecords.find((r) => r.transactionId === txId);

  const handleValidate = async (tx: Transaction) => {
    setBusyId(tx.id);
    try {
      const res = await apiClient.validateEInvoice({
        invoice: tx,
        sellerGstin: company.gstin,
        sellerAddress: company.address,
        sellerState: company.state,
      });
      setValidationTarget(tx);
      setValidationRes(res);
    } catch (err: any) {
      showToast(err?.message || 'Validation failed.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleGenerateIrn = async (tx: Transaction) => {
    setBusyId(tx.id);
    try {
      const res = await apiClient.generateEInvoice({
        invoice: tx,
        sellerProfile: company,
      });
      await refreshEInvoiceData();
      showToast(`IRN generated: ${res.record?.irn}`, 'success');
    } catch (err: any) {
      await refreshEInvoiceData();
      showToast(err?.message || 'GSP/IRP submission failed.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleViewQrAndPdf = async (rec: EInvoiceRecord) => {
    if (!rec.signedQrCode) {
      showToast('No signed QR payload available on this record.', 'warning');
      return;
    }
    try {
      const dataUrl = await QRCode.toDataURL(rec.signedQrCode, { width: 240, margin: 1 });
      const inv = transactions.find((t) => t.id === rec.transactionId);
      setQrViewRec({ rec, inv, dataUrl });
    } catch {
      showToast('Failed to render signed QR image.', 'error');
    }
  };

  const handleConfirmCancelIrn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelTarget) return;
    setBusyId(cancelTarget.id);
    try {
      await apiClient.cancelEInvoice(cancelTarget.id, cancelReason, cancelRemarks);
      await refreshEInvoiceData();
      showToast(`IRN for Invoice #${cancelTarget.invoiceNo} cancelled.`, 'success');
      setCancelTarget(null);
    } catch (err: any) {
      await refreshEInvoiceData();
      showToast(err?.message || 'IRN cancellation failed.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const openEwbModal = (tx: Transaction) => {
    setEwbTarget(tx);
    setEwbForm({
      transporterName: tx.transporterName || '',
      transporterId: '',
      vehicleNumber: tx.vehicleNumber || '',
      transportMode: 'Road',
      distanceKm: 25,
      dispatchLocation: company.address || 'Main Store',
      deliveryLocation: tx.shippingAddress || tx.partyAddress || '',
      transportDocNo: '',
      transportDocDate: new Date().toISOString().slice(0, 10),
    });
  };

  const handleGenerateEwb = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ewbTarget) return;
    const eInv = getLatestEInvForTx(ewbTarget.id);
    setBusyId(ewbTarget.id);
    try {
      const res = await apiClient.generateEWayBill({
        invoice: ewbTarget,
        transport: {
          ...ewbForm,
          irn: eInv?.status === 'GENERATED' ? eInv.irn : undefined,
        },
      });
      await refreshEInvoiceData();
      showToast(`E-Way Bill generated: ${res.record?.ewbNo}`, 'success');
      setEwbTarget(null);
    } catch (err: any) {
      await refreshEInvoiceData();
      showToast(err?.message || 'E-Way Bill generation failed.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleSaveGspConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiClient.saveGspConfig(gspForm);
      showToast(res.message || 'GSP configuration saved on server.', 'success');
      await loadStatusAndRecords();
      setGspForm((p) => ({ ...p, clientSecret: '', password: '' }));
    } catch (err: any) {
      showToast(err?.message || 'Failed to save GSP credentials.', 'error');
    }
  };

  const kpis = useMemo(() => {
    const generated = eInvoiceRecords.filter((r) => r.status === 'GENERATED').length;
    const failed = eInvoiceRecords.filter((r) => r.status === 'FAILED').length;
    const ewbActive = eWayBillRecords.filter((r) => r.status === 'GENERATED').length;
    return {
      b2bEligible: b2bInvoices.length,
      generated,
      failed,
      ewbActive,
    };
  }, [b2bInvoices, eInvoiceRecords, eWayBillRecords]);

  return (
    <div className="flex-1 flex flex-col bg-[#f5f6fa] dark:bg-slate-950 overflow-y-auto text-xs text-slate-800 dark:text-slate-100">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-slate-800 text-white flex items-center justify-center">
            <FileCheck2 className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-white">
              GST E-Invoice (NIC IRP) &amp; E-Way Bill Portal
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Pre-submission GSTIN/HSN validation, authorized GSP gateway submission, signed QR rendering &amp; E-Way Bill dispatch
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-right mr-2">
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">GSP Gateway</div>
            <div className={`text-xs font-bold ${gspStatus?.configured ? 'text-emerald-600' : 'text-amber-600'}`}>
              {gspStatus?.configured ? `${gspStatus.providerName} (${gspStatus.environment})` : 'Not Configured on Server'}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadStatusAndRecords()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 font-semibold cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sync Logs</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="px-6 pt-4 grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
          <div className="text-[11px] text-slate-500 font-medium">B2B Eligible Invoices</div>
          <div className="text-xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-1">
            {kpis.b2bEligible}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
          <div className="text-[11px] text-slate-500 font-medium">IRN Generated</div>
          <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums mt-1">
            {kpis.generated}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
          <div className="text-[11px] text-slate-500 font-medium">Failed / Rejected Attempts</div>
          <div className="text-xl font-extrabold text-rose-600 dark:text-rose-400 tabular-nums mt-1">
            {kpis.failed}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
          <div className="text-[11px] text-slate-500 font-medium">E-Way Bills Active</div>
          <div className="text-xl font-extrabold text-blue-600 dark:text-blue-400 tabular-nums mt-1">
            {kpis.ewbActive}
          </div>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="px-6 pt-4 flex items-center gap-2 overflow-x-auto shrink-0">
        {[
          { id: 'queue', label: 'B2B Invoice Queue', icon: ShieldCheck },
          { id: 'records', label: `IRN Registry (${eInvoiceRecords.length})`, icon: QrCode },
          { id: 'ewaybills', label: `E-Way Bills (${eWayBillRecords.length})`, icon: Truck },
          { id: 'logs', label: `IRP API Logs (${eInvoiceLogs.length})`, icon: Activity },
          ...(isAdminOrOwner ? [{ id: 'gsp-config', label: 'Backend GSP Config', icon: KeyRound }] : []),
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSubTab(tab.id as EInvTab)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-bold text-xs cursor-pointer whitespace-nowrap transition-colors ${
                active
                  ? 'bg-slate-900 dark:bg-emerald-600 text-white'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Body */}
      <div className="p-6 flex-1 space-y-4">
        {!gspStatus?.configured && activeSubTab !== 'gsp-config' && (
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-amber-900 dark:text-amber-200">
                  Authorized GSP / NIC IRP Credentials Required for Live IRN Generation
                </div>
                <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">
                  Pre-submission GSTIN/HSN validation works immediately. Live IRN/EWB submission never fabricates dummy government numbers and requires authorized GSP credentials configured on the backend server.
                </p>
              </div>
            </div>
            {isAdminOrOwner && (
              <button
                type="button"
                onClick={() => setActiveSubTab('gsp-config')}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs cursor-pointer whitespace-nowrap"
              >
                Configure Server GSP
              </button>
            )}
          </div>
        )}

        {/* TAB 1: B2B Queue */}
        {activeSubTab === 'queue' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto">
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <span className="font-bold text-slate-900 dark:text-white">
                  Eligible B2B Sales Invoices (Buyer GSTIN Present)
                </span>
                <span className="text-[11px] text-slate-500">
                  Invoices ≥ ₹50,000 also qualify for E-Way Bill dispatch
                </span>
              </div>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                    <th className="py-2.5 px-4">Invoice #</th>
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Buyer &amp; GSTIN</th>
                    <th className="py-2.5 px-4 text-right">Taxable</th>
                    <th className="py-2.5 px-4 text-right">Total (₹)</th>
                    <th className="py-2.5 px-4">IRN Status</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {b2bInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-500">
                        No B2B sale invoices with a 15-character Buyer GSTIN found yet. B2C retail bills are excluded per GST rules.
                      </td>
                    </tr>
                  ) : (
                    b2bInvoices.map((inv) => {
                      const rec = getLatestEInvForTx(inv.id);
                      const isGenerated = rec?.status === 'GENERATED';
                      return (
                        <tr key={inv.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                          <td className="py-3 px-4 font-mono font-bold">#{inv.invoiceNo}</td>
                          <td className="py-3 px-4 text-slate-500 tabular-nums">{inv.date}</td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900 dark:text-white">{inv.partyName}</div>
                            <div className="text-[11px] font-mono text-slate-500">{inv.partyGstin}</div>
                          </td>
                          <td className="py-3 px-4 text-right tabular-nums">
                            ₹{(inv.taxableAmount || inv.subtotal || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-4 text-right font-bold tabular-nums">
                            ₹{inv.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            {inv.totalAmount >= 50000 && (
                              <div className="text-[10px] text-amber-600 font-semibold">E-Way Req.</div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {isGenerated ? (
                              <div className="text-emerald-600 font-bold">
                                IRN Generated
                                <div className="text-[10px] font-mono text-slate-500 truncate max-w-[140px]">
                                  {rec.irn}
                                </div>
                              </div>
                            ) : rec?.status === 'FAILED' ? (
                              <div className="text-rose-600 font-bold">Failed</div>
                            ) : (
                              <span className="text-slate-500 font-semibold">Pending</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                disabled={busyId === inv.id}
                                onClick={() => void handleValidate(inv)}
                                className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-[11px] cursor-pointer whitespace-nowrap"
                              >
                                Validate
                              </button>
                              {!isGenerated && (
                                <button
                                  type="button"
                                  disabled={busyId === inv.id}
                                  onClick={() => void handleGenerateIrn(inv)}
                                  className="px-2.5 py-1 rounded bg-[#8E0E20] hover:bg-[#740918] text-white font-bold text-[11px] cursor-pointer whitespace-nowrap disabled:opacity-50"
                                >
                                  {busyId === inv.id ? 'Submitting...' : 'Generate IRN'}
                                </button>
                              )}
                              {isGenerated && rec && (
                                <button
                                  type="button"
                                  onClick={() => void handleViewQrAndPdf(rec)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] cursor-pointer whitespace-nowrap"
                                >
                                  <QrCode className="w-3 h-3" />
                                  <span>QR &amp; PDF</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => openEwbModal(inv)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/30 font-semibold text-[11px] cursor-pointer whitespace-nowrap"
                              >
                                <Truck className="w-3 h-3" />
                                <span>E-Way Bill</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {highValueInvoices.length > 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                <div className="font-bold text-slate-900 dark:text-white mb-2">
                  High-Value Consignments (≥ ₹50,000) — E-Way Bill Eligibility
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {highValueInvoices.map((inv) => (
                    <div
                      key={inv.id}
                      className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2"
                    >
                      <div>
                        <div className="font-bold">#{inv.invoiceNo} · {inv.partyName}</div>
                        <div className="text-[11px] text-slate-500 tabular-nums">
                          ₹{inv.totalAmount.toLocaleString('en-IN')} · {inv.date}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => openEwbModal(inv)}
                        className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] cursor-pointer whitespace-nowrap"
                      >
                        Create EWB
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: IRN Registry */}
        {activeSubTab === 'records' && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                  <th className="py-2.5 px-4">Invoice #</th>
                  <th className="py-2.5 px-4">Party &amp; GSTIN</th>
                  <th className="py-2.5 px-4">IRN / Ack No</th>
                  <th className="py-2.5 px-4 text-right">Amount</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {eInvoiceRecords.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-500">
                      No IRN submissions recorded yet.
                    </td>
                  </tr>
                ) : (
                  eInvoiceRecords.map((rec) => (
                    <tr key={rec.id}>
                      <td className="py-3 px-4 font-mono font-bold">#{rec.invoiceNo}</td>
                      <td className="py-3 px-4">
                        <div className="font-semibold">{rec.partyName}</div>
                        <div className="text-[11px] font-mono text-slate-500">{rec.buyerGstin}</div>
                      </td>
                      <td className="py-3 px-4">
                        {rec.irn ? (
                          <div>
                            <div className="font-mono text-[11px] font-bold">{rec.irn}</div>
                            <div className="text-[10px] text-slate-500">
                              Ack: {rec.ackNo} · {rec.ackDate}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[11px] text-rose-600">{rec.errorMessage || 'No IRN'}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-bold tabular-nums">
                        ₹{(rec.totalAmount || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`font-bold text-[11px] ${
                            rec.status === 'GENERATED'
                              ? 'text-emerald-600'
                              : rec.status === 'CANCELLED'
                              ? 'text-slate-500'
                              : 'text-rose-600'
                          }`}
                        >
                          {rec.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {rec.status === 'GENERATED' && (
                            <>
                              <button
                                type="button"
                                onClick={() => void handleViewQrAndPdf(rec)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] cursor-pointer whitespace-nowrap"
                              >
                                <QrCode className="w-3 h-3" />
                                <span>QR / PDF</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setCancelTarget(rec)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-rose-300 text-rose-600 hover:bg-rose-50 font-semibold text-[11px] cursor-pointer whitespace-nowrap"
                              >
                                <XCircle className="w-3 h-3" />
                                <span>Cancel IRN</span>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 3: E-Way Bills */}
        {activeSubTab === 'ewaybills' && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                  <th className="py-2.5 px-4">Invoice #</th>
                  <th className="py-2.5 px-4">Party</th>
                  <th className="py-2.5 px-4">EWB No &amp; Validity</th>
                  <th className="py-2.5 px-4">Transport / Vehicle</th>
                  <th className="py-2.5 px-4 text-right">Distance</th>
                  <th className="py-2.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {eWayBillRecords.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-500">
                      No E-Way Bills generated yet.
                    </td>
                  </tr>
                ) : (
                  eWayBillRecords.map((ewb) => (
                    <tr key={ewb.id}>
                      <td className="py-3 px-4 font-mono font-bold">#{ewb.invoiceNo}</td>
                      <td className="py-3 px-4 font-semibold">{ewb.partyName}</td>
                      <td className="py-3 px-4">
                        {ewb.ewbNo ? (
                          <div>
                            <div className="font-mono font-bold text-emerald-700">{ewb.ewbNo}</div>
                            <div className="text-[10px] text-slate-500">Valid upto: {ewb.validUpto || 'N/A'}</div>
                          </div>
                        ) : (
                          <span className="text-[11px] text-rose-600">{ewb.errorMessage || 'Pending/Failed'}</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-mono font-semibold">{ewb.vehicleNumber || '-'}</div>
                        <div className="text-[11px] text-slate-500">
                          {ewb.transportMode} · {ewb.transporterName}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums">{ewb.distanceKm} km</td>
                      <td className="py-3 px-4 font-bold">{ewb.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 4: API Logs */}
        {activeSubTab === 'logs' && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                  <th className="py-2.5 px-4">Timestamp</th>
                  <th className="py-2.5 px-4">Action</th>
                  <th className="py-2.5 px-4">Invoice #</th>
                  <th className="py-2.5 px-4">HTTP</th>
                  <th className="py-2.5 px-4">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {eInvoiceLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-500">
                      No IRP / E-Way Bill API calls logged yet.
                    </td>
                  </tr>
                ) : (
                  eInvoiceLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500">{log.timestamp}</td>
                      <td className="py-2.5 px-4 font-bold">{log.action}</td>
                      <td className="py-2.5 px-4 font-mono">#{log.invoiceNo}</td>
                      <td className="py-2.5 px-4 font-mono font-bold">
                        <span className={log.success ? 'text-emerald-600' : 'text-rose-600'}>
                          {log.statusCode}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300">{log.message}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 5: Backend GSP Config (Admin/Owner Only) */}
        {activeSubTab === 'gsp-config' && isAdminOrOwner && (
          <form
            onSubmit={handleSaveGspConfig}
            className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 max-w-3xl space-y-4"
          >
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Backend Authorized GSP / NIC IRP Gateway Credentials
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Credentials are encrypted with AES-256-GCM inside server storage (`./data/gsp-vault.json`) and never stored in browser storage.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold mb-1">GSP Provider Name</label>
                <input
                  type="text"
                  value={gspForm.providerName}
                  onChange={(e) => setGspForm((p) => ({ ...p, providerName: e.target.value }))}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold mb-1">Environment</label>
                <select
                  value={gspForm.environment}
                  onChange={(e) => setGspForm((p) => ({ ...p, environment: e.target.value as any }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
                >
                  <option value="Sandbox">Sandbox</option>
                  <option value="Production">Production</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold mb-1">Seller GSTIN</label>
                <input
                  type="text"
                  maxLength={15}
                  value={gspForm.sellerGstin}
                  onChange={(e) => setGspForm((p) => ({ ...p, sellerGstin: e.target.value.toUpperCase() }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono uppercase"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold mb-1">IRP E-Invoice Endpoint URL *</label>
                <input
                  type="url"
                  required
                  value={gspForm.irpApiUrl}
                  onChange={(e) => setGspForm((p) => ({ ...p, irpApiUrl: e.target.value }))}
                  placeholder="https://api-sandbox.your-gsp.in/eicore/v1.03/Invoice"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold mb-1">E-Way Bill Endpoint URL</label>
                <input
                  type="url"
                  value={gspForm.ewbApiUrl}
                  onChange={(e) => setGspForm((p) => ({ ...p, ewbApiUrl: e.target.value }))}
                  placeholder="Optional (defaults to IRP host)"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold mb-1">GSP Client ID *</label>
                <input
                  type="text"
                  required
                  value={gspForm.clientId}
                  onChange={(e) => setGspForm((p) => ({ ...p, clientId: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold mb-1">GSP Client Secret *</label>
                <input
                  type="password"
                  required
                  value={gspForm.clientSecret}
                  onChange={(e) => setGspForm((p) => ({ ...p, clientSecret: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold mb-1">NIC Portal API Username</label>
                <input
                  type="text"
                  value={gspForm.username}
                  onChange={(e) => setGspForm((p) => ({ ...p, username: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold mb-1">NIC Portal API Password</label>
                <input
                  type="password"
                  value={gspForm.password}
                  onChange={(e) => setGspForm((p) => ({ ...p, password: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="px-5 py-2 rounded-lg bg-[#8E0E20] hover:bg-[#740918] text-white font-bold cursor-pointer"
              >
                Encrypt &amp; Save Server GSP Config
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Validation Result Modal */}
      {validationTarget && validationRes && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {validationRes.valid ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                )}
                <h3 className="text-sm font-bold">
                  Pre-Submission Validation — Invoice #{validationTarget.invoiceNo}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setValidationTarget(null)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs space-y-2">
              <div className="flex justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800">
                <span>Place of Supply Code</span>
                <strong className="font-mono">{validationRes.placeOfSupplyCode || 'Missing'}</strong>
              </div>
              <div className="flex justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800">
                <span>E-Way Bill Required (≥ ₹50,000)</span>
                <strong>{validationRes.needsEWayBill ? 'Yes' : 'No'}</strong>
              </div>

              {validationRes.errors.length > 0 && (
                <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 space-y-1">
                  <div className="font-bold text-rose-700 dark:text-rose-300">Blocking Errors</div>
                  {validationRes.errors.map((err, i) => (
                    <div key={i} className="text-rose-700 dark:text-rose-300">
                      • {err}
                    </div>
                  ))}
                </div>
              )}

              {validationRes.warnings.length > 0 && (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-1">
                  <div className="font-bold text-amber-800 dark:text-amber-300">Warnings</div>
                  {validationRes.warnings.map((w, i) => (
                    <div key={i} className="text-amber-800 dark:text-amber-300">
                      • {w}
                    </div>
                  ))}
                </div>
              )}

              {validationRes.valid && (
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-semibold">
                  All NIC schema, GSTIN, and HSN checks passed. Ready for GSP submission.
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setValidationTarget(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold cursor-pointer"
              >
                Close
              </button>
              {validationRes.valid && (
                <button
                  type="button"
                  onClick={() => {
                    const t = validationTarget;
                    setValidationTarget(null);
                    void handleGenerateIrn(t);
                  }}
                  className="px-4 py-2 rounded-lg bg-[#8E0E20] hover:bg-[#740918] text-white font-bold cursor-pointer"
                >
                  Submit to IRP
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Signed QR & E-Invoice PDF Modal */}
      {qrViewRec && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md p-6 space-y-4 text-center">
            <div className="flex items-center justify-between text-left">
              <h3 className="text-sm font-bold">Signed IRP QR Code — #{qrViewRec.rec.invoiceNo}</h3>
              <button
                type="button"
                onClick={() => setQrViewRec(null)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <img
              src={qrViewRec.dataUrl}
              alt="NIC Signed E-Invoice QR"
              className="w-52 h-52 mx-auto border border-slate-200 rounded-lg p-2 bg-white"
            />
            <div className="text-left text-[11px] space-y-1 bg-slate-50 dark:bg-slate-800 p-3 rounded-lg font-mono break-all">
              <div>
                <strong>IRN:</strong> {qrViewRec.rec.irn}
              </div>
              <div>
                <strong>Ack No:</strong> {qrViewRec.rec.ackNo} ({qrViewRec.rec.ackDate})
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setQrViewRec(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold cursor-pointer"
              >
                Close
              </button>
              {qrViewRec.inv && (
                <button
                  type="button"
                  onClick={() =>
                    exportEInvoicePdf(qrViewRec.inv!, qrViewRec.rec, company, qrViewRec.dataUrl)
                  }
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                >
                  <FileDown className="w-4 h-4" />
                  <span>Download E-Invoice PDF</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cancel IRN Modal */}
      {cancelTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-rose-600">
                Cancel IRN (24-Hour NIC Window) — #{cancelTarget.invoiceNo}
              </h3>
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleConfirmCancelIrn} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold mb-1">NIC Cancellation Reason Code</label>
                <select
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <option value="1">1 - Duplicate</option>
                  <option value="2">2 - Data Entry Mistake</option>
                  <option value="3">3 - Order Cancelled</option>
                  <option value="4">4 - Others</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold mb-1">Cancellation Remarks</label>
                <input
                  type="text"
                  required
                  value={cancelRemarks}
                  onChange={(e) => setCancelRemarks(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCancelTarget(null)}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold cursor-pointer"
                >
                  Keep IRN
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer"
                >
                  Confirm IRN Cancellation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* E-Way Bill Modal */}
      {ewbTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Generate E-Way Bill — Invoice #{ewbTarget.invoiceNo}</h3>
                <p className="text-[11px] text-slate-500">
                  Party: {ewbTarget.partyName} · Value: ₹{ewbTarget.totalAmount.toLocaleString('en-IN')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEwbTarget(null)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleGenerateEwb} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold mb-1">Transport Mode</label>
                  <select
                    value={ewbForm.transportMode}
                    onChange={(e) => setEwbForm((p) => ({ ...p, transportMode: e.target.value as any }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    <option value="Road">Road</option>
                    <option value="Rail">Rail</option>
                    <option value="Air">Air</option>
                    <option value="Ship">Ship</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold mb-1">Distance (km) *</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={ewbForm.distanceKm}
                    onChange={(e) => setEwbForm((p) => ({ ...p, distanceKm: Math.max(1, Number(e.target.value)) }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold mb-1">Vehicle Number *</label>
                  <input
                    type="text"
                    required
                    value={ewbForm.vehicleNumber}
                    onChange={(e) => setEwbForm((p) => ({ ...p, vehicleNumber: e.target.value.toUpperCase() }))}
                    placeholder="KA01AB1234"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold mb-1">Transporter Name</label>
                  <input
                    type="text"
                    value={ewbForm.transporterName}
                    onChange={(e) => setEwbForm((p) => ({ ...p, transporterName: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold mb-1">Transporter GSTIN / ID</label>
                  <input
                    type="text"
                    maxLength={15}
                    value={ewbForm.transporterId}
                    onChange={(e) => setEwbForm((p) => ({ ...p, transporterId: e.target.value.toUpperCase() }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold mb-1">LR / Transport Doc No</label>
                  <input
                    type="text"
                    value={ewbForm.transportDocNo}
                    onChange={(e) => setEwbForm((p) => ({ ...p, transportDocNo: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[11px] font-semibold mb-1">Delivery Location *</label>
                  <input
                    type="text"
                    required
                    value={ewbForm.deliveryLocation}
                    onChange={(e) => setEwbForm((p) => ({ ...p, deliveryLocation: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEwbTarget(null)}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer"
                >
                  Submit E-Way Bill to GSP
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
