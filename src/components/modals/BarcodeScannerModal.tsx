import React, { useEffect, useRef, useState, useCallback } from 'react';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import {
  X,
  Camera,
  CameraOff,
  Barcode,
  CheckCircle2,
  AlertCircle,
  Plus,
  Volume2,
  VolumeX,
  RefreshCw,
  ShoppingCart,
  PackagePlus,
  Clock,
  Trash2,
  Usb,
  ArrowDownToLine,
  Wrench,
  Eye,
} from 'lucide-react';
import { useVyapar } from '../../context/VyaparContext';
import { Item } from '../../types';
import { findItemByBarcode, normalizeBarcode, playScanBeep } from '../../utils/barcodeUtils';

export const BarcodeScannerModal: React.FC = () => {
  const {
    isBarcodeScannerOpen,
    setIsBarcodeScannerOpen,
    barcodeScannerMode,
    items,
    recentScannedBarcodes,
    recordScannedBarcode,
    clearRecentScans,
    triggerBarcodeScannedCallback,
    setIsAddItemModalOpen,
    setEditingItem,
    setPrefilledBarcodeForNewItem,
    setSelectedItemId,
    setActiveTab,
    showToast,
  } = useVyapar();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const lastCameraScanRef = useRef<{ code: string; at: number }>({ code: '', at: 0 });

  const [manualCode, setManualCode] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoTriggerAction, setAutoTriggerAction] = useState(true);
  const [lastResult, setLastResult] = useState<{
    code: string;
    item: Item | null;
    timestamp: string;
  } | null>(null);

  const stopCamera = useCallback(() => {
    if (controlsRef.current) {
      try {
        controlsRef.current.stop();
      } catch {
        // ignore stop errors
      }
      controlsRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  const processBarcode = useCallback(
    (rawValue: string, fromCamera = false) => {
      const clean = normalizeBarcode(rawValue);
      if (!clean) return;

      const now = Date.now();
      if (
        fromCamera &&
        lastCameraScanRef.current.code === clean &&
        now - lastCameraScanRef.current.at < 1800
      ) {
        return;
      }
      lastCameraScanRef.current = { code: clean, at: now };

      const matched = findItemByBarcode(items, clean) || null;
      const timestamp = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      setLastResult({ code: clean, item: matched, timestamp });
      recordScannedBarcode(clean, matched);

      if (soundEnabled) {
        playScanBeep(Boolean(matched));
      }

      if (matched) {
        if (autoTriggerAction) {
          triggerBarcodeScannedCallback(matched, clean);
        }
      } else {
        showToast(`Barcode "${clean}" not found in inventory`, 'warning');
      }
    },
    [items, soundEnabled, autoTriggerAction, recordScannedBarcode, triggerBarcodeScannedCallback, showToast]
  );

  const startCamera = useCallback(
    async (deviceIdOverride?: string) => {
      stopCamera();
      setCameraError(null);

      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        setCameraError(
          'Live camera API is unavailable in this browser context. Use a USB/Bluetooth barcode scanner or enter the barcode manually.'
        );
        return;
      }

      try {
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
        ]);

        const reader = new BrowserMultiFormatReader(hints, {
          delayBetweenScanAttempts: 250,
          delayBetweenScanSuccess: 1200,
        });

        try {
          const videoInputs = await BrowserMultiFormatReader.listVideoInputDevices();
          setDevices(videoInputs);
          if (!deviceIdOverride && !selectedDeviceId && videoInputs.length > 0) {
            const backCam = videoInputs.find((d) =>
              /back|rear|environment/i.test(d.label)
            );
            setSelectedDeviceId((backCam || videoInputs[0]).deviceId);
          }
        } catch {
          // Ignore device enumeration failure before permission grant
        }

        const chosenDeviceId = deviceIdOverride || selectedDeviceId || undefined;
        if (!videoRef.current) return;

        setCameraActive(true);
        const controls = chosenDeviceId
          ? await reader.decodeFromVideoDevice(
              chosenDeviceId,
              videoRef.current,
              (result) => {
                if (result) {
                  processBarcode(result.getText(), true);
                }
              }
            )
          : await reader.decodeFromConstraints(
              {
                video: { facingMode: { ideal: 'environment' } },
                audio: false,
              },
              videoRef.current,
              (result) => {
                if (result) {
                  processBarcode(result.getText(), true);
                }
              }
            );

        controlsRef.current = controls;
      } catch (err: unknown) {
        setCameraActive(false);
        const message =
          err instanceof Error ? err.message : 'Unable to access camera';
        if (/Permission|NotAllowed|denied/i.test(message)) {
          setCameraError(
            'Camera permission was denied. Allow camera access in browser settings or use USB/Bluetooth/Manual barcode input.'
          );
        } else if (/NotFound|Requested device not found/i.test(message)) {
          setCameraError(
            'No webcam/camera hardware detected on this device. Connect a camera or scan via USB/Bluetooth scanner.'
          );
        } else {
          setCameraError(
            `Camera unavailable (${message}). USB/Bluetooth scanner & manual entry remain active.`
          );
        }
      }
    },
    [stopCamera, selectedDeviceId, processBarcode]
  );

  useEffect(() => {
    if (isBarcodeScannerOpen) {
      setManualCode('');
      setLastResult(null);
      setCameraError(null);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 80);
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isBarcodeScannerOpen, stopCamera]);

  if (!isBarcodeScannerOpen) return null;

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    processBarcode(manualCode, false);
    setManualCode('');
    inputRef.current?.focus();
  };

  const modeLabelMap = {
    billing: {
      title: 'Scan Barcode to Billing Invoice',
      actionLabel: 'Add to Invoice',
      icon: ShoppingCart,
    },
    pos: {
      title: 'Scan Barcode to POS Counter Cart',
      actionLabel: 'Add to POS Cart',
      icon: ShoppingCart,
    },
    purchase: {
      title: 'Scan Barcode for Purchase Inward',
      actionLabel: 'Add to Purchase Bill',
      icon: ArrowDownToLine,
    },
    adjustment: {
      title: 'Scan Barcode for Stock Adjustment',
      actionLabel: 'Select Item for Audit',
      icon: Wrench,
    },
    lookup: {
      title: 'Barcode Stock & Price Lookup',
      actionLabel: 'Inspect Product',
      icon: Eye,
    },
  };

  const modeMeta = modeLabelMap[barcodeScannerMode] || modeLabelMap.lookup;
  const ActionIcon = modeMeta.icon;

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-4xl max-h-[94vh] flex flex-col overflow-hidden text-xs text-slate-800 dark:text-slate-100">
        {/* Header */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-[#8E0E20] to-[#680714] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
              <Barcode className="w-5 h-5 text-emerald-300" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold tracking-tight truncate">{modeMeta.title}</h2>
              <p className="text-[11px] text-rose-100/80 truncate">
                Supports EAN-13, EAN-8, UPC-A, UPC-E, Code 128 &amp; Code 39 • Mobile Camera + USB/Bluetooth
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setSoundEnabled((s) => !s)}
              title={soundEnabled ? 'Mute scan beep' : 'Enable scan beep'}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => {
                stopCamera();
                setIsBarcodeScannerOpen(false);
              }}
              aria-label="Close barcode scanner"
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* LEFT: Camera Preview + USB/Manual Input */}
            <div className="space-y-4">
              {/* Live Camera Viewport */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-950 overflow-hidden relative">
                <div className="px-3.5 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-2 text-white">
                  <div className="flex items-center gap-2 text-[11px] font-bold">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        cameraActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                      }`}
                    />
                    <span>{cameraActive ? 'Live Camera Active' : 'Camera Standby'}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {devices.length > 1 && (
                      <select
                        value={selectedDeviceId}
                        onChange={(e) => {
                          setSelectedDeviceId(e.target.value);
                          if (cameraActive) void startCamera(e.target.value);
                        }}
                        className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-[10px] text-white max-w-[140px]"
                      >
                        {devices.map((d, idx) => (
                          <option key={d.deviceId} value={d.deviceId}>
                            {d.label || `Camera ${idx + 1}`}
                          </option>
                        ))}
                      </select>
                    )}

                    {cameraActive ? (
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <CameraOff className="w-3.5 h-3.5" />
                        <span>Stop</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void startCamera()}
                        className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Start Camera</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="relative h-52 sm:h-56 flex items-center justify-center bg-slate-950">
                  <video
                    ref={videoRef}
                    muted
                    playsInline
                    className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
                  />

                  {cameraActive && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="w-56 h-28 border-2 border-emerald-400/90 rounded-lg relative shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]">
                        <div className="absolute inset-x-2 top-1/2 h-0.5 bg-rose-500/90 animate-pulse shadow-[0_0_8px_#f43f5e]" />
                      </div>
                    </div>
                  )}

                  {!cameraActive && (
                    <div className="p-5 text-center space-y-2.5 max-w-xs">
                      <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-300 flex items-center justify-center mx-auto">
                        {cameraError ? <AlertCircle className="w-6 h-6 text-amber-400" /> : <Camera className="w-6 h-6 text-emerald-400" />}
                      </div>
                      {cameraError ? (
                        <p className="text-[11px] text-amber-300 leading-relaxed">{cameraError}</p>
                      ) : (
                        <p className="text-[11px] text-slate-300 leading-relaxed">
                          Tap <strong>Start Camera</strong> to scan EAN-13, UPC or Code 128 labels with your mobile/webcam.
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => void startCamera()}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>{cameraError ? 'Retry Camera' : 'Enable Live Camera'}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* USB / Bluetooth HID & Manual Barcode Entry */}
              <form
                onSubmit={handleManualSubmit}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-100">
                    <Usb className="w-4 h-4 text-blue-600" />
                    <span>USB / Bluetooth Scanner &amp; Manual Entry</span>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                    Auto-Ready
                  </span>
                </div>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Barcode className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      ref={inputRef}
                      type="text"
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      placeholder="Scan with USB/BT gun or type barcode / SKU..."
                      className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-mono font-bold focus:outline-none focus:border-[#8E0E20]"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer shrink-0"
                  >
                    Scan / Lookup
                  </button>
                </div>

                {barcodeScannerMode !== 'lookup' && (
                  <label className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoTriggerAction}
                      onChange={(e) => setAutoTriggerAction(e.target.checked)}
                      className="rounded text-[#8E0E20]"
                    />
                    <span>Automatically {modeMeta.actionLabel.toLowerCase()} when barcode matches</span>
                  </label>
                )}
              </form>
            </div>

            {/* RIGHT: Scan Result & Product Details Card */}
            <div className="flex flex-col space-y-4">
              {lastResult ? (
                lastResult.item ? (
                  <div className="rounded-xl border-2 border-emerald-400 dark:border-emerald-600 bg-emerald-50/70 dark:bg-emerald-950/30 p-4 space-y-3.5 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-600 text-white text-[11px] font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Scan Success • Product Matched</span>
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">{lastResult.timestamp}</span>
                    </div>

                    <div>
                      <div className="text-base font-extrabold text-slate-900 dark:text-white leading-snug">
                        {lastResult.item.name}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-slate-600 dark:text-slate-300">
                        <span className="font-mono font-bold bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                          Barcode: {lastResult.item.barcode || lastResult.code}
                        </span>
                        <span className="font-mono bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                          SKU: {lastResult.item.code}
                        </span>
                        {lastResult.item.brand && (
                          <span className="bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded font-semibold">
                            {lastResult.item.brand}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                        <div className="text-[10px] text-slate-400">Selling Price</div>
                        <div className="text-sm font-black text-emerald-700 dark:text-emerald-400 tabular-nums">
                          ₹{(lastResult.item.salePrice || 0).toLocaleString('en-IN')}
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                        <div className="text-[10px] text-slate-400">MRP / GST</div>
                        <div className="text-sm font-bold text-slate-800 dark:text-slate-100 tabular-nums">
                          ₹{(lastResult.item.mrp || lastResult.item.salePrice || 0).toLocaleString('en-IN')} • {lastResult.item.taxRate ?? 0}%
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                        <div className="text-[10px] text-slate-400">Available Stock</div>
                        <div
                          className={`text-sm font-black tabular-nums ${
                            lastResult.item.stock <= 0
                              ? 'text-rose-600'
                              : lastResult.item.stock <= (lastResult.item.minStockAlert ?? 5)
                              ? 'text-amber-600'
                              : 'text-emerald-700 dark:text-emerald-400'
                          }`}
                        >
                          {lastResult.item.stock} {lastResult.item.unit}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                      <span>Category: <strong>{lastResult.item.category || 'General'}</strong></span>
                      <span>Min Stock: <strong>{lastResult.item.minStockAlert ?? 5}</strong></span>
                      <span>Expiry: <strong>{lastResult.item.expiryDate || 'N/A'}</strong></span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          if (!lastResult.item) return;
                          if (barcodeScannerMode === 'lookup') {
                            setSelectedItemId(lastResult.item.id);
                            setActiveTab('items');
                            setIsBarcodeScannerOpen(false);
                          } else {
                            triggerBarcodeScannedCallback(lastResult.item, lastResult.code);
                            showToast(`Triggered ${modeMeta.actionLabel} for ${lastResult.item.name}`);
                          }
                        }}
                        className="flex-1 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <ActionIcon className="w-4 h-4" />
                        <span>{barcodeScannerMode === 'lookup' ? 'Open in Products' : `${modeMeta.actionLabel} (+1)`}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (!lastResult.item) return;
                          setEditingItem(lastResult.item);
                          setIsAddItemModalOpen(true);
                          setIsBarcodeScannerOpen(false);
                        }}
                        className="py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 font-semibold cursor-pointer"
                      >
                        Edit Item
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border-2 border-rose-400 dark:border-rose-700 bg-rose-50 dark:bg-rose-950/30 p-5 space-y-3 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-600 text-white text-[11px] font-bold">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Product Not Found</span>
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">{lastResult.timestamp}</span>
                    </div>

                    <div className="text-sm font-bold text-rose-900 dark:text-rose-200">
                      No inventory item matches barcode <span className="font-mono bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-rose-200">{lastResult.code}</span>
                    </div>
                    <p className="text-[11px] text-rose-700 dark:text-rose-300">
                      You can immediately register this product in your Kirana catalog with this scanned barcode pre-filled.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingItem(null);
                        setPrefilledBarcodeForNewItem(lastResult.code);
                        setIsBarcodeScannerOpen(false);
                        setIsAddItemModalOpen(true);
                      }}
                      className="w-full py-2.5 px-4 rounded-lg bg-[#8E0E20] hover:bg-[#740918] text-white font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <PackagePlus className="w-4 h-4" />
                      <span>Create New Product with Barcode {lastResult.code}</span>
                    </button>
                  </div>
                )
              ) : (
                <div className="flex-1 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/30 p-6 flex flex-col items-center justify-center text-center space-y-2 min-h-[210px]">
                  <Barcode className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                  <div className="font-bold text-slate-700 dark:text-slate-200">Ready to Scan</div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs">
                    Scan any EAN-13, EAN-8, UPC-A, UPC-E, Code 128 or Code 39 barcode using camera or hardware scanner.
                  </p>
                  <div className="flex flex-wrap justify-center gap-1.5 pt-2">
                    {items.slice(0, 3).map((sample) => (
                      <button
                        key={sample.id}
                        type="button"
                        onClick={() => processBarcode(sample.barcode || sample.code, false)}
                        className="px-2.5 py-1 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-emerald-400 text-[10px] font-mono cursor-pointer"
                      >
                        Quick Test: {sample.barcode || sample.code}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Scanned Products History */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
                <div className="px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-100">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>Recent Scanned Products ({recentScannedBarcodes.length})</span>
                  </div>
                  {recentScannedBarcodes.length > 0 && (
                    <button
                      type="button"
                      onClick={clearRecentScans}
                      className="text-[10px] text-rose-600 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Clear</span>
                    </button>
                  )}
                </div>

                <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                  {recentScannedBarcodes.length === 0 ? (
                    <div className="p-4 text-center text-[11px] text-slate-400">
                      No scans recorded in this session yet.
                    </div>
                  ) : (
                    recentScannedBarcodes.map((entry) => (
                      <div
                        key={entry.id}
                        className="px-3.5 py-2 flex items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                            {entry.found ? entry.itemName : `Unknown (${entry.code})`}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {entry.code} &bull; {entry.timestamp}
                            {entry.found && entry.price !== undefined ? ` • ₹${entry.price}` : ''}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => processBarcode(entry.code, false)}
                          className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white text-[10px] font-bold cursor-pointer shrink-0 transition-colors"
                        >
                          <Plus className="w-3 h-3 inline mr-0.5" />
                          Scan
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
