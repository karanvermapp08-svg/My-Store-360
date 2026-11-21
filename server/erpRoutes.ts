import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import {
  INDIA_HSN_SAC_MASTER,
  isValidGstin,
  isValidHsnOrSac,
  extractStateCodeFromGstin,
  searchHsnMaster,
} from '../src/data/hsnMasterIndia.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '..', 'data');
const ERP_STATE_FILE = path.resolve(DATA_DIR, 'erp-records.json');
const GSP_VAULT_FILE = path.resolve(DATA_DIR, 'gsp-vault.json');

interface EncryptedGspVault {
  providerName: string;
  environment: 'Sandbox' | 'Production';
  sellerGstin: string;
  irpApiUrl: string;
  ewbApiUrl: string;
  iv: string;
  authTag: string;
  encryptedSecrets: string;
  updatedAt: string;
}

interface ErpPersistedData {
  purchaseScans: any[];
  customHsnEntries: any[];
  gstAudits: any[];
  eInvoiceRecords: any[];
  eInvoiceLogs: any[];
  eWayBillRecords: any[];
  sharedQuotations: Record<string, any>;
  backups: Array<{ id: string; createdAt: string; label: string; snapshot: any }>;
  businessSettings?: any;
  partyGroups?: any[];
  serviceReminders?: any[];
  settingsAuditLogs?: any[];
}

const DEFAULT_ERP_DATA: ErpPersistedData = {
  purchaseScans: [],
  customHsnEntries: [],
  gstAudits: [],
  eInvoiceRecords: [],
  eInvoiceLogs: [],
  eWayBillRecords: [],
  sharedQuotations: {},
  backups: [],
  businessSettings: null,
  partyGroups: [],
  serviceReminders: [],
  settingsAuditLogs: [],
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadErpData(): ErpPersistedData {
  try {
    ensureDataDir();
    if (!fs.existsSync(ERP_STATE_FILE)) return { ...DEFAULT_ERP_DATA };
    const raw = fs.readFileSync(ERP_STATE_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_ERP_DATA, ...parsed };
  } catch {
    return { ...DEFAULT_ERP_DATA };
  }
}

function saveErpData(data: ErpPersistedData) {
  ensureDataDir();
  fs.writeFileSync(ERP_STATE_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function getVaultKey(): Buffer {
  const secretSource =
    process.env.ERP_CREDENTIAL_SECRET ||
    `${process.cwd()}::BM360_GSP_VAULT_KEY_V1`;
  return crypto.createHash('sha256').update(secretSource).digest();
}

function saveEncryptedGspVault(input: {
  providerName: string;
  environment: 'Sandbox' | 'Production';
  sellerGstin: string;
  irpApiUrl: string;
  ewbApiUrl: string;
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
}) {
  ensureDataDir();
  const key = getVaultKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const secretPayload = JSON.stringify({
    clientId: input.clientId,
    clientSecret: input.clientSecret,
    username: input.username,
    password: input.password,
  });
  let encrypted = cipher.update(secretPayload, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag().toString('base64');

  const vault: EncryptedGspVault = {
    providerName: input.providerName,
    environment: input.environment,
    sellerGstin: input.sellerGstin.toUpperCase(),
    irpApiUrl: input.irpApiUrl.trim(),
    ewbApiUrl: input.ewbApiUrl.trim(),
    iv: iv.toString('base64'),
    authTag,
    encryptedSecrets: encrypted,
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(GSP_VAULT_FILE, JSON.stringify(vault, null, 2), 'utf-8');
  return vault;
}

function loadDecryptedGspCredentials(): {
  configured: boolean;
  providerName: string;
  environment: 'Sandbox' | 'Production';
  sellerGstin: string;
  irpApiUrl: string;
  ewbApiUrl: string;
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
  updatedAt?: string;
} {
  // 1. Prefer Environment Variables first
  if (
    process.env.IRP_API_URL &&
    process.env.IRP_CLIENT_ID &&
    process.env.IRP_CLIENT_SECRET
  ) {
    return {
      configured: true,
      providerName: process.env.IRP_PROVIDER_NAME || 'Environment GSP/IRP',
      environment: process.env.IRP_ENV === 'Production' ? 'Production' : 'Sandbox',
      sellerGstin: process.env.IRP_SELLER_GSTIN || '',
      irpApiUrl: process.env.IRP_API_URL,
      ewbApiUrl: process.env.EWB_API_URL || process.env.IRP_API_URL,
      clientId: process.env.IRP_CLIENT_ID,
      clientSecret: process.env.IRP_CLIENT_SECRET,
      username: process.env.IRP_USERNAME || '',
      password: process.env.IRP_PASSWORD || '',
    };
  }

  // 2. Fallback to Encrypted Server Vault
  try {
    if (!fs.existsSync(GSP_VAULT_FILE)) {
      return {
        configured: false,
        providerName: 'Not Configured',
        environment: 'Sandbox',
        sellerGstin: '',
        irpApiUrl: '',
        ewbApiUrl: '',
        clientId: '',
        clientSecret: '',
        username: '',
        password: '',
      };
    }
    const vault: EncryptedGspVault = JSON.parse(fs.readFileSync(GSP_VAULT_FILE, 'utf-8'));
    const key = getVaultKey();
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(vault.iv, 'base64')
    );
    decipher.setAuthTag(Buffer.from(vault.authTag, 'base64'));
    let decrypted = decipher.update(vault.encryptedSecrets, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    const secrets = JSON.parse(decrypted);
    const configured = Boolean(vault.irpApiUrl && secrets.clientId && secrets.clientSecret);
    return {
      configured,
      providerName: vault.providerName,
      environment: vault.environment,
      sellerGstin: vault.sellerGstin,
      irpApiUrl: vault.irpApiUrl,
      ewbApiUrl: vault.ewbApiUrl || vault.irpApiUrl,
      clientId: secrets.clientId || '',
      clientSecret: secrets.clientSecret || '',
      username: secrets.username || '',
      password: secrets.password || '',
      updatedAt: vault.updatedAt,
    };
  } catch {
    return {
      configured: false,
      providerName: 'Vault Error',
      environment: 'Sandbox',
      sellerGstin: '',
      irpApiUrl: '',
      ewbApiUrl: '',
      clientId: '',
      clientSecret: '',
      username: '',
      password: '',
    };
  }
}

export function createErpRouter(
  authenticate: (req: Request, res: Response, next: NextFunction) => void,
  requireRole: (roles: string[]) => (req: Request, res: Response, next: NextFunction) => void
) {
  const router = express.Router();
  let erpData = loadErpData();

  // ============================================================================
  // MODULE 1: AI PURCHASE BILL SCANNER (Server-Side Gemini 4 Hydrogen Vision OCR)
  // ============================================================================
  router.post('/purchase-scans/extract', authenticate, async (req: Request, res: Response) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
        return res.status(503).json({
          error:
            'GEMINI_API_KEY is not configured in server secrets. Please set your Gemini API key in Settings > Secrets to scan supplier bills.',
        });
      }

      const { files } = req.body || {};
      if (!Array.isArray(files) || files.length === 0) {
        return res.status(400).json({ error: 'At least one invoice image or PDF file is required.' });
      }

      const parts: Array<
        { inlineData: { mimeType: string; data: string } } | { text: string }
      > = [];

      for (const f of files.slice(0, 6)) {
        const mimeType = String(f.mimeType || 'image/jpeg');
        const rawBase64 = String(f.base64Data || '').replace(/^data:[^;]+;base64,/, '');
        if (!rawBase64) continue;
        parts.push({
          inlineData: {
            mimeType,
            data: rawBase64,
          },
        });
      }

      if (parts.length === 0) {
        return res.status(400).json({ error: 'No valid image or PDF content found in upload.' });
      }

      parts.push({
        text: `You are an expert Indian GST & Kirana/Wholesale Purchase Invoice OCR Extractor.
Extract every field accurately from the attached supplier invoice image(s)/PDF(s).
Rules:
- Read GSTIN, Supplier Name, Address, Phone, Invoice Number, Invoice Date, Due Date, and PO Number exactly as printed.
- For each line item extract: product name, brand (if identifiable), HSN code (digits only if printed, otherwise empty string — do NOT guess HSN if not printed), barcode/EAN (if printed), billed quantity, free quantity (scheme/bonus qty if printed, else 0), unit (PCS, KGS, LTR, BOX, PAC, BOT, etc.), packageSize (e.g. "1kg", "500ml" if present), unit purchase rate/price, discount percent, discount amount, taxable value, GST rate (percentage printed on invoice e.g. 5, 12, 18, 28, or 0), CGST amount, SGST amount, IGST amount, total line amount, batch number, and expiry date (YYYY-MM-DD or MM/YY if printed).
- Detect whether GST on the invoice is Intra-State (CGST+SGST) or Inter-State (IGST).
- Do not invent line items not visible on the bill. Use 0 for missing numeric fields and "" for missing text fields.`,
      });

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: { parts },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              supplierName: { type: Type.STRING },
              supplierGstin: { type: Type.STRING },
              supplierAddress: { type: Type.STRING },
              supplierPhone: { type: Type.STRING },
              invoiceNumber: { type: Type.STRING },
              invoiceDate: { type: Type.STRING },
              dueDate: { type: Type.STRING },
              purchaseOrderNo: { type: Type.STRING },
              gstType: { type: Type.STRING },
              subtotal: { type: Type.NUMBER },
              totalTaxable: { type: Type.NUMBER },
              totalCgst: { type: Type.NUMBER },
              totalSgst: { type: Type.NUMBER },
              totalIgst: { type: Type.NUMBER },
              grandTotal: { type: Type.NUMBER },
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    scannedName: { type: Type.STRING },
                    brand: { type: Type.STRING },
                    hsnCode: { type: Type.STRING },
                    barcode: { type: Type.STRING },
                    qty: { type: Type.NUMBER },
                    freeQty: { type: Type.NUMBER },
                    unit: { type: Type.STRING },
                    packageSize: { type: Type.STRING },
                    purchasePrice: { type: Type.NUMBER },
                    discountPercent: { type: Type.NUMBER },
                    discountAmount: { type: Type.NUMBER },
                    taxableValue: { type: Type.NUMBER },
                    gstRate: { type: Type.NUMBER },
                    cgstAmount: { type: Type.NUMBER },
                    sgstAmount: { type: Type.NUMBER },
                    igstAmount: { type: Type.NUMBER },
                    totalAmount: { type: Type.NUMBER },
                    batchNo: { type: Type.STRING },
                    expiryDate: { type: Type.STRING },
                  },
                },
              },
            },
          },
        },
      });

      const jsonText = (response.text || '{}').trim();
      const extracted = JSON.parse(jsonText);
      return res.json({ success: true, extracted });
    } catch (err: any) {
      const msg = err?.message || 'AI OCR extraction failed.';
      console.error('[PurchaseScanner] Extraction failed:', msg);
      return res.status(502).json({
        error: `OCR Extraction Error: ${msg}`,
      });
    }
  });

  router.get('/purchase-scans', authenticate, (_req, res) => {
    res.json({ scans: erpData.purchaseScans });
  });

  router.post('/purchase-scans', authenticate, (req: Request, res: Response) => {
    const scan = req.body;
    if (!scan || !scan.id) {
      return res.status(400).json({ error: 'Invalid purchase scan payload.' });
    }
    const idx = erpData.purchaseScans.findIndex((s) => s.id === scan.id);
    if (idx >= 0) {
      erpData.purchaseScans[idx] = scan;
    } else {
      erpData.purchaseScans.unshift(scan);
    }
    saveErpData(erpData);
    res.status(201).json({ success: true, scan });
  });

  // ============================================================================
  // MODULE 2: AUTHORITATIVE HSN / SAC MASTER & AUDIT TRAIL
  // ============================================================================
  router.get('/hsn-master', authenticate, (req: Request, res: Response) => {
    const q = String(req.query.q || '');
    const results = searchHsnMaster(q, erpData.customHsnEntries);
    res.json({
      entries: results,
      officialCount: INDIA_HSN_SAC_MASTER.length,
      customCount: erpData.customHsnEntries.length,
    });
  });

  router.post(
    '/hsn-master',
    authenticate,
    requireRole(['Owner', 'Admin', 'Accountant', 'Inventory']),
    (req: Request, res: Response) => {
      const entry = req.body;
      if (!entry || !entry.code || !entry.description) {
        return res.status(400).json({ error: 'HSN/SAC code and description are required.' });
      }
      if (!isValidHsnOrSac(entry.code)) {
        return res.status(400).json({ error: 'Invalid HSN/SAC code format (must be 4, 6, or 8 numeric digits).' });
      }
      const idx = erpData.customHsnEntries.findIndex((e) => e.code === entry.code);
      if (idx >= 0) {
        erpData.customHsnEntries[idx] = entry;
      } else {
        erpData.customHsnEntries.unshift(entry);
      }
      saveErpData(erpData);
      res.status(201).json({ success: true, entry });
    }
  );

  router.get('/gst-audits', authenticate, (_req, res) => {
    res.json({ audits: erpData.gstAudits });
  });

  router.post('/gst-audits', authenticate, (req: Request, res: Response) => {
    const audit = req.body;
    if (!audit || !audit.id) return res.status(400).json({ error: 'Invalid GST audit record.' });
    erpData.gstAudits.unshift(audit);
    saveErpData(erpData);
    res.status(201).json({ success: true, audit });
  });

  // ============================================================================
  // MODULE 4: E-INVOICE & E-WAY BILL (REAL AUTHORIZED GSP / NIC IRP GATEWAY)
  // ============================================================================
  router.get('/einvoice/gsp-status', authenticate, (_req, res) => {
    const creds = loadDecryptedGspCredentials();
    const mask = (val: string) =>
      val && val.length > 6 ? `${val.slice(0, 3)}***${val.slice(-3)}` : val ? '***' : '';
    res.json({
      configured: creds.configured,
      providerName: creds.providerName,
      environment: creds.environment,
      sellerGstin: creds.sellerGstin,
      maskedClientId: mask(creds.clientId),
      irpEndpointConfigured: Boolean(creds.irpApiUrl),
      ewbEndpointConfigured: Boolean(creds.ewbApiUrl),
      updatedAt: creds.updatedAt,
    });
  });

  router.post(
    '/einvoice/gsp-config',
    authenticate,
    requireRole(['Owner', 'Admin']),
    (req: Request, res: Response) => {
      const {
        providerName,
        environment,
        sellerGstin,
        irpApiUrl,
        ewbApiUrl,
        clientId,
        clientSecret,
        username,
        password,
      } = req.body || {};

      if (!irpApiUrl || !clientId || !clientSecret) {
        return res.status(400).json({
          error: 'Authorized GSP/IRP API URL, Client ID, and Client Secret are required.',
        });
      }
      if (sellerGstin && !isValidGstin(sellerGstin)) {
        return res.status(400).json({ error: 'Invalid 15-character Seller GSTIN format.' });
      }

      const saved = saveEncryptedGspVault({
        providerName: String(providerName || 'Authorized GSP'),
        environment: environment === 'Production' ? 'Production' : 'Sandbox',
        sellerGstin: String(sellerGstin || ''),
        irpApiUrl: String(irpApiUrl),
        ewbApiUrl: String(ewbApiUrl || irpApiUrl),
        clientId: String(clientId),
        clientSecret: String(clientSecret),
        username: String(username || ''),
        password: String(password || ''),
      });

      res.json({
        success: true,
        updatedAt: saved.updatedAt,
        message: 'GSP/IRP credentials encrypted and stored securely on server.',
      });
    }
  );

  router.post('/einvoice/validate', authenticate, (req: Request, res: Response) => {
    const { invoice, sellerGstin, sellerAddress, sellerState } = req.body || {};
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!invoice) {
      return res.status(400).json({ eligible: false, valid: false, errors: ['Invoice payload missing.'], warnings });
    }

    const buyerGstin = String(invoice.partyGstin || '').trim().toUpperCase();
    const sGstin = String(sellerGstin || '').trim().toUpperCase();

    if (!sGstin || !isValidGstin(sGstin)) {
      errors.push('Valid 15-character Seller GSTIN is mandatory for GST e-Invoicing.');
    }
    if (!buyerGstin) {
      errors.push(
        'Buyer GSTIN is missing. B2C retail invoices do not require IRN under Indian GST E-Invoicing rules.'
      );
    } else if (!isValidGstin(buyerGstin)) {
      errors.push(`Buyer GSTIN "${buyerGstin}" is invalid.`);
    }
    if (buyerGstin && sGstin && buyerGstin === sGstin) {
      errors.push('Seller GSTIN and Buyer GSTIN cannot be identical.');
    }

    if (!invoice.invoiceNo || String(invoice.invoiceNo).length > 16) {
      errors.push('Invoice number must be 1–16 characters.');
    }
    if (!invoice.date) {
      errors.push('Invoice date is missing.');
    }
    if (!sellerAddress || String(sellerAddress).trim().length < 5) {
      errors.push('Complete Seller dispatch address is required.');
    }
    if (!invoice.partyAddress || String(invoice.partyAddress).trim().length < 5) {
      warnings.push('Buyer address is short or missing — IRP requires buyer address & PIN code.');
    }

    const posCode =
      extractStateCodeFromGstin(buyerGstin) ||
      (String(invoice.stateOfSupply || sellerState || '').match(/\d{2}/)?.[0] ?? null);
    if (!posCode) {
      errors.push('Place of Supply state code could not be determined.');
    }

    const items = Array.isArray(invoice.items) ? invoice.items : [];
    if (items.length === 0) {
      errors.push('Invoice must contain at least one line item.');
    }

    let computedTaxable = 0;
    let computedTax = 0;
    items.forEach((line: any, idx: number) => {
      const hsn = String(line.hsn || '').trim();
      if (!hsn || !isValidHsnOrSac(hsn)) {
        errors.push(`Line ${idx + 1} (${line.name || 'Item'}): Missing or invalid 4/6/8-digit HSN/SAC code.`);
      }
      const lineBase = (Number(line.qty) || 0) * (Number(line.price) || 0) * (1 - (Number(line.discountPercent) || 0) / 100);
      computedTaxable += lineBase;
      computedTax += (lineBase * (Number(line.taxPercent) || 0)) / 100;
    });

    if (Math.abs(computedTaxable + computedTax - (Number(invoice.totalAmount) || 0)) > 2) {
      warnings.push('Invoice grand total differs slightly from computed taxable + GST value (check round-off or additional charges).');
    }

    const eligible = Boolean(buyerGstin && isValidGstin(buyerGstin) && invoice.type === 'Sale' && !invoice.isCancelled);

    res.json({
      eligible,
      valid: errors.length === 0,
      errors,
      warnings,
      placeOfSupplyCode: posCode,
      needsEWayBill: (Number(invoice.totalAmount) || 0) >= 50000,
    });
  });

  router.get('/einvoice/records', authenticate, (_req, res) => {
    res.json({
      eInvoices: erpData.eInvoiceRecords,
      apiLogs: erpData.eInvoiceLogs,
      eWayBills: erpData.eWayBillRecords,
    });
  });

  router.post(
    '/einvoice/generate',
    authenticate,
    requireRole(['Owner', 'Admin', 'Accountant', 'Manager']),
    async (req: Request, res: Response) => {
      const { invoice, sellerProfile } = req.body || {};
      if (!invoice || !invoice.id) {
        return res.status(400).json({ error: 'Invoice record required.' });
      }

      // Duplicate IRN guard
      const existingActive = erpData.eInvoiceRecords.find(
        (r) => r.transactionId === invoice.id && r.status === 'GENERATED'
      );
      if (existingActive) {
        return res.status(409).json({
          error: `Duplicate Protection: IRN ${existingActive.irn} already generated for Invoice #${invoice.invoiceNo}.`,
          record: existingActive,
        });
      }

      const creds = loadDecryptedGspCredentials();
      const nowIso = new Date().toISOString();

      if (!creds.configured || !creds.irpApiUrl) {
        const failedRec = {
          id: `einv-${Date.now()}`,
          transactionId: invoice.id,
          invoiceNo: invoice.invoiceNo,
          invoiceDate: invoice.date,
          partyName: invoice.partyName,
          buyerGstin: invoice.partyGstin || '',
          sellerGstin: sellerProfile?.gstin || creds.sellerGstin || '',
          taxableAmount: invoice.taxableAmount || invoice.subtotal || 0,
          totalTax: (invoice.cgstAmount || 0) + (invoice.sgstAmount || 0) + (invoice.igstAmount || 0),
          totalAmount: invoice.totalAmount,
          status: 'FAILED',
          errorMessage:
            'Authorized GSP/NIC IRP API credentials are not configured on the backend server. Configure real GSP credentials in Backend IRP Settings before submitting.',
          gspProvider: creds.providerName,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        erpData.eInvoiceRecords.unshift(failedRec);
        erpData.eInvoiceLogs.unshift({
          id: `elog-${Date.now()}`,
          eInvoiceId: failedRec.id,
          invoiceNo: invoice.invoiceNo,
          endpoint: 'IRP_PRECHECK',
          action: 'GENERATE_IRN',
          statusCode: 424,
          success: false,
          message: failedRec.errorMessage,
          timestamp: nowIso,
        });
        saveErpData(erpData);
        return res.status(424).json({
          error: failedRec.errorMessage,
          record: failedRec,
        });
      }

      // Build Official NIC E-Invoice v1.03 Schema Payload
      const sellerStateCode = extractStateCodeFromGstin(sellerProfile?.gstin || creds.sellerGstin) || '29';
      const buyerStateCode = extractStateCodeFromGstin(invoice.partyGstin) || sellerStateCode;
      const irpPayload = {
        Version: '1.1',
        TranDtls: { TaxSch: 'GST', SupTyp: 'B2B', RegRev: 'N' },
        DocDtls: { Typ: 'INV', No: invoice.invoiceNo, Dt: invoice.date.split(',')[0] },
        SellerDtls: {
          Gstin: (sellerProfile?.gstin || creds.sellerGstin || '').toUpperCase(),
          LglNm: sellerProfile?.name || 'Business Manager 360',
          Addr1: sellerProfile?.address || 'Store Address',
          Loc: 'India',
          Pin: 560001,
          Stcd: sellerStateCode,
        },
        BuyerDtls: {
          Gstin: (invoice.partyGstin || '').toUpperCase(),
          LglNm: invoice.partyName,
          Pos: buyerStateCode,
          Addr1: invoice.partyAddress || 'Customer Address',
          Loc: 'India',
          Pin: 560001,
          Stcd: buyerStateCode,
        },
        ItemList: (invoice.items || []).map((line: any, i: number) => {
          const assAmt = Number(((line.qty || 1) * (line.price || 0) * (1 - (line.discountPercent || 0) / 100)).toFixed(2));
          const gstAmt = Number(((assAmt * (line.taxPercent || 0)) / 100).toFixed(2));
          const isIgst = sellerStateCode !== buyerStateCode;
          return {
            SlNo: String(i + 1),
            PrdDesc: line.name,
            IsServc: 'N',
            HsnCd: line.hsn || '2106',
            Qty: line.qty || 1,
            Unit: line.unit || 'NOS',
            UnitPrice: line.price || 0,
            TotAmt: Number(((line.qty || 1) * (line.price || 0)).toFixed(2)),
            AssAmt: assAmt,
            GstRt: line.taxPercent || 0,
            IgstAmt: isIgst ? gstAmt : 0,
            CgstAmt: isIgst ? 0 : Number((gstAmt / 2).toFixed(2)),
            SgstAmt: isIgst ? 0 : Number((gstAmt / 2).toFixed(2)),
            TotItemVal: Number((assAmt + gstAmt).toFixed(2)),
          };
        }),
        ValDtls: {
          AssVal: Number((invoice.taxableAmount || invoice.subtotal || 0).toFixed(2)),
          CgstVal: Number((invoice.cgstAmount || 0).toFixed(2)),
          SgstVal: Number((invoice.sgstAmount || 0).toFixed(2)),
          IgstVal: Number((invoice.igstAmount || 0).toFixed(2)),
          TotInvVal: Number((invoice.totalAmount || 0).toFixed(2)),
        },
      };

      try {
        const gspResp = await fetch(creds.irpApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'client_id': creds.clientId,
            'client_secret': creds.clientSecret,
            'gstin': (sellerProfile?.gstin || creds.sellerGstin || '').toUpperCase(),
            'user_name': creds.username,
          },
          body: JSON.stringify(irpPayload),
        });
        const gspData: any = await gspResp.json().catch(() => ({}));
        const irn = gspData?.Irn || gspData?.data?.Irn || gspData?.result?.Irn;
        const ackNo = gspData?.AckNo || gspData?.data?.AckNo || gspData?.result?.AckNo;
        const ackDate = gspData?.AckDt || gspData?.data?.AckDt || gspData?.result?.AckDt;
        const signedQr = gspData?.SignedQRCode || gspData?.data?.SignedQRCode || gspData?.result?.SignedQRCode;

        if (!gspResp.ok || !irn || !signedQr) {
          const errMsg =
            gspData?.ErrorDetails?.[0]?.ErrorMessage ||
            gspData?.message ||
            gspData?.error ||
            `GSP/IRP rejected submission (HTTP ${gspResp.status}).`;
          const failedRec = {
            id: `einv-${Date.now()}`,
            transactionId: invoice.id,
            invoiceNo: invoice.invoiceNo,
            invoiceDate: invoice.date,
            partyName: invoice.partyName,
            buyerGstin: invoice.partyGstin || '',
            sellerGstin: sellerProfile?.gstin || creds.sellerGstin || '',
            taxableAmount: invoice.taxableAmount || 0,
            totalTax: (invoice.cgstAmount || 0) + (invoice.sgstAmount || 0) + (invoice.igstAmount || 0),
            totalAmount: invoice.totalAmount,
            status: 'FAILED',
            errorMessage: errMsg,
            gspProvider: creds.providerName,
            createdAt: nowIso,
            updatedAt: nowIso,
          };
          erpData.eInvoiceRecords.unshift(failedRec);
          erpData.eInvoiceLogs.unshift({
            id: `elog-${Date.now()}`,
            eInvoiceId: failedRec.id,
            invoiceNo: invoice.invoiceNo,
            endpoint: creds.irpApiUrl,
            action: 'GENERATE_IRN',
            statusCode: gspResp.status,
            success: false,
            message: errMsg,
            timestamp: nowIso,
          });
          saveErpData(erpData);
          return res.status(gspResp.status >= 400 ? gspResp.status : 502).json({
            error: errMsg,
            record: failedRec,
          });
        }

        const successRec = {
          id: `einv-${Date.now()}`,
          transactionId: invoice.id,
          invoiceNo: invoice.invoiceNo,
          invoiceDate: invoice.date,
          partyName: invoice.partyName,
          buyerGstin: invoice.partyGstin || '',
          sellerGstin: sellerProfile?.gstin || creds.sellerGstin || '',
          taxableAmount: invoice.taxableAmount || 0,
          totalTax: (invoice.cgstAmount || 0) + (invoice.sgstAmount || 0) + (invoice.igstAmount || 0),
          totalAmount: invoice.totalAmount,
          status: 'GENERATED',
          irn: String(irn),
          ackNo: String(ackNo || ''),
          ackDate: String(ackDate || nowIso),
          signedQrCode: String(signedQr),
          gspProvider: creds.providerName,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        erpData.eInvoiceRecords.unshift(successRec);
        erpData.eInvoiceLogs.unshift({
          id: `elog-${Date.now()}`,
          eInvoiceId: successRec.id,
          invoiceNo: invoice.invoiceNo,
          endpoint: creds.irpApiUrl,
          action: 'GENERATE_IRN',
          statusCode: gspResp.status,
          success: true,
          message: `IRN ${irn} generated (Ack ${ackNo || 'N/A'})`,
          timestamp: nowIso,
        });
        saveErpData(erpData);
        return res.status(201).json({ success: true, record: successRec });
      } catch (err: any) {
        const errMsg = `Network failure communicating with GSP/IRP (${err?.message || 'Unknown error'})`;
        const failedRec = {
          id: `einv-${Date.now()}`,
          transactionId: invoice.id,
          invoiceNo: invoice.invoiceNo,
          invoiceDate: invoice.date,
          partyName: invoice.partyName,
          buyerGstin: invoice.partyGstin || '',
          sellerGstin: sellerProfile?.gstin || creds.sellerGstin || '',
          taxableAmount: invoice.taxableAmount || 0,
          totalTax: (invoice.cgstAmount || 0) + (invoice.sgstAmount || 0) + (invoice.igstAmount || 0),
          totalAmount: invoice.totalAmount,
          status: 'FAILED',
          errorMessage: errMsg,
          gspProvider: creds.providerName,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        erpData.eInvoiceRecords.unshift(failedRec);
        erpData.eInvoiceLogs.unshift({
          id: `elog-${Date.now()}`,
          eInvoiceId: failedRec.id,
          invoiceNo: invoice.invoiceNo,
          endpoint: creds.irpApiUrl,
          action: 'GENERATE_IRN',
          statusCode: 502,
          success: false,
          message: errMsg,
          timestamp: nowIso,
        });
        saveErpData(erpData);
        return res.status(502).json({ error: errMsg, record: failedRec });
      }
    }
  );

  router.post(
    '/einvoice/:id/cancel',
    authenticate,
    requireRole(['Owner', 'Admin', 'Accountant']),
    async (req: Request, res: Response) => {
      const { id } = req.params;
      const { reasonCode = '1', remarks = 'Cancelled by authorized user' } = req.body || {};
      const rec = erpData.eInvoiceRecords.find((r) => r.id === id);
      if (!rec) return res.status(404).json({ error: 'E-Invoice record not found.' });
      if (rec.status !== 'GENERATED' || !rec.irn) {
        return res.status(400).json({ error: 'Only an active IRN-generated e-Invoice can be cancelled.' });
      }

      // Check statutory 24-hour NIC IRP cancellation window
      const ackTime = rec.ackDate ? new Date(rec.ackDate).getTime() : new Date(rec.createdAt).getTime();
      if (!Number.isNaN(ackTime) && Date.now() - ackTime > 24 * 60 * 60 * 1000) {
        return res.status(400).json({
          error:
            'Statutory IRP Restriction: IRN cancellation on NIC IRP is only allowed within 24 hours of Acknowledgement Date. Issue a Credit Note instead.',
        });
      }

      const creds = loadDecryptedGspCredentials();
      if (!creds.configured || !creds.irpApiUrl) {
        return res.status(424).json({
          error: 'GSP/IRP backend credentials are required to transmit an IRN cancellation.',
        });
      }

      const cancelUrl = creds.irpApiUrl.replace(/\/Invoice\/?$/i, '/Invoice/Cancel');
      const nowIso = new Date().toISOString();
      try {
        const gspResp = await fetch(cancelUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'client_id': creds.clientId,
            'client_secret': creds.clientSecret,
            'gstin': rec.sellerGstin,
          },
          body: JSON.stringify({ Irn: rec.irn, CnlRsn: reasonCode, CnlRem: remarks }),
        });
        const gspData: any = await gspResp.json().catch(() => ({}));
        if (!gspResp.ok) {
          const msg = gspData?.message || gspData?.error || `IRP Cancel rejected (HTTP ${gspResp.status})`;
          erpData.eInvoiceLogs.unshift({
            id: `elog-${Date.now()}`,
            eInvoiceId: rec.id,
            invoiceNo: rec.invoiceNo,
            endpoint: cancelUrl,
            action: 'CANCEL_IRN',
            statusCode: gspResp.status,
            success: false,
            message: msg,
            timestamp: nowIso,
          });
          saveErpData(erpData);
          return res.status(gspResp.status).json({ error: msg });
        }

        rec.status = 'CANCELLED';
        rec.cancelReasonCode = reasonCode;
        rec.cancelRemarks = remarks;
        rec.cancelledAt = nowIso;
        rec.updatedAt = nowIso;
        erpData.eInvoiceLogs.unshift({
          id: `elog-${Date.now()}`,
          eInvoiceId: rec.id,
          invoiceNo: rec.invoiceNo,
          endpoint: cancelUrl,
          action: 'CANCEL_IRN',
          statusCode: gspResp.status,
          success: true,
          message: `IRN ${rec.irn} cancelled via IRP`,
          timestamp: nowIso,
        });
        saveErpData(erpData);
        return res.json({ success: true, record: rec });
      } catch (err: any) {
        return res.status(502).json({ error: `IRP cancel request failed: ${err?.message || 'Network error'}` });
      }
    }
  );

  router.post(
    '/ewaybill/generate',
    authenticate,
    requireRole(['Owner', 'Admin', 'Accountant', 'Manager']),
    async (req: Request, res: Response) => {
      const { invoice, transport } = req.body || {};
      if (!invoice || !transport) {
        return res.status(400).json({ error: 'Invoice and transport details are required.' });
      }
      if (!transport.vehicleNumber && !transport.transporterId) {
        return res.status(400).json({ error: 'Either Vehicle Number or Transporter ID is required for E-Way Bill.' });
      }

      const creds = loadDecryptedGspCredentials();
      const nowIso = new Date().toISOString();
      if (!creds.configured || !creds.ewbApiUrl) {
        const failedEwb = {
          id: `ewb-${Date.now()}`,
          transactionId: invoice.id,
          invoiceNo: invoice.invoiceNo,
          eInvoiceIrn: transport.irn || undefined,
          partyName: invoice.partyName,
          totalAmount: invoice.totalAmount,
          status: 'FAILED',
          transporterName: transport.transporterName || '',
          transporterId: transport.transporterId || '',
          vehicleNumber: transport.vehicleNumber || '',
          transportMode: transport.transportMode || 'Road',
          distanceKm: Number(transport.distanceKm) || 0,
          dispatchLocation: transport.dispatchLocation || '',
          deliveryLocation: transport.deliveryLocation || '',
          transportDocNo: transport.transportDocNo || '',
          errorMessage:
            'Authorized GSP / NIC E-Way Bill API credentials are not configured on the backend server.',
          createdAt: nowIso,
        };
        erpData.eWayBillRecords.unshift(failedEwb);
        erpData.eInvoiceLogs.unshift({
          id: `elog-${Date.now()}`,
          invoiceNo: invoice.invoiceNo,
          endpoint: 'EWB_PRECHECK',
          action: 'GENERATE_EWB',
          statusCode: 424,
          success: false,
          message: failedEwb.errorMessage,
          timestamp: nowIso,
        });
        saveErpData(erpData);
        return res.status(424).json({ error: failedEwb.errorMessage, record: failedEwb });
      }

      try {
        const ewbResp = await fetch(creds.ewbApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'client_id': creds.clientId,
            'client_secret': creds.clientSecret,
          },
          body: JSON.stringify({
            Irn: transport.irn || undefined,
            Distance: Number(transport.distanceKm) || 10,
            TransMode:
              transport.transportMode === 'Rail'
                ? '2'
                : transport.transportMode === 'Air'
                ? '3'
                : transport.transportMode === 'Ship'
                ? '4'
                : '1',
            TransId: transport.transporterId || undefined,
            TransName: transport.transporterName || undefined,
            TransDocNo: transport.transportDocNo || undefined,
            TransDocDt: transport.transportDocDate || undefined,
            VehNo: transport.vehicleNumber || undefined,
            VehType: 'R',
          }),
        });
        const ewbData: any = await ewbResp.json().catch(() => ({}));
        const ewbNo = ewbData?.EwbNo || ewbData?.ewayBillNo || ewbData?.data?.EwbNo;
        if (!ewbResp.ok || !ewbNo) {
          const msg = ewbData?.message || ewbData?.error || `E-Way Bill gateway rejected request (HTTP ${ewbResp.status})`;
          return res.status(ewbResp.status >= 400 ? ewbResp.status : 502).json({ error: msg });
        }
        const okEwb = {
          id: `ewb-${Date.now()}`,
          transactionId: invoice.id,
          invoiceNo: invoice.invoiceNo,
          eInvoiceIrn: transport.irn || undefined,
          partyName: invoice.partyName,
          totalAmount: invoice.totalAmount,
          status: 'GENERATED',
          ewbNo: String(ewbNo),
          ewbDate: String(ewbData?.EwbDt || nowIso),
          validUpto: String(ewbData?.EwbValidTill || ''),
          transporterName: transport.transporterName || '',
          transporterId: transport.transporterId || '',
          vehicleNumber: transport.vehicleNumber || '',
          transportMode: transport.transportMode || 'Road',
          distanceKm: Number(transport.distanceKm) || 0,
          dispatchLocation: transport.dispatchLocation || '',
          deliveryLocation: transport.deliveryLocation || '',
          transportDocNo: transport.transportDocNo || '',
          createdAt: nowIso,
        };
        erpData.eWayBillRecords.unshift(okEwb);
        erpData.eInvoiceLogs.unshift({
          id: `elog-${Date.now()}`,
          invoiceNo: invoice.invoiceNo,
          endpoint: creds.ewbApiUrl,
          action: 'GENERATE_EWB',
          statusCode: ewbResp.status,
          success: true,
          message: `E-Way Bill ${okEwb.ewbNo} generated`,
          timestamp: nowIso,
        });
        saveErpData(erpData);
        return res.status(201).json({ success: true, record: okEwb });
      } catch (err: any) {
        return res.status(502).json({ error: `E-Way Bill gateway network error: ${err?.message || 'Failed'}` });
      }
    }
  );

  // ============================================================================
  // MODULE 5: CUSTOMER QUOTATION APPROVAL PORTAL ENDPOINTS
  // ============================================================================
  router.post('/quotations/share', authenticate, (req: Request, res: Response) => {
    const { quotation, company } = req.body || {};
    if (!quotation || !quotation.id) {
      return res.status(400).json({ error: 'Invalid quotation payload.' });
    }
    const token =
      quotation.quotationShareToken ||
      `qtn-${crypto.randomBytes(8).toString('hex')}`;
    erpData.sharedQuotations[token] = {
      quotation: { ...quotation, quotationShareToken: token },
      company: company || {},
      sharedAt: new Date().toISOString(),
    };
    saveErpData(erpData);
    res.json({ success: true, token });
  });

  router.get('/quotations/public/:token', (req: Request, res: Response) => {
    const { token } = req.params;
    const entry = erpData.sharedQuotations[token];
    if (!entry) {
      return res.status(404).json({ error: 'Quotation approval link expired or not found.' });
    }
    if (entry.quotation.quotationStatus === 'Sent' || entry.quotation.quotationStatus === 'Draft') {
      entry.quotation.quotationStatus = 'Viewed';
      saveErpData(erpData);
    }
    res.json(entry);
  });

  router.post('/quotations/public/:token/respond', (req: Request, res: Response) => {
    const { token } = req.params;
    const { decision, customerName, comment } = req.body || {};
    const entry = erpData.sharedQuotations[token];
    if (!entry) {
      return res.status(404).json({ error: 'Quotation approval link not found.' });
    }
    const validMap: Record<string, string> = {
      Accepted: 'Accepted',
      Rejected: 'Rejected',
      'Modification Requested': 'Modification Requested',
    };
    const nextStatus = validMap[decision];
    if (!nextStatus) {
      return res.status(400).json({ error: 'Decision must be Accepted, Rejected, or Modification Requested.' });
    }

    const respondedAt = new Date().toISOString();
    entry.quotation.quotationStatus = nextStatus;
    entry.quotation.quotationApproval = {
      status: nextStatus,
      respondedAt,
      customerName: customerName || entry.quotation.partyName,
      comment: comment || '',
      token,
    };
    saveErpData(erpData);
    res.json({ success: true, quotation: entry.quotation });
  });

  // ============================================================================
  // MODULE 8 & 10: DATABASE BACKUP & MIGRATION ROLLBACK
  // ============================================================================
  router.get('/erp/backup', authenticate, (_req, res) => {
    res.json({
      exportedAt: new Date().toISOString(),
      erpData,
    });
  });

  router.post(
    '/erp/backup',
    authenticate,
    requireRole(['Owner', 'Admin']),
    (req: Request, res: Response) => {
      const { label = 'Manual ERP Checkpoint', clientSnapshot } = req.body || {};
      const backup = {
        id: `bkp-${Date.now()}`,
        createdAt: new Date().toISOString(),
        label: String(label),
        snapshot: {
          serverErpData: JSON.parse(JSON.stringify(erpData)),
          clientSnapshot: clientSnapshot || null,
        },
      };
      erpData.backups.unshift(backup);
      erpData.backups = erpData.backups.slice(0, 15);
      saveErpData(erpData);
      res.status(201).json({ success: true, backupId: backup.id, createdAt: backup.createdAt });
    }
  );

  router.post(
    '/erp/rollback',
    authenticate,
    requireRole(['Owner', 'Admin']),
    (req: Request, res: Response) => {
      const { backupId } = req.body || {};
      const found = erpData.backups.find((b) => b.id === backupId);
      if (!found) {
        return res.status(404).json({ error: 'Backup checkpoint not found.' });
      }
      if (found.snapshot?.serverErpData) {
        const preservedBackups = erpData.backups;
        erpData = { ...DEFAULT_ERP_DATA, ...found.snapshot.serverErpData, backups: preservedBackups };
        saveErpData(erpData);
      }
      res.json({
        success: true,
        restoredBackupId: found.id,
        clientSnapshot: found.snapshot?.clientSnapshot || null,
      });
    }
  );

  // ============================================================================
  // MODULE 11: COMPLETE SETTINGS & ROLE-BASED SETTINGS ACCESS ENDPOINTS
  // ============================================================================
  router.get('/settings', authenticate, (_req: Request, res: Response) => {
    res.json({
      businessSettings: erpData.businessSettings || null,
      partyGroups: erpData.partyGroups || [],
      serviceReminders: erpData.serviceReminders || [],
      settingsAuditLogs: erpData.settingsAuditLogs || [],
    });
  });

  router.put('/settings', authenticate, (req: Request, res: Response) => {
    const user = (req as any).user;
    const { category, settingsBundle, partyGroups, serviceReminders, reason, gstin } = req.body || {};

    if (!settingsBundle || typeof settingsBundle !== 'object') {
      return res.status(400).json({ error: 'Valid settingsBundle payload is required.' });
    }

    // Role-based settings authorization check
    const userRole = String(user?.roleName || 'Cashier');
    const isRoot = userRole === 'Owner' || userRole === 'Admin';
    const roleRule =
      erpData.businessSettings?.roleSettingsAccess?.[userRole] ||
      settingsBundle?.roleSettingsAccess?.[userRole];

    if (!isRoot) {
      if (category === 'role-access') {
        if (!roleRule?.canManageRoleAccess) {
          return res.status(403).json({
            error: `Access Denied: Role "${userRole}" cannot modify Role Settings Permissions.`,
          });
        }
      } else if (category === 'audit-backup') {
        if (!roleRule?.canBackupAndRestore) {
          return res.status(403).json({
            error: `Access Denied: Role "${userRole}" cannot modify Backup & Audit settings.`,
          });
        }
      } else if (category && roleRule?.categories?.[category]) {
        if (!roleRule.categories[category].edit) {
          return res.status(403).json({
            error: `Access Denied: Role "${userRole}" has read-only or restricted access to "${category}" settings.`,
          });
        }
      } else if (category && !roleRule) {
        return res.status(403).json({
          error: `Access Denied: Role "${userRole}" is not authorized to edit "${category}" settings.`,
        });
      }
    }

    // Input Validations
    if (gstin && String(gstin).trim() !== '' && !isValidGstin(String(gstin).trim().toUpperCase())) {
      return res.status(400).json({ error: 'Invalid GSTIN format. Expected 15-character alphanumeric GSTIN.' });
    }
    const remDays = settingsBundle?.party?.paymentReminderDaysBeforeDue;
    if (remDays !== undefined && (Number.isNaN(Number(remDays)) || Number(remDays) < 0 || Number(remDays) > 365)) {
      return res.status(400).json({ error: 'Payment reminder days must be between 0 and 365.' });
    }
    const decPrec = settingsBundle?.general?.decimalPrecision;
    if (decPrec !== undefined && (Number(decPrec) < 0 || Number(decPrec) > 4)) {
      return res.status(400).json({ error: 'Decimal precision must be between 0 and 4.' });
    }

    const prevBundle = erpData.businessSettings;
    const nowIso = new Date().toISOString();
    const auditEntries: any[] = Array.isArray(erpData.settingsAuditLogs) ? [...erpData.settingsAuditLogs] : [];

    if (category) {
      const catKey =
        category === 'taxes-gst'
          ? 'gst'
          : category === 'transaction-message'
          ? 'messages'
          : category === 'service-reminders'
          ? 'serviceReminders'
          : category === 'role-access'
          ? 'roleSettingsAccess'
          : category;
      const prevSection = prevBundle ? prevBundle[catKey] : undefined;
      const nextSection = settingsBundle[catKey];
      auditEntries.unshift({
        id: `saud-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        businessId: settingsBundle.businessId || 'tenant-krishna-1',
        category,
        settingName: `Updated ${category} configuration`,
        previousValue: prevSection ? JSON.stringify(prevSection).slice(0, 180) : 'Initial / Default',
        newValue: nextSection ? JSON.stringify(nextSection).slice(0, 180) : 'Updated',
        changedBy: user?.name || 'Administrator',
        changedRole: userRole,
        timestamp: nowIso,
        reason: reason || 'Settings updated via Control Center',
      });
    }

    erpData.businessSettings = { ...settingsBundle, updatedAt: nowIso };
    if (Array.isArray(partyGroups)) erpData.partyGroups = partyGroups;
    if (Array.isArray(serviceReminders)) erpData.serviceReminders = serviceReminders;
    erpData.settingsAuditLogs = auditEntries.slice(0, 300);
    saveErpData(erpData);

    return res.json({
      success: true,
      updatedAt: nowIso,
      businessSettings: erpData.businessSettings,
      settingsAuditLogs: erpData.settingsAuditLogs,
    });
  });

  router.post('/settings/reset', authenticate, (req: Request, res: Response) => {
    const user = (req as any).user;
    const userRole = String(user?.roleName || 'Cashier');
    const isRoot = userRole === 'Owner' || userRole === 'Admin';
    const roleRule = erpData.businessSettings?.roleSettingsAccess?.[userRole];

    if (!isRoot && !roleRule?.canResetSettings) {
      return res.status(403).json({
        error: `Access Denied: Role "${userRole}" does not have permission to reset settings to default.`,
      });
    }

    const { category, settingsBundle } = req.body || {};
    const nowIso = new Date().toISOString();
    const auditEntries: any[] = Array.isArray(erpData.settingsAuditLogs) ? [...erpData.settingsAuditLogs] : [];
    auditEntries.unshift({
      id: `saud-${Date.now()}`,
      businessId: settingsBundle?.businessId || 'tenant-krishna-1',
      category: category || 'general',
      settingName: category ? `Reset ${category} section to default` : 'Reset all settings to default',
      previousValue: 'Custom configuration',
      newValue: 'Business Manager 360 Default',
      changedBy: user?.name || 'Administrator',
      changedRole: userRole,
      timestamp: nowIso,
      reason: 'Manual reset to default',
    });

    if (settingsBundle) {
      erpData.businessSettings = { ...settingsBundle, updatedAt: nowIso };
    }
    erpData.settingsAuditLogs = auditEntries.slice(0, 300);
    saveErpData(erpData);

    return res.json({
      success: true,
      updatedAt: nowIso,
      businessSettings: erpData.businessSettings,
      settingsAuditLogs: erpData.settingsAuditLogs,
    });
  });

  router.get('/settings/audit-logs', authenticate, (req: Request, res: Response) => {
    const user = (req as any).user;
    const userRole = String(user?.roleName || 'Cashier');
    const isRoot = userRole === 'Owner' || userRole === 'Admin';
    const roleRule = erpData.businessSettings?.roleSettingsAccess?.[userRole];
    if (!isRoot && !roleRule?.canViewAuditHistory) {
      return res.status(403).json({ error: 'Access Denied: Insufficient permissions to view settings audit log.' });
    }
    res.json({ logs: erpData.settingsAuditLogs || [] });
  });

  // ============================================================================
  // MODULE 12: AI BUSINESS ASSISTANT (Server-Side Gemini 4 Hydrogen, Grounded DB Context)
  // ============================================================================
  router.post('/ai/assistant', authenticate, async (req: Request, res: Response) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
        return res.status(503).json({
          error:
            'GEMINI_API_KEY is not configured in server secrets. Please set GEMINI_API_KEY in Settings > Secrets to enable AI Business Assistant answers.',
        });
      }

      const { message, history = [], contextSnapshot = {} } = req.body || {};
      const userQuestion = String(message || '').trim();
      if (!userQuestion) {
        return res.status(400).json({ error: 'Question message is required.' });
      }

      const user = (req as any).user;
      const roleName = String(user?.roleName || 'Owner');
      const canViewFinancials = ['Owner', 'Admin', 'Manager', 'Accountant'].includes(roleName);

      // Enforce RBAC on context snapshot before passing to model
      const sanitizedContext = canViewFinancials
        ? contextSnapshot
        : {
            ...contextSnapshot,
            profitSummary: undefined,
            expensesSummary: undefined,
            supplierPricesRestricted: true,
          };

      const systemPrompt = `You are the Business Manager 360 AI Business Assistant for an Indian Kirana / General Store ERP (Currency: INR ₹, Timezone: Asia/Kolkata).
Current User Role: ${roleName}.

STRICT GROUNDING & SAFETY RULES:
1. Answer ONLY using facts, products, customers, suppliers, invoices, expenses, and stock counts present in the LIVE DATABASE SNAPSHOT below.
2. NEVER invent, guess, or fabricate sales figures, profit numbers, product counts, GST amounts, or customer balances. If a metric is missing or 0 in the snapshot, state that exact fact honestly.
3. Keep answers crisp, actionable, formatted in Indian Rupees (₹), and directly useful for a store owner/manager.
4. If the user asks to perform an action that modifies inventory or creates a financial/purchase document (e.g., drafting a Purchase Order for low-stock items, adjusting stock, or updating min-stock thresholds), NEVER claim it is already saved; instead populate "proposedAction" with the exact details so the user must explicitly confirm in the UI dialog first. Otherwise set "proposedAction.actionType" to "NONE".

LIVE DATABASE SNAPSHOT (JSON):
${JSON.stringify(sanitizedContext).slice(0, 28000)}`;

      const conversationHistory = Array.isArray(history)
        ? history
            .slice(-6)
            .map((h: any) => `${h.role === 'user' ? 'User' : 'Assistant'}: ${String(h.text || '').slice(0, 500)}`)
            .join('\n')
        : '';

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `${systemPrompt}\n\n${conversationHistory ? `Recent Conversation:\n${conversationHistory}\n\n` : ''}User Question: ${userQuestion}`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              answer: { type: Type.STRING },
              highlights: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    label: { type: Type.STRING },
                    value: { type: Type.STRING },
                  },
                },
              },
              proposedAction: {
                type: Type.OBJECT,
                properties: {
                  actionType: { type: Type.STRING },
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  itemId: { type: Type.STRING },
                  itemName: { type: Type.STRING },
                  supplierName: { type: Type.STRING },
                  qty: { type: Type.NUMBER },
                  unitPrice: { type: Type.NUMBER },
                  newMinStock: { type: Type.NUMBER },
                },
              },
            },
            required: ['answer', 'highlights'],
          },
        },
      });

      const parsed = JSON.parse((response.text || '{}').trim());
      return res.json({
        answer: parsed.answer || 'No response generated.',
        highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
        proposedAction:
          parsed.proposedAction &&
          ['CREATE_PURCHASE_ORDER', 'ADJUST_MIN_STOCK', 'CREATE_STOCK_ADJUSTMENT'].includes(
            parsed.proposedAction.actionType
          )
            ? parsed.proposedAction
            : { actionType: 'NONE', title: '', description: '' },
      });
    } catch (err: any) {
      const msg = err?.message || 'AI Assistant request failed.';
      console.error('[AiAssistant] Error:', msg);
      return res.status(502).json({ error: `AI Assistant Error: ${msg}` });
    }
  });

  return router;
}
