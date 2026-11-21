import React, { useMemo, useState } from 'react';
import { MapPin, X, Crosshair, Search, Clock, CheckCircle2 } from 'lucide-react';
import { CustomerAddress } from '../../../types';
import { DELIVERY_HUBS, DeliveryHub, findNearestHub } from '../../../utils/customerStoreCatalog';
import { useVyapar } from '../../../context/VyaparContext';

interface DeliveryLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeHub: DeliveryHub;
  savedAddresses: CustomerAddress[];
  selectedAddressId: string | null;
  onSelectHub: (hub: DeliveryHub, addressId?: string | null) => void;
}

export const DeliveryLocationModal: React.FC<DeliveryLocationModalProps> = ({
  isOpen,
  onClose,
  activeHub,
  savedAddresses,
  selectedAddressId,
  onSelectHub,
}) => {
  const { validateDeliveryPincode, serviceAreaConfig } = useVyapar();
  const [pinInput, setPinInput] = useState(activeHub.pincode || '400001');
  const [hubSearch, setHubSearch] = useState('');
  const [geoStatus, setGeoStatus] = useState<string | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);

  const filteredHubs = useMemo(() => {
    const q = hubSearch.trim().toLowerCase();
    if (!q) return DELIVERY_HUBS;
    return DELIVERY_HUBS.filter(
      (h) =>
        h.areaName.toLowerCase().includes(q) ||
        h.cityState.toLowerCase().includes(q) ||
        h.pincode.includes(q) ||
        h.hubName.toLowerCase().includes(q)
    );
  }, [hubSearch]);

  if (!isOpen) return null;

  const handleDetectLocation = () => {
    if (!('geolocation' in navigator)) {
      setGeoStatus('Browser location unavailable — enter PIN or pick a hub below.');
      return;
    }
    setIsDetecting(true);
    setGeoStatus(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const nearest = findNearestHub(pos.coords.latitude, pos.coords.longitude);
        setIsDetecting(false);
        setGeoStatus(`Matched nearest hub: ${nearest.areaName} (${nearest.pincode})`);
        onSelectHub(nearest, null);
        onClose();
      },
      () => {
        setIsDetecting(false);
        setGeoStatus('Location permission unavailable. Select a saved address or enter a 6-digit PIN below.');
      },
      { timeout: 5000 }
    );
  };

  const handleApplyPin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = pinInput.replace(/\D/g, '').slice(0, 6);
    if (cleaned.length !== 6) {
      setGeoStatus('Please enter a valid 6-digit PIN code.');
      return;
    }
    const areaCheck = validateDeliveryPincode(cleaned);
    if (!areaCheck.serviceable) {
      setGeoStatus(`${areaCheck.message} (Serviceable PINs: ${serviceAreaConfig.allowedPincodes.slice(0, 6).join(', ')}...)`);
      return;
    }
    const existing = DELIVERY_HUBS.find((h) => h.pincode === cleaned);
    if (existing) {
      onSelectHub(existing, null);
      onClose();
      return;
    }
    const customHub: DeliveryHub = {
      id: `pin-${cleaned}`,
      areaName: `PIN Area ${cleaned}`,
      shortLabel: `PIN ${cleaned}`,
      cityState: 'Serviceable Store Zone',
      pincode: cleaned,
      eta: areaCheck.outskirtFee > 0 ? '45-60 mins' : '25-35 mins',
      hubName: 'Business Manager 360 Regional Dispatch',
      lat: activeHub.lat,
      lng: activeHub.lng,
    };
    onSelectHub(customHub, null);
    onClose();
  };

  const handlePickSavedAddress = (addr: CustomerAddress) => {
    const areaCheck = validateDeliveryPincode(addr.pincode);
    if (!areaCheck.serviceable) {
      setGeoStatus(`Saved address PIN ${addr.pincode} is out of service area: ${areaCheck.message}`);
      return;
    }
    const matched = DELIVERY_HUBS.find((h) => h.pincode === addr.pincode);
    const hubFromAddr: DeliveryHub = matched
      ? {
          ...matched,
          areaName: `${addr.area || addr.city}`,
          shortLabel: `${addr.area || addr.city}, ${addr.pincode}`,
        }
      : {
          id: `addr-${addr.id}`,
          areaName: `${addr.area || addr.city}`,
          shortLabel: `${addr.area || addr.city}`,
          cityState: `${addr.city}, ${addr.state}`,
          pincode: addr.pincode,
          eta: areaCheck.outskirtFee > 0 ? '45-60 mins' : '20-30 mins',
          hubName: `${addr.city} Local Express Hub`,
          lat: activeHub.lat,
          lng: activeHub.lng,
        };
    onSelectHub(hubFromAddr, addr.id);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[2px] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-xl max-h-[88vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-50 text-[#1D63ED] flex items-center justify-center shrink-0 mt-0.5">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Change Delivery Location</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Check hyperlocal delivery availability, ETA & local stock for your PIN code.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close delivery location modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Detect My Location */}
          <button
            type="button"
            onClick={handleDetectLocation}
            disabled={isDetecting}
            className="w-full p-3.5 rounded-xl border border-blue-200 bg-blue-50/40 hover:bg-blue-50 transition-colors flex items-center gap-3 text-left cursor-pointer"
          >
            <Crosshair className="w-4 h-4 text-[#1D63ED] shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-[#1D63ED]">
                {isDetecting ? 'Checking nearest local hub...' : 'Detect My Location'}
              </div>
              <div className="text-[11px] text-slate-500">
                Optional browser permission — matches nearest Business Manager 360 hub locally
              </div>
            </div>
          </button>

          {geoStatus && (
            <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-700">
              {geoStatus}
            </div>
          )}

          {/* PIN Code input */}
          <form onSubmit={handleApplyPin} className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-800">Enter 6-Digit PIN Code</label>
            <div className="flex gap-2.5">
              <input
                type="text"
                maxLength={6}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                placeholder="400001"
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 tabular-nums focus:outline-none focus:border-[#1D63ED]"
              />
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-[#1D63ED] hover:bg-[#1552CC] text-white text-xs font-bold whitespace-nowrap transition-colors cursor-pointer"
              >
                Check & Apply
              </button>
            </div>
          </form>

          {/* Saved Delivery Addresses */}
          {savedAddresses.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-800">Saved Delivery Addresses</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {savedAddresses.map((addr) => {
                  const isActive = selectedAddressId === addr.id;
                  return (
                    <button
                      key={addr.id}
                      type="button"
                      onClick={() => handlePickSavedAddress(addr)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        isActive
                          ? 'border-[#1D63ED] bg-blue-50/40 ring-1 ring-[#1D63ED]/30'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-900">{addr.label}</span>
                        <span className="text-[11px] font-semibold text-slate-500 tabular-nums">{addr.pincode}</span>
                      </div>
                      <p className="text-[11px] text-slate-700 truncate mt-1">
                        {addr.street}, {addr.area || addr.city}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate">
                        {addr.city}, {addr.state}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Hub Directory Search */}
          <div className="space-y-2.5">
            <label className="block text-xs font-bold text-slate-800">Search Area, City or Hub</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={hubSearch}
                onChange={(e) => setHubSearch(e.target.value)}
                placeholder="Search Bandra, Gandhi Bazaar, Connaught Place, 560004..."
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-[#1D63ED]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-52 overflow-y-auto pr-1">
              {filteredHubs.map((hub) => {
                const selected = activeHub.id === hub.id && !selectedAddressId;
                return (
                  <button
                    key={hub.id}
                    type="button"
                    onClick={() => {
                      onSelectHub(hub, null);
                      onClose();
                    }}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      selected
                        ? 'border-[#1D63ED] bg-blue-50/40'
                        : 'border-slate-200 hover:border-blue-300 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold text-slate-900 truncate">{hub.areaName}</span>
                      <span className="text-[11px] font-semibold text-slate-500 tabular-nums shrink-0">
                        {hub.pincode}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{hub.cityState}</div>
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                        <Clock className="w-3 h-3" />
                        {hub.eta}
                      </span>
                      {selected && <CheckCircle2 className="w-3.5 h-3.5 text-[#1D63ED]" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
