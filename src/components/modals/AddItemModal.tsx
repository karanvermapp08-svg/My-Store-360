import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  PackagePlus,
  Save,
  Sparkles,
  Barcode,
  AlertCircle,
  AlertTriangle,
  Plus,
  Trash2,
  Package,
  IndianRupee,
  Layers,
  Tag,
} from 'lucide-react';
import { useVyapar } from '../../context/VyaparContext';
import {
  generateUniqueEan13Barcode,
  isBarcodeUnique,
  normalizeBarcode,
  renderBarcodeToSvg,
} from '../../utils/barcodeUtils';
import { safeGetStoredData, safeSetStoredData } from '../../utils/storage';
import { Godown, Item } from '../../types';
import { DEFAULT_GODOWNS } from '../WarehousesView';
import { isWeightOrVolumeUnit } from '../../utils/kiranaBilling';
import {
  BatchDraftRow,
  ItemBatchEditor,
  validateBatchEntries,
} from './ItemBatchEditor';

type AddItemModalTab = 'basic' | 'stock' | 'pricing' | 'discounts';

const ITEM_DRAFT_KEY = 'bm360_add_item_draft';

export const AddItemModal: React.FC = () => {
  const {
    isAddItemModalOpen,
    setIsAddItemModalOpen,
    items,
    parties,
    addItem,
    updateItem,
    editingItem,
    setEditingItem,
    prefilledBarcodeForNewItem,
    setPrefilledBarcodeForNewItem,
    canManageBarcodes,
    businessSettings,
    batches,
    upsertItemBatches,
    showToast,
  } = useVyapar();

  const itemCfg = businessSettings.item;
  const enabledCustomFields = itemCfg.additionalFields.filter((f) => f.enabled);
  const barcodeSvgRef = useRef<SVGSVGElement | null>(null);

  const [activeTab, setActiveTab] = useState<AddItemModalTab>('basic');
  const [hasDraftNotice, setHasDraftNotice] = useState(false);

  // A. Basic Information
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [extraBarcodes, setExtraBarcodes] = useState<string[]>([]);
  const [newExtraBarcode, setNewExtraBarcode] = useState('');
  const [category, setCategory] = useState(itemCfg.defaultCategory || 'General');
  const [subcategory, setSubcategory] = useState('');
  const [brand, setBrand] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [hsnCode, setHsnCode] = useState('');
  const [itemType, setItemType] = useState<NonNullable<Item['itemType']>>('Product');
  const [isActive, setIsActive] = useState(true);
  const [description, setDescription] = useState('');
  const [image, setImage] = useState('');
  const [tagsText, setTagsText] = useState('');

  // B. Unit & Kirana Packaging
  const [unit, setUnit] = useState(itemCfg.defaultUnit || 'PCS');
  const [purchaseUnit, setPurchaseUnit] = useState(itemCfg.defaultUnit || 'PCS');
  const [secondaryUnit, setSecondaryUnit] = useState('');
  const [conversionRate, setConversionRate] = useState<number>(1);
  const [productType, setProductType] = useState<'Loose' | 'Packaged' | 'Piece'>('Piece');
  const [minSellingQty, setMinSellingQty] = useState<number>(1);
  const [decimalPrecision, setDecimalPrecision] = useState<number>(2);

  // C. Purchase Details
  const [purchasePrice, setPurchasePrice] = useState<number>(0);
  const [purchaseTaxRate, setPurchaseTaxRate] = useState<number>(0);
  const [purchaseDiscountPercent, setPurchaseDiscountPercent] = useState<number>(0);
  const [additionalPurchaseCharges, setAdditionalPurchaseCharges] = useState<number>(0);
  const [lastPurchasePrice, setLastPurchasePrice] = useState<number>(0);
  const [weightedAvgCost, setWeightedAvgCost] = useState<number>(0);
  const [preferredSupplier, setPreferredSupplier] = useState('');
  const [minPurchaseQty, setMinPurchaseQty] = useState<number>(1);

  // D. Selling Price Management
  const [salePrice, setSalePrice] = useState<number>(0);
  const [wholesalePrice, setWholesalePrice] = useState<number>(0);
  const [dealerPrice, setDealerPrice] = useState<number>(0);
  const [minSellingPrice, setMinSellingPrice] = useState<number>(0);
  const [maxSellingPrice, setMaxSellingPrice] = useState<number>(0);
  const [mrp, setMrp] = useState<number>(0);
  const [targetMarginPercent, setTargetMarginPercent] = useState<number>(
    businessSettings.accounting?.profitControl?.targetProfitMarginPercent ?? 18
  );
  const [customerPrices, setCustomerPrices] = useState<Record<string, number>>({});
  const [selectedCustName, setSelectedCustName] = useState('');
  const [selectedCustRate, setSelectedCustRate] = useState<number>(0);

  // E. GST & Tax
  const [gstApplicable, setGstApplicable] = useState<boolean>(businessSettings.gst.isGstRegistered);
  const [taxRate, setTaxRate] = useState<number>(itemCfg.defaultTaxRate ?? 18);
  const [gstTypePreference, setGstTypePreference] = useState<'Inclusive' | 'Exclusive'>(
    itemCfg.priceTaxMode === 'Inclusive' ? 'Inclusive' : 'Exclusive'
  );
  const [cessRate, setCessRate] = useState<number>(0);
  const [gstInputCreditEligible, setGstInputCreditEligible] = useState<boolean>(true);

  // F. Stock, Location & Batch
  const [openingStock, setOpeningStock] = useState<number>(0);
  const [stock, setStock] = useState<number>(0);
  const [reservedStock, setReservedStock] = useState<number>(0);
  const [minStockAlert, setMinStockAlert] = useState<number>(itemCfg.defaultMinStockAlert ?? 5);
  const [maxStockLevel, setMaxStockLevel] = useState<number>(100);
  const [reorderLevel, setReorderLevel] = useState<number>(itemCfg.defaultMinStockAlert ?? 5);
  const [damagedStock, setDamagedStock] = useState<number>(0);
  const [expiredStock, setExpiredStock] = useState<number>(0);
  const [godownId, setGodownId] = useState('gdw-1');
  const [rackNumber, setRackNumber] = useState('');
  const [shelfLocation, setShelfLocation] = useState('');
  const [batchNo, setBatchNo] = useState('');
  const [mfgDate, setMfgDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [batchRows, setBatchRows] = useState<BatchDraftRow[]>([]);

  // G. Discounts & Profit Override
  const [defaultDiscountPercent, setDefaultDiscountPercent] = useState<number>(0);
  const [defaultDiscountAmount, setDefaultDiscountAmount] = useState<number>(0);
  const [maxDiscountLimitPercent, setMaxDiscountLimitPercent] = useState<number>(15);
  const [qtyDiscountMinQty, setQtyDiscountMinQty] = useState<number>(0);
  const [qtyDiscountPercent, setQtyDiscountPercent] = useState<number>(0);
  const [wholesaleDiscountPercent, setWholesaleDiscountPercent] = useState<number>(0);
  const [promoDiscountPercent, setPromoDiscountPercent] = useState<number>(0);
  const [allowBelowCostSave, setAllowBelowCostSave] = useState<boolean>(false);

  const [customFields, setCustomFields] = useState<Record<string, string>>({});
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);

  const godowns = safeGetStoredData<Godown[]>('mystore_godowns', DEFAULT_GODOWNS, Array.isArray);

  const categorySubOptions = useMemo(() => {
    const matched = itemCfg.categories.find(
      (c) => c.name.toLowerCase() === (category || '').toLowerCase()
    );
    return matched?.subCategories || [];
  }, [itemCfg.categories, category]);

  useEffect(() => {
    if (!isAddItemModalOpen) return;
    setBarcodeError(null);
    setCodeError(null);
    setActiveTab('basic');
    setAllowBelowCostSave(false);

    if (editingItem) {
      setHasDraftNotice(false);
      setName(editingItem.name || '');
      setCode(editingItem.code || '');
      setSku(editingItem.sku || editingItem.code || '');
      setBarcode(editingItem.barcode || generateUniqueEan13Barcode(items, editingItem.id));
      setExtraBarcodes(editingItem.extraBarcodes || []);
      setNewExtraBarcode('');
      setCategory(editingItem.category || itemCfg.defaultCategory || 'General');
      setSubcategory(editingItem.subcategory || '');
      setBrand(editingItem.brand || '');
      setManufacturer(editingItem.manufacturer || '');
      setHsnCode(editingItem.hsnCode || '');
      setItemType(editingItem.itemType || 'Product');
      setIsActive(editingItem.isActive ?? true);
      setDescription(editingItem.description || '');
      setImage(editingItem.image || '');
      setTagsText((editingItem.tags || []).join(', '));

      const u = editingItem.unit || itemCfg.defaultUnit || 'PCS';
      setUnit(u);
      setPurchaseUnit(editingItem.purchaseUnit || u);
      setSecondaryUnit(editingItem.unitConversion?.secondaryUnit || '');
      setConversionRate(editingItem.unitConversion?.rate || 1);
      const inferredLoose = isWeightOrVolumeUnit(u);
      setProductType(editingItem.productType || (inferredLoose ? 'Loose' : 'Piece'));
      setMinSellingQty(editingItem.minSellingQty ?? (inferredLoose ? 0.05 : 1));
      setDecimalPrecision(editingItem.decimalPrecision ?? (inferredLoose ? 3 : 2));

      setPurchasePrice(editingItem.purchasePrice || 0);
      setPurchaseTaxRate(editingItem.purchaseTaxRate ?? editingItem.taxRate ?? 0);
      setPurchaseDiscountPercent(editingItem.purchaseDiscountPercent || 0);
      setAdditionalPurchaseCharges(editingItem.additionalPurchaseCharges || 0);
      setLastPurchasePrice(editingItem.lastPurchasePrice ?? editingItem.purchasePrice ?? 0);
      setWeightedAvgCost(editingItem.weightedAvgCost ?? editingItem.purchasePrice ?? 0);
      setPreferredSupplier(editingItem.preferredSupplier || editingItem.lastPurchaseSupplier || '');
      setMinPurchaseQty(editingItem.minPurchaseQty ?? 1);

      setSalePrice(editingItem.salePrice || 0);
      setWholesalePrice(editingItem.wholesalePrice || 0);
      setDealerPrice(editingItem.dealerPrice || 0);
      setMinSellingPrice(editingItem.minSellingPrice ?? editingItem.purchasePrice ?? 0);
      setMaxSellingPrice(editingItem.maxSellingPrice ?? editingItem.mrp ?? editingItem.salePrice ?? 0);
      setMrp(editingItem.mrp ?? editingItem.salePrice ?? 0);
      setTargetMarginPercent(
        editingItem.targetMarginPercent ??
          businessSettings.accounting?.profitControl?.targetProfitMarginPercent ??
          18
      );
      setCustomerPrices(editingItem.customerPrices || {});
      setSelectedCustName('');
      setSelectedCustRate(0);

      setGstApplicable(editingItem.gstApplicable ?? businessSettings.gst.isGstRegistered);
      setTaxRate(editingItem.taxRate ?? itemCfg.defaultTaxRate ?? 18);
      setGstTypePreference(
        editingItem.gstTypePreference ||
          (editingItem.taxInclusive ? 'Inclusive' : itemCfg.priceTaxMode === 'Inclusive' ? 'Inclusive' : 'Exclusive')
      );
      setCessRate(editingItem.cessRate || 0);
      setGstInputCreditEligible(editingItem.gstInputCreditEligible ?? true);

      setOpeningStock(editingItem.openingStock ?? editingItem.stock ?? 0);
      setStock(editingItem.stock || 0);
      setReservedStock(editingItem.reservedStock || 0);
      setMinStockAlert(editingItem.minStockAlert ?? itemCfg.defaultMinStockAlert ?? 5);
      setMaxStockLevel(editingItem.maxStockLevel ?? 100);
      setReorderLevel(editingItem.reorderLevel ?? editingItem.minStockAlert ?? 5);
      setDamagedStock(editingItem.damagedStock || 0);
      setExpiredStock(editingItem.expiredStock || 0);
      setGodownId(editingItem.godownId || godowns[0]?.id || 'gdw-1');
      setRackNumber(editingItem.rackNumber || '');
      setShelfLocation(editingItem.shelfLocation || '');
      setBatchNo(editingItem.batchNo || '');
      setMfgDate(editingItem.mfgDate || '');
      setExpiryDate(editingItem.expiryDate || '');
      const existingItemBatches = batches.filter(
        (b) =>
          b.itemId === editingItem.id ||
          b.itemName.trim().toLowerCase() === editingItem.name.trim().toLowerCase()
      );
      if (existingItemBatches.length > 0) {
        setBatchRows(
          existingItemBatches.map((b) => ({
            id: b.id,
            batchNumber: b.batchNumber,
            mfgDate: b.mfgDate || '',
            expiryDate: b.expiryDate || '',
            qty: b.qty || 0,
            purchaseRate: b.purchaseRate ?? editingItem.purchasePrice ?? 0,
            saleRate: b.saleRate ?? editingItem.salePrice ?? 0,
            warehouseId: b.warehouseId || editingItem.godownId || 'gdw-1',
          }))
        );
      } else if (editingItem.batchNo || editingItem.expiryDate || editingItem.mfgDate) {
        setBatchRows([
          {
            id: `bat-init-${editingItem.id}`,
            batchNumber: editingItem.batchNo || 'BAT-01',
            mfgDate: editingItem.mfgDate || '',
            expiryDate: editingItem.expiryDate || '',
            qty: editingItem.stock || 0,
            purchaseRate: editingItem.purchasePrice || 0,
            saleRate: editingItem.salePrice || 0,
            warehouseId: editingItem.godownId || 'gdw-1',
          },
        ]);
      } else {
        setBatchRows([]);
      }

      setDefaultDiscountPercent(editingItem.defaultDiscountPercent || 0);
      setDefaultDiscountAmount(editingItem.defaultDiscountAmount || 0);
      setMaxDiscountLimitPercent(editingItem.maxDiscountLimitPercent ?? 15);
      setQtyDiscountMinQty(editingItem.qtyDiscountMinQty || 0);
      setQtyDiscountPercent(editingItem.qtyDiscountPercent || 0);
      setWholesaleDiscountPercent(editingItem.wholesaleDiscountPercent || 0);
      setPromoDiscountPercent(editingItem.promoDiscountPercent || 0);
      setCustomFields(editingItem.customFields || {});
    } else {
      const savedDraft = safeGetStoredData<Record<string, any> | null>(ITEM_DRAFT_KEY, null);
      const nextSeqCode = `ITM-${String(items.length + 1).padStart(3, '0')}`;
      const defaultU = itemCfg.defaultUnit || 'PCS';
      const inferredLoose = isWeightOrVolumeUnit(defaultU);

      if (savedDraft && savedDraft.name && !prefilledBarcodeForNewItem) {
        setHasDraftNotice(true);
        setName(savedDraft.name || '');
        setCode(savedDraft.code || nextSeqCode);
        setSku(savedDraft.sku || nextSeqCode);
        setBarcode(savedDraft.barcode || (itemCfg.enableBarcodeAutoGen ? generateUniqueEan13Barcode(items) : ''));
        setExtraBarcodes(savedDraft.extraBarcodes || []);
        setCategory(savedDraft.category || itemCfg.defaultCategory || 'General');
        setSubcategory(savedDraft.subcategory || '');
        setBrand(savedDraft.brand || '');
        setManufacturer(savedDraft.manufacturer || '');
        setHsnCode(savedDraft.hsnCode || '');
        setItemType(savedDraft.itemType || 'Product');
        setIsActive(savedDraft.isActive ?? true);
        setDescription(savedDraft.description || '');
        setImage(savedDraft.image || '');
        setTagsText(savedDraft.tagsText || '');
        setUnit(savedDraft.unit || defaultU);
        setPurchaseUnit(savedDraft.purchaseUnit || defaultU);
        setSecondaryUnit(savedDraft.secondaryUnit || '');
        setConversionRate(savedDraft.conversionRate || 1);
        setProductType(savedDraft.productType || (inferredLoose ? 'Loose' : 'Piece'));
        setMinSellingQty(savedDraft.minSellingQty ?? (inferredLoose ? 0.05 : 1));
        setDecimalPrecision(savedDraft.decimalPrecision ?? (inferredLoose ? 3 : 2));
        setPurchasePrice(Number(savedDraft.purchasePrice) || 0);
        setSalePrice(Number(savedDraft.salePrice) || 0);
        setWholesalePrice(Number(savedDraft.wholesalePrice) || 0);
        setDealerPrice(Number(savedDraft.dealerPrice) || 0);
        setMrp(Number(savedDraft.mrp) || 0);
        setStock(Number(savedDraft.stock) || 0);
        setOpeningStock(Number(savedDraft.openingStock) || 0);
        setBatchNo(savedDraft.batchNo || '');
        setMfgDate(savedDraft.mfgDate || '');
        setExpiryDate(savedDraft.expiryDate || '');
        setBatchRows(Array.isArray(savedDraft.batchRows) ? savedDraft.batchRows : []);
      } else {
        setHasDraftNotice(false);
        setName('');
        setCode(nextSeqCode);
        setSku(nextSeqCode);
        setBarcode(
          prefilledBarcodeForNewItem ||
            (itemCfg.enableBarcodeAutoGen ? generateUniqueEan13Barcode(items) : '')
        );
        setExtraBarcodes([]);
        setNewExtraBarcode('');
        setCategory(itemCfg.defaultCategory || 'General');
        setSubcategory('');
        setBrand('');
        setManufacturer('');
        setHsnCode('');
        setItemType('Product');
        setIsActive(true);
        setDescription('');
        setImage('');
        setTagsText('');
        setUnit(defaultU);
        setPurchaseUnit(defaultU);
        setSecondaryUnit('');
        setConversionRate(1);
        setProductType(inferredLoose ? 'Loose' : 'Piece');
        setMinSellingQty(inferredLoose ? 0.05 : 1);
        setDecimalPrecision(inferredLoose ? 3 : 2);
        setPurchasePrice(0);
        setPurchaseTaxRate(0);
        setPurchaseDiscountPercent(0);
        setAdditionalPurchaseCharges(0);
        setLastPurchasePrice(0);
        setWeightedAvgCost(0);
        setPreferredSupplier('');
        setMinPurchaseQty(1);
        setSalePrice(0);
        setWholesalePrice(0);
        setDealerPrice(0);
        setMinSellingPrice(0);
        setMaxSellingPrice(0);
        setMrp(0);
        setTargetMarginPercent(businessSettings.accounting?.profitControl?.targetProfitMarginPercent ?? 18);
        setCustomerPrices({});
        setSelectedCustName('');
        setSelectedCustRate(0);
        setGstApplicable(businessSettings.gst.isGstRegistered);
        setTaxRate(itemCfg.defaultTaxRate ?? 18);
        setGstTypePreference(itemCfg.priceTaxMode === 'Inclusive' ? 'Inclusive' : 'Exclusive');
        setCessRate(0);
        setGstInputCreditEligible(true);
        setOpeningStock(0);
        setStock(0);
        setReservedStock(0);
        setMinStockAlert(itemCfg.defaultMinStockAlert ?? 5);
        setMaxStockLevel(100);
        setReorderLevel(itemCfg.defaultMinStockAlert ?? 5);
        setDamagedStock(0);
        setExpiredStock(0);
        setGodownId(godowns[0]?.id || 'gdw-1');
        setRackNumber('');
        setShelfLocation('');
        setBatchNo('');
        setMfgDate('');
        setExpiryDate('');
        setBatchRows([]);
        setDefaultDiscountPercent(0);
        setDefaultDiscountAmount(0);
        setMaxDiscountLimitPercent(15);
        setQtyDiscountMinQty(0);
        setQtyDiscountPercent(0);
        setWholesaleDiscountPercent(0);
        setPromoDiscountPercent(0);
        const defaults: Record<string, string> = {};
        enabledCustomFields.forEach((f) => {
          if (f.defaultValue) defaults[f.id] = f.defaultValue;
        });
        setCustomFields(defaults);
      }
    }
  }, [isAddItemModalOpen, editingItem, prefilledBarcodeForNewItem]);

  // Automatic draft saving for New Item mode
  useEffect(() => {
    if (!isAddItemModalOpen || editingItem) return;
    if (!name.trim() && !salePrice && !purchasePrice) return;
    safeSetStoredData(ITEM_DRAFT_KEY, {
      name,
      code,
      sku,
      barcode,
      extraBarcodes,
      category,
      subcategory,
      brand,
      manufacturer,
      hsnCode,
      itemType,
      isActive,
      description,
      image,
      tagsText,
      unit,
      purchaseUnit,
      secondaryUnit,
      conversionRate,
      productType,
      minSellingQty,
      decimalPrecision,
      purchasePrice,
      salePrice,
      wholesalePrice,
      dealerPrice,
      mrp,
      stock,
      openingStock,
      batchNo,
      mfgDate,
      expiryDate,
      batchRows,
    });
  }, [
    isAddItemModalOpen,
    editingItem,
    name,
    code,
    sku,
    barcode,
    extraBarcodes,
    category,
    subcategory,
    brand,
    manufacturer,
    hsnCode,
    itemType,
    isActive,
    description,
    image,
    tagsText,
    unit,
    purchaseUnit,
    secondaryUnit,
    conversionRate,
    productType,
    minSellingQty,
    decimalPrecision,
    purchasePrice,
    salePrice,
    wholesalePrice,
    dealerPrice,
    mrp,
    stock,
    openingStock,
    batchNo,
    mfgDate,
    expiryDate,
    batchRows,
  ]);

  // Live Item Code uniqueness check
  useEffect(() => {
    if (!isAddItemModalOpen) return;
    const clean = code.trim().toLowerCase();
    if (!clean) {
      setCodeError('Item Code is required');
      return;
    }
    const dup = items.find((i) => i.id !== editingItem?.id && i.code.trim().toLowerCase() === clean);
    if (dup) {
      setCodeError(`Duplicate code! Already used by "${dup.name}".`);
    } else {
      setCodeError(null);
    }
  }, [code, isAddItemModalOpen, items, editingItem?.id]);

  // Live Barcode uniqueness & preview render
  useEffect(() => {
    if (!isAddItemModalOpen) return;
    const clean = normalizeBarcode(barcode);
    if (itemCfg.preventDuplicateBarcode && clean) {
      const check = isBarcodeUnique(items, clean, editingItem?.id);
      if (!check.unique && check.conflictItem) {
        setBarcodeError(`Duplicate barcode! Already used by "${check.conflictItem.name}".`);
      } else {
        setBarcodeError(null);
      }
    } else {
      setBarcodeError(null);
    }
    if (clean) {
      renderBarcodeToSvg(barcodeSvgRef.current, clean, 'AUTO', {
        height: 36,
        width: 1.5,
        fontSize: 10,
        margin: 2,
      });
    }
  }, [barcode, isAddItemModalOpen, items, editingItem?.id, itemCfg.preventDuplicateBarcode]);

  const batchValidation = useMemo(
    () =>
      validateBatchEntries(batchRows, {
        requireAtLeastOneBatch: itemCfg.enableBatchTracking && itemType === 'Product',
        requireExpiry: itemCfg.enableExpiryTracking && batchRows.length > 0,
        itemStock: Number(stock) || 0,
      }),
    [batchRows, itemCfg.enableBatchTracking, itemCfg.enableExpiryTracking, itemType, stock]
  );

  if (!isAddItemModalOpen) return null;

  const effectivePurchaseCost =
    (Number(purchasePrice) || 0) * (1 - (Number(purchaseDiscountPercent) || 0) / 100) +
    (Number(additionalPurchaseCharges) || 0);
  const netRetailAfterDefaultDisc =
    (Number(salePrice) || 0) * (1 - (Number(defaultDiscountPercent) || 0) / 100) -
    (Number(defaultDiscountAmount) || 0);
  const retailGrossProfit = netRetailAfterDefaultDisc - effectivePurchaseCost;
  const retailMarginPct =
    netRetailAfterDefaultDisc > 0 ? (retailGrossProfit / netRetailAfterDefaultDisc) * 100 : 0;
  const wholesaleMarginPct =
    wholesalePrice > 0 ? ((wholesalePrice - effectivePurchaseCost) / wholesalePrice) * 100 : 0;
  const isSellingBelowCost = salePrice > 0 && effectivePurchaseCost > 0 && netRetailAfterDefaultDisc < effectivePurchaseCost;

  const closeModal = () => {
    setIsAddItemModalOpen(false);
    setEditingItem(null);
    setPrefilledBarcodeForNewItem('');
    setBarcodeError(null);
    setCodeError(null);
  };

  const clearDraft = () => {
    try {
      localStorage.removeItem(ITEM_DRAFT_KEY);
    } catch {
      // ignore
    }
    setHasDraftNotice(false);
    setName('');
    setSalePrice(0);
    setPurchasePrice(0);
    setStock(0);
    setOpeningStock(0);
  };

  const handleGenerateBarcode = () => {
    const uniqueCode = generateUniqueEan13Barcode(items, `${name}-${Date.now()}`);
    setBarcode(uniqueCode);
    setBarcodeError(null);
  };

  const handleAutoGenCode = () => {
    let idx = items.length + 1;
    while (items.some((it) => it.code.toLowerCase() === `itm-${String(idx).padStart(3, '0')}`)) {
      idx += 1;
    }
    const gen = `ITM-${String(idx).padStart(3, '0')}`;
    setCode(gen);
    if (!sku) setSku(gen);
  };

  const handleAddExtraBarcode = () => {
    const clean = normalizeBarcode(newExtraBarcode);
    if (!clean) return;
    if (clean.toLowerCase() === normalizeBarcode(barcode).toLowerCase() || extraBarcodes.includes(clean)) {
      showToast('This barcode is already listed on this product.', 'warning');
      return;
    }
    const check = isBarcodeUnique(items, clean, editingItem?.id);
    if (!check.unique && check.conflictItem) {
      showToast(`Barcode "${clean}" is already assigned to "${check.conflictItem.name}".`, 'error');
      return;
    }
    setExtraBarcodes((prev) => [...prev, clean]);
    setNewExtraBarcode('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setActiveTab('basic');
      showToast('Product Name is required', 'warning');
      return;
    }
    if (codeError) {
      setActiveTab('basic');
      showToast(codeError, 'error');
      return;
    }
    if (itemCfg.enableMrpValidation && mrp > 0 && salePrice > mrp) {
      setActiveTab('pricing');
      showToast('Selling price cannot exceed MRP per Item Settings.', 'warning');
      return;
    }
    if (isSellingBelowCost && !allowBelowCostSave) {
      setActiveTab('pricing');
      showToast(
        'Selling price is below effective purchase cost. Enable authorized override or raise selling price.',
        'warning'
      );
      return;
    }

    for (const f of enabledCustomFields) {
      if (f.required && !(customFields[f.id] || '').trim()) {
        setActiveTab('discounts');
        showToast(`"${f.name}" is required per Item Settings.`, 'warning');
        return;
      }
    }

    const cleanBarcode = normalizeBarcode(barcode);
    if (itemCfg.preventDuplicateBarcode && cleanBarcode) {
      const check = isBarcodeUnique(items, cleanBarcode, editingItem?.id);
      if (!check.unique && check.conflictItem) {
        const msg = `Barcode "${cleanBarcode}" is already assigned to "${check.conflictItem.name}".`;
        setBarcodeError(msg);
        setActiveTab('basic');
        showToast(msg, 'error');
        return;
      }
    }

    const duplicateName = items.find(
      (i) => i.id !== editingItem?.id && i.name.trim().toLowerCase() === name.trim().toLowerCase()
    );
    if (duplicateName) {
      setActiveTab('basic');
      showToast(`Product "${duplicateName.name}" already exists in inventory.`, 'error');
      return;
    }

    if (!batchValidation.valid) {
      setActiveTab('stock');
      const firstRowErr = Object.values(batchValidation.errorsByRowId)[0]?.[0];
      showToast(batchValidation.globalError || firstRowErr || 'Please fix batch/expiry errors.', 'error');
      return;
    }

    const parsedTags = tagsText
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const payload: Omit<Item, 'id'> = {
      name: name.trim(),
      code: code.trim() || `ITM-${Math.floor(1000 + Math.random() * 9000)}`,
      sku: sku.trim() || code.trim(),
      barcode: cleanBarcode || generateUniqueEan13Barcode(items, name),
      extraBarcodes: extraBarcodes.length > 0 ? extraBarcodes : undefined,
      category: category.trim() || 'General',
      subcategory: subcategory.trim() || undefined,
      brand: brand.trim() || undefined,
      manufacturer: manufacturer.trim() || undefined,
      hsnCode: hsnCode.trim() || undefined,
      itemType,
      isActive,
      salePrice: Number(salePrice) || 0,
      wholesalePrice: itemCfg.enableWholesalePricing ? Number(wholesalePrice) || undefined : undefined,
      dealerPrice: Number(dealerPrice) > 0 ? Number(dealerPrice) : undefined,
      purchasePrice: Number(purchasePrice) || 0,
      purchaseUnit: purchaseUnit || unit,
      purchaseTaxRate: Number(purchaseTaxRate) || 0,
      purchaseDiscountPercent: Number(purchaseDiscountPercent) || 0,
      additionalPurchaseCharges: Number(additionalPurchaseCharges) || 0,
      preferredSupplier: preferredSupplier.trim() || undefined,
      minPurchaseQty: Math.max(0.001, Number(minPurchaseQty) || 1),
      mrp: Number(mrp) || Number(salePrice) || 0,
      minSellingPrice: Number(minSellingPrice) > 0 ? Number(minSellingPrice) : effectivePurchaseCost || 0,
      maxSellingPrice: Number(maxSellingPrice) > 0 ? Number(maxSellingPrice) : Number(mrp) || Number(salePrice) || 0,
      gstApplicable,
      taxRate: gstApplicable && businessSettings.gst.isGstRegistered ? Number(taxRate) || 0 : 0,
      gstTypePreference,
      taxInclusive: gstTypePreference === 'Inclusive',
      cessRate: Number(cessRate) || 0,
      gstInputCreditEligible,
      stock: Number(stock) || 0,
      openingStock: Number(openingStock) || Number(stock) || 0,
      reservedStock: Number(reservedStock) || 0,
      minStockAlert: Math.max(0, Number(minStockAlert) || 0),
      maxStockLevel: Math.max(0, Number(maxStockLevel) || 0),
      reorderLevel: Math.max(0, Number(reorderLevel) || 0),
      damagedStock: Math.max(0, Number(damagedStock) || 0),
      expiredStock: Math.max(0, Number(expiredStock) || 0),
      batchNo: batchNo.trim() || undefined,
      expiryDate: expiryDate || undefined,
      unit,
      godownId: godownId || 'gdw-1',
      rackNumber: rackNumber.trim() || undefined,
      shelfLocation: shelfLocation.trim() || undefined,
      unitConversion:
        secondaryUnit.trim() && conversionRate > 0
          ? { secondaryUnit: secondaryUnit.trim().toUpperCase(), rate: Number(conversionRate) }
          : undefined,
      tags: parsedTags.length > 0 ? parsedTags : undefined,
      description: description.trim() || undefined,
      image: image.trim() || undefined,
      customFields,
      lastPurchasePrice: Number(lastPurchasePrice) || Number(purchasePrice) || 0,
      weightedAvgCost: Number(weightedAvgCost) || effectivePurchaseCost || 0,
      targetMarginPercent: Number(targetMarginPercent) || 0,
      productType,
      minSellingQty: Math.max(0.001, Number(minSellingQty) || (productType === 'Loose' ? 0.05 : 1)),
      decimalPrecision: Math.min(3, Math.max(0, Number(decimalPrecision) || 0)),
      customerPrices: Object.keys(customerPrices).length > 0 ? customerPrices : undefined,
      defaultDiscountPercent: Number(defaultDiscountPercent) || 0,
      defaultDiscountAmount: Number(defaultDiscountAmount) || 0,
      maxDiscountLimitPercent: Number(maxDiscountLimitPercent) || 15,
      qtyDiscountMinQty: Number(qtyDiscountMinQty) || 0,
      qtyDiscountPercent: Number(qtyDiscountPercent) || 0,
      wholesaleDiscountPercent: Number(wholesaleDiscountPercent) || 0,
      promoDiscountPercent: Number(promoDiscountPercent) || 0,
    };

      const activeBatches = batchRows.filter((b) => b.batchNumber.trim() !== '');
      const primaryBatch = activeBatches[0];

      payload.batchNo = primaryBatch?.batchNumber.trim() || batchNo.trim() || undefined;
      payload.mfgDate = primaryBatch?.mfgDate || mfgDate || undefined;
      payload.expiryDate = primaryBatch?.expiryDate || expiryDate || undefined;

    if (editingItem) {
      const res = updateItem(editingItem.id, payload);
      if (!res.success) return;
      upsertItemBatches(
        editingItem.id,
        payload.name,
        activeBatches.map((b) => ({
          ...b,
          purchaseRate: b.purchaseRate || Number(purchasePrice) || 0,
          saleRate: b.saleRate || Number(salePrice) || 0,
        }))
      );
    } else {
      const created = addItem(payload);
      if (activeBatches.length > 0) {
        upsertItemBatches(
          created.id,
          created.name,
          activeBatches.map((b) => ({
            ...b,
            purchaseRate: b.purchaseRate || Number(purchasePrice) || 0,
            saleRate: b.saleRate || Number(salePrice) || 0,
          }))
        );
      }
      try {
        localStorage.removeItem(ITEM_DRAFT_KEY);
      } catch {
        // ignore
      }
    }

    closeModal();
  };

  const canEditBarcodeField = !editingItem || canManageBarcodes();

  const taxAmtPreview =
    gstApplicable && businessSettings.gst.isGstRegistered && taxRate > 0
      ? gstTypePreference === 'Inclusive'
        ? salePrice - salePrice / (1 + taxRate / 100)
        : (salePrice * taxRate) / 100
      : 0;

  return (
    <div className="fixed inset-0 bg-black/65 backdrop-blur-2xs flex items-center justify-center p-2 sm:p-4 z-[60]">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-4xl max-h-[93vh] flex flex-col overflow-hidden text-xs text-slate-800 dark:text-slate-100">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <PackagePlus className="w-4 h-4 text-emerald-400" />
            <div>
              <h2 className="text-sm font-bold tracking-tight">
                {editingItem ? `Edit Item — ${editingItem.name}` : 'Add New Product / Service'}
              </h2>
              <p className="text-[10px] text-slate-400">
                Complete Kirana, Retail &amp; Wholesale Item Master · Auto-calculates margins, taxes &amp; unit conversions
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasDraftNotice && !editingItem && (
              <button
                type="button"
                onClick={clearDraft}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 text-[10px] font-semibold cursor-pointer"
              >
                Clear Saved Draft
              </button>
            )}
            <button
              type="button"
              onClick={closeModal}
              aria-label="Close modal"
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Tab Bar */}
        <div className="px-5 py-2 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto shrink-0">
          {[
            { id: 'basic', label: '1. Basic & Barcodes', icon: Package },
            { id: 'stock', label: '2. Units, Stock & Rack', icon: Layers },
            { id: 'pricing', label: '3. Cost, Pricing & GST', icon: IndianRupee },
            { id: 'discounts', label: '4. Discounts & Custom', icon: Tag },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as AddItemModalTab)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-xs whitespace-nowrap transition-colors cursor-pointer ${
                  active
                    ? 'bg-slate-900 dark:bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* TAB 1: BASIC INFO & BARCODES */}
          {activeTab === 'basic' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Item Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Loose Sugar (Chini), Tata Salt 1kg"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 focus:border-blue-600 focus:outline-none font-medium"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                      Item Code *
                    </label>
                    <button
                      type="button"
                      onClick={handleAutoGenCode}
                      className="text-[10px] font-semibold text-blue-600 hover:underline cursor-pointer"
                    >
                      Auto
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="ITM-001"
                    className={`w-full bg-slate-50 dark:bg-slate-800 border rounded-lg px-2.5 py-2 font-mono font-bold focus:outline-none ${
                      codeError ? 'border-rose-500 text-rose-700' : 'border-slate-300 dark:border-slate-700 focus:border-blue-600'
                    }`}
                  />
                  {codeError && <p className="text-[10px] text-rose-600 mt-0.5">{codeError}</p>}
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    SKU Number
                  </label>
                  <input
                    type="text"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="SKU-001"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Item Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => {
                      setCategory(e.target.value);
                      setSubcategory('');
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2"
                  >
                    {itemCfg.categories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                    {!itemCfg.categories.some((c) => c.name === category) && category && (
                      <option value={category}>{category}</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Subcategory
                  </label>
                  <input
                    type="text"
                    list="add-item-subcat-list"
                    value={subcategory}
                    onChange={(e) => setSubcategory(e.target.value)}
                    placeholder="e.g. Rice, Pulses, Soap"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2"
                  />
                  <datalist id="add-item-subcat-list">
                    {categorySubOptions.map((sub) => (
                      <option key={sub} value={sub} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Brand Name
                  </label>
                  <input
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="e.g. Tata, Amul, Patanjali"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Company / Manufacturer
                  </label>
                  <input
                    type="text"
                    value={manufacturer}
                    onChange={(e) => setManufacturer(e.target.value)}
                    placeholder="e.g. Tata Consumer Products"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Item Type
                  </label>
                  <select
                    value={itemType}
                    onChange={(e) => setItemType(e.target.value as NonNullable<Item['itemType']>)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2"
                  >
                    <option value="Product">Product</option>
                    <option value="Service">Service</option>
                    <option value="Raw Material">Raw Material</option>
                    <option value="Finished Goods">Finished Goods</option>
                    <option value="Composite Product">Composite Product</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    HSN / SAC Code
                  </label>
                  <input
                    type="text"
                    value={hsnCode}
                    onChange={(e) => setHsnCode(e.target.value)}
                    placeholder="e.g. 1701 or 1006"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Status
                  </label>
                  <select
                    value={isActive ? 'active' : 'inactive'}
                    onChange={(e) => setIsActive(e.target.value === 'active')}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 font-semibold"
                  >
                    <option value="active">Active (Visible in POS &amp; Billing)</option>
                    <option value="inactive">Inactive (Archived from new bills)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tags (comma-sep)
                  </label>
                  <input
                    type="text"
                    value={tagsText}
                    onChange={(e) => setTagsText(e.target.value)}
                    placeholder="loose, kirana, staple"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2"
                  />
                </div>
              </div>

              {/* Primary + Multiple Barcodes */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-800 dark:text-slate-100">
                    <Barcode className="w-4 h-4 text-blue-600" />
                    <span>Primary &amp; Multiple Barcodes ({itemCfg.barcodeFormat})</span>
                  </label>
                  <button
                    type="button"
                    disabled={!canEditBarcodeField}
                    onClick={handleGenerateBarcode}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold disabled:opacity-40 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Auto-Generate</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-center">
                  <div className="sm:col-span-3 space-y-1">
                    <input
                      type="text"
                      value={barcode}
                      disabled={!canEditBarcodeField}
                      onChange={(e) => setBarcode(e.target.value)}
                      placeholder="Scan or enter primary barcode..."
                      className={`w-full bg-white dark:bg-slate-900 border rounded-lg px-3 py-2 font-mono font-bold text-xs focus:outline-none ${
                        barcodeError
                          ? 'border-rose-500 text-rose-700'
                          : 'border-slate-300 dark:border-slate-600 focus:border-blue-600'
                      }`}
                    />
                    {barcodeError && (
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-rose-600">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{barcodeError}</span>
                      </div>
                    )}
                  </div>
                  <div className="sm:col-span-2 bg-white rounded-lg border border-slate-200 p-1.5 flex items-center justify-center min-h-[54px]">
                    <svg ref={barcodeSvgRef} className="max-w-full max-h-12" />
                  </div>
                </div>

                {/* Extra / Secondary Barcodes */}
                <div className="pt-1.5 border-t border-slate-200 dark:border-slate-700 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newExtraBarcode}
                      onChange={(e) => setNewExtraBarcode(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddExtraBarcode();
                        }
                      }}
                      placeholder="Add alternate / pack barcode (e.g. 8901234567890)..."
                      className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 font-mono text-[11px]"
                    />
                    <button
                      type="button"
                      onClick={handleAddExtraBarcode}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-700 text-white text-[11px] font-semibold cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Barcode</span>
                    </button>
                  </div>
                  {extraBarcodes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {extraBarcodes.map((eb) => (
                        <span
                          key={eb}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono text-[10px]"
                        >
                          <span>{eb}</span>
                          <button
                            type="button"
                            onClick={() => setExtraBarcodes((prev) => prev.filter((x) => x !== eb))}
                            className="text-rose-500 hover:text-rose-700 cursor-pointer"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Description & Image */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Product Description
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Pack details, quality grade, or shelf notes..."
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Product Image URL / Upload
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={image}
                      onChange={(e) => setImage(e.target.value)}
                      placeholder="https://... or upload"
                      className="flex-1 min-w-0 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2"
                    />
                    <label className="px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-semibold cursor-pointer hover:bg-slate-100 shrink-0">
                      File
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = () => {
                            if (typeof reader.result === 'string') setImage(reader.result);
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: UNITS, STOCK & WAREHOUSE */}
          {activeTab === 'stock' && (
            <div className="space-y-4">
              {/* Units & Conversions */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 space-y-3">
                <div className="text-[11px] font-bold text-slate-800 dark:text-slate-100">
                  Measurement Units &amp; Packaging Conversions
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Base Sale Unit *
                    </label>
                    <select
                      value={unit}
                      onChange={(e) => {
                        const nextU = e.target.value;
                        setUnit(nextU);
                        if (isWeightOrVolumeUnit(nextU)) {
                          setProductType('Loose');
                          setDecimalPrecision(3);
                          if (minSellingQty >= 1) setMinSellingQty(0.05);
                        }
                      }}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2"
                    >
                      {itemCfg.units.map((u) => (
                        <option key={u.id} value={u.shortCode}>
                          {u.shortCode} ({u.name})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Purchase Unit
                    </label>
                    <select
                      value={purchaseUnit}
                      onChange={(e) => setPurchaseUnit(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2"
                    >
                      {itemCfg.units.map((u) => (
                        <option key={u.id} value={u.shortCode}>
                          {u.shortCode} ({u.name})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Secondary / Pack Unit
                    </label>
                    <input
                      type="text"
                      value={secondaryUnit}
                      onChange={(e) => setSecondaryUnit(e.target.value.toUpperCase())}
                      placeholder="e.g. BOX, CTN, BDL"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 font-mono uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      1 {secondaryUnit || 'Pack'} = ? {unit}
                    </label>
                    <input
                      type="number"
                      min="0.001"
                      step="any"
                      value={conversionRate}
                      onChange={(e) => setConversionRate(Math.max(0.001, Number(e.target.value) || 1))}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 tabular-nums"
                    />
                  </div>
                </div>

                {/* Kirana Loose / Precision controls */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Kirana Billing Mode
                    </label>
                    <select
                      value={productType}
                      onChange={(e) => {
                        const pt = e.target.value as 'Loose' | 'Packaged' | 'Piece';
                        setProductType(pt);
                        if (pt === 'Loose') {
                          setDecimalPrecision(3);
                          if (minSellingQty >= 1) setMinSellingQty(0.05);
                        }
                      }}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5"
                    >
                      <option value="Loose">Loose (Weight / Volume Auto-Calc)</option>
                      <option value="Packaged">Packaged (MRP Packet)</option>
                      <option value="Piece">Piece / Countable Item</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Min Selling Qty ({unit})
                    </label>
                    <input
                      type="number"
                      min="0.001"
                      step="any"
                      value={minSellingQty}
                      onChange={(e) => setMinSellingQty(Math.max(0.001, Number(e.target.value) || 0.001))}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Decimal Precision
                    </label>
                    <select
                      value={decimalPrecision}
                      onChange={(e) => setDecimalPrecision(Number(e.target.value))}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 tabular-nums"
                    >
                      <option value={0}>0 decimals (Whole qty)</option>
                      <option value={2}>2 decimals (0.25)</option>
                      <option value={3}>3 decimals (0.001 kg / g)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Stock Quantities & Alerts */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Opening Stock ({unit})
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={openingStock}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setOpeningStock(v);
                      if (!editingItem) setStock(v);
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Current Stock ({unit})
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={stock}
                    onChange={(e) => setStock(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 font-bold tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Reserved Stock ({unit})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={reservedStock}
                    onChange={(e) => setReservedStock(Math.max(0, Number(e.target.value)))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Available (Current - Reserved)
                  </label>
                  <div className="w-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg px-2.5 py-2 font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                    {Math.max(0, stock - reservedStock).toLocaleString('en-IN', { maximumFractionDigits: 3 })} {unit}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Min Stock Alert
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={minStockAlert}
                    onChange={(e) => setMinStockAlert(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Max Stock Level
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={maxStockLevel}
                    onChange={(e) => setMaxStockLevel(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Reorder Level
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={reorderLevel}
                    onChange={(e) => setReorderLevel(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Damaged Stock
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={damagedStock}
                    onChange={(e) => setDamagedStock(Math.max(0, Number(e.target.value)))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Expired Stock
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={expiredStock}
                    onChange={(e) => setExpiredStock(Math.max(0, Number(e.target.value)))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 tabular-nums"
                  />
                </div>
              </div>

              {/* Warehouse, Rack & Shelf Location */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Warehouse / Godown
                  </label>
                  <select
                    value={godownId}
                    onChange={(e) => setGodownId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2"
                  >
                    {godowns.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Rack Number
                  </label>
                  <input
                    type="text"
                    value={rackNumber}
                    onChange={(e) => setRackNumber(e.target.value)}
                    placeholder="e.g. R-04"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Shelf Location
                  </label>
                  <input
                    type="text"
                    value={shelfLocation}
                    onChange={(e) => setShelfLocation(e.target.value)}
                    placeholder="e.g. Shelf B2"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2"
                  />
                </div>
              </div>

              {/* Dedicated Batch Numbers, Manufacturing & Expiry Sub-Component */}
              <ItemBatchEditor
                rows={batchRows}
                onChange={(nextRows) => {
                  setBatchRows(nextRows);
                  const first = nextRows.find((r) => r.batchNumber.trim());
                  setBatchNo(first?.batchNumber || '');
                  setMfgDate(first?.mfgDate || '');
                  setExpiryDate(first?.expiryDate || '');
                }}
                unit={unit}
                defaultPurchaseRate={purchasePrice}
                defaultSaleRate={salePrice}
                defaultWarehouseId={godownId}
                godowns={godowns}
                itemStock={stock}
                enableBatchTracking={itemCfg.enableBatchTracking}
                enableExpiryTracking={itemCfg.enableExpiryTracking}
                expiryWarningDays={itemCfg.expiryWarningDays || 30}
                validation={batchValidation}
                onSyncStockToBatches={(totalQty) => {
                  setStock(totalQty);
                  if (!editingItem) setOpeningStock(totalQty);
                }}
              />
            </div>
          )}

          {/* TAB 3: PURCHASE COST, SELLING PRICES & GST */}
          {activeTab === 'pricing' && (
            <div className="space-y-4">
              {/* Purchase Details */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-slate-800 dark:text-slate-100">
                    Purchase Cost &amp; Supplier Details
                  </span>
                  <span className="text-[11px] font-semibold tabular-nums text-slate-600 dark:text-slate-300">
                    Effective Landed Cost: ₹{effectivePurchaseCost.toFixed(2)}/{unit}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Purchase Price (₹/{unit})
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={purchasePrice}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setPurchasePrice(val);
                        if (!editingItem) {
                          setLastPurchasePrice(val);
                          setWeightedAvgCost(val);
                        }
                        if (!minSellingPrice || minSellingPrice < val) setMinSellingPrice(val);
                      }}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-semibold tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Purchase Tax (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={purchaseTaxRate}
                      onChange={(e) => setPurchaseTaxRate(Number(e.target.value))}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Purchase Discount (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={purchaseDiscountPercent}
                      onChange={(e) => setPurchaseDiscountPercent(Number(e.target.value))}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Additional Charges (₹/{unit})
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={additionalPurchaseCharges}
                      onChange={(e) => setAdditionalPurchaseCharges(Number(e.target.value))}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 tabular-nums"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Last Purchase Price (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={lastPurchasePrice}
                      onChange={(e) => setLastPurchasePrice(Number(e.target.value))}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Average Purchase Price (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={weightedAvgCost}
                      onChange={(e) => setWeightedAvgCost(Number(e.target.value))}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Preferred Supplier
                    </label>
                    <input
                      type="text"
                      list="add-item-supplier-list"
                      value={preferredSupplier}
                      onChange={(e) => setPreferredSupplier(e.target.value)}
                      placeholder="Select supplier..."
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5"
                    />
                    <datalist id="add-item-supplier-list">
                      {parties.filter((p) => p.type === 'Supplier').map((p) => (
                        <option key={p.id} value={p.name} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Min Purchase Qty
                    </label>
                    <input
                      type="number"
                      min="0.001"
                      step="any"
                      value={minPurchaseQty}
                      onChange={(e) => setMinPurchaseQty(Math.max(0.001, Number(e.target.value) || 1))}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 tabular-nums"
                    />
                  </div>
                </div>
              </div>

              {/* Selling Prices & Auto Profit */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-slate-800 dark:text-slate-100">
                    Selling Price Tiers &amp; Live Profit Calculation
                  </span>
                  <div className="flex items-center gap-3 text-[11px] font-bold tabular-nums">
                    <span className={retailGrossProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}>
                      Retail Profit: ₹{retailGrossProfit.toFixed(2)} ({retailMarginPct.toFixed(1)}% margin)
                    </span>
                    {wholesalePrice > 0 && (
                      <span className="text-indigo-600 dark:text-indigo-400">
                        Wholesale Margin: {wholesaleMarginPct.toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Retail Price (₹/{unit}) *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={salePrice}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setSalePrice(val);
                        if (!mrp || mrp < val) setMrp(val);
                      }}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 font-bold text-emerald-700 dark:text-emerald-400 tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Wholesale Price (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={wholesalePrice}
                      onChange={(e) => setWholesalePrice(Number(e.target.value))}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Distributor Price (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={dealerPrice}
                      onChange={(e) => setDealerPrice(Number(e.target.value))}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Min Selling Price (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={minSellingPrice}
                      onChange={(e) => setMinSellingPrice(Number(e.target.value))}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Max Selling Price (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={maxSellingPrice}
                      onChange={(e) => setMaxSellingPrice(Number(e.target.value))}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      MRP (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={mrp}
                      onChange={(e) => setMrp(Number(e.target.value))}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 tabular-nums"
                    />
                  </div>
                </div>

                {isSellingBelowCost && (
                  <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-rose-700 dark:text-rose-300">
                    <div className="flex items-center gap-1.5 font-semibold">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>
                        Loss Alert: Net Retail Price (₹{netRetailAfterDefaultDisc.toFixed(2)}) is below effective cost (₹{effectivePurchaseCost.toFixed(2)}).
                      </span>
                    </div>
                    <label className="flex items-center gap-1.5 font-bold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allowBelowCostSave}
                        onChange={(e) => setAllowBelowCostSave(e.target.checked)}
                        className="rounded text-rose-600"
                      />
                      <span>Authorized Override</span>
                    </label>
                  </div>
                )}
              </div>

              {/* GST & Tax Settings */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-slate-800 dark:text-slate-100">
                    GST &amp; Tax Configuration
                  </span>
                  {gstApplicable && businessSettings.gst.isGstRegistered && (
                    <span className="text-[11px] tabular-nums text-slate-600 dark:text-slate-300">
                      CGST: ₹{(taxAmtPreview / 2).toFixed(2)} · SGST: ₹{(taxAmtPreview / 2).toFixed(2)} · IGST: ₹{taxAmtPreview.toFixed(2)}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-center">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      GST Applicable
                    </label>
                    <select
                      value={gstApplicable ? 'yes' : 'no'}
                      disabled={!businessSettings.gst.isGstRegistered}
                      onChange={(e) => setGstApplicable(e.target.value === 'yes')}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5"
                    >
                      <option value="yes">Yes (Taxable)</option>
                      <option value="no">No (Non-GST / Exempt)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      GST Rate %
                    </label>
                    <select
                      value={gstApplicable ? taxRate : 0}
                      disabled={!gstApplicable || !businessSettings.gst.isGstRegistered}
                      onChange={(e) => setTaxRate(Number(e.target.value))}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 disabled:opacity-60"
                    >
                      {[0, 5, 12, 18, 28].map((r) => (
                        <option key={r} value={r}>
                          {r}% GST
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Tax Mode
                    </label>
                    <select
                      value={gstTypePreference}
                      onChange={(e) => setGstTypePreference(e.target.value as 'Inclusive' | 'Exclusive')}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5"
                    >
                      <option value="Exclusive">Exclusive GST</option>
                      <option value="Inclusive">Inclusive GST</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Cess (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={cessRate}
                      onChange={(e) => setCessRate(Math.max(0, Number(e.target.value)))}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 tabular-nums"
                    />
                  </div>
                  <label className="flex items-center gap-1.5 py-2 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer text-[11px] font-semibold mt-4">
                    <input
                      type="checkbox"
                      checked={gstInputCreditEligible}
                      onChange={(e) => setGstInputCreditEligible(e.target.checked)}
                      className="rounded text-blue-600"
                    />
                    <span>ITC Eligible</span>
                  </label>
                </div>
              </div>

              {/* Special Customer-Specific Pricing */}
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                    Special Customer Price Overrides (₹/{unit})
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Fetched automatically in Sales Invoice &amp; POS
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                  <input
                    type="text"
                    list="add-item-party-options"
                    value={selectedCustName}
                    onChange={(e) => setSelectedCustName(e.target.value)}
                    placeholder="Customer name..."
                    className="sm:col-span-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs"
                  />
                  <datalist id="add-item-party-options">
                    {parties.filter((p) => p.type === 'Customer').map((p) => (
                      <option key={p.id} value={p.name} />
                    ))}
                  </datalist>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={selectedCustRate || ''}
                    onChange={(e) => setSelectedCustRate(Number(e.target.value))}
                    placeholder={`Rate ₹/${unit}`}
                    className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs tabular-nums"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const cleanCust = selectedCustName.trim();
                      if (!cleanCust || selectedCustRate <= 0) {
                        showToast('Select a customer and enter a valid positive rate.', 'warning');
                        return;
                      }
                      setCustomerPrices((prev) => ({ ...prev, [cleanCust]: Number(selectedCustRate) }));
                      setSelectedCustName('');
                      setSelectedCustRate(0);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-700 text-white text-[11px] font-semibold hover:bg-slate-800 cursor-pointer"
                  >
                    Add Rate
                  </button>
                </div>
                {Object.keys(customerPrices).length > 0 && (
                  <div className="divide-y divide-slate-200 dark:divide-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 overflow-hidden">
                    {Object.entries(customerPrices).map(([cust, rate]) => (
                      <div key={cust} className="flex items-center justify-between px-3 py-1.5 text-[11px]">
                        <span className="font-medium text-slate-700 dark:text-slate-200">{cust}</span>
                        <div className="flex items-center gap-3 tabular-nums">
                          <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                            ₹{Number(rate).toFixed(2)}/{unit}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setCustomerPrices((prev) => {
                                const next = { ...prev };
                                delete next[cust];
                                return next;
                              })
                            }
                            className="text-rose-600 hover:text-rose-700 font-semibold cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: DISCOUNTS & CUSTOM FIELDS */}
          {activeTab === 'discounts' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 space-y-3">
                <div className="text-[11px] font-bold text-slate-800 dark:text-slate-100">
                  Item Discount Management &amp; Discount Protection Limits
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Default Discount (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={defaultDiscountPercent}
                      onChange={(e) => setDefaultDiscountPercent(Math.max(0, Number(e.target.value)))}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Fixed Discount (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={defaultDiscountAmount}
                      onChange={(e) => setDefaultDiscountAmount(Math.max(0, Number(e.target.value)))}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Max Discount Limit (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={maxDiscountLimitPercent}
                      onChange={(e) => setMaxDiscountLimitPercent(Math.max(0, Number(e.target.value)))}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Promotional Discount (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={promoDiscountPercent}
                      onChange={(e) => setPromoDiscountPercent(Math.max(0, Number(e.target.value)))}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 tabular-nums"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Quantity Discount Min Qty ({unit})
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={qtyDiscountMinQty}
                      onChange={(e) => setQtyDiscountMinQty(Math.max(0, Number(e.target.value)))}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Quantity Discount (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={qtyDiscountPercent}
                      onChange={(e) => setQtyDiscountPercent(Math.max(0, Number(e.target.value)))}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Wholesale Discount (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={wholesaleDiscountPercent}
                      onChange={(e) => setWholesaleDiscountPercent(Math.max(0, Number(e.target.value)))}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 tabular-nums"
                    />
                  </div>
                </div>
              </div>

              {enabledCustomFields.length > 0 && (
                <div className="p-3.5 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/30 dark:bg-blue-950/20 space-y-2.5">
                  <div className="text-[11px] font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider">
                    Additional Item Details
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {enabledCustomFields.map((field) => (
                      <div key={field.id}>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          {field.name} {field.required && '*'}
                        </label>
                        {field.fieldType === 'Dropdown' ? (
                          <select
                            required={field.required}
                            value={customFields[field.id] ?? ''}
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
                                : field.fieldType === 'Phone'
                                ? 'tel'
                                : field.fieldType === 'URL'
                                ? 'url'
                                : 'text'
                            }
                            required={field.required}
                            value={customFields[field.id] ?? ''}
                            onChange={(e) =>
                              setCustomFields((prev) => ({ ...prev, [field.id]: e.target.value }))
                            }
                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Footer Save Bar */}
          <div className="pt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 dark:border-slate-800">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
              {name ? `${name} · Retail ₹${salePrice.toFixed(2)} · Stock ${stock} ${unit}` : 'Fill details across tabs and save'}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={Boolean(barcodeError) || Boolean(codeError)}
                className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold shadow-xs cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{editingItem ? 'Update Product' : 'Save Product'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
