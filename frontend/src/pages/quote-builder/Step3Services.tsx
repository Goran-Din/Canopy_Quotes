// ============================================================
// Canopy Quotes – Step 3: Service Type & Service Selection
// ============================================================

import React, { useEffect } from 'react';
import { Check, Plus, X, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useQuoteWizardStore } from '../../store/quoteWizardStore';
import { api } from '../../lib/api';
import type { ServiceType, BillingType, CatalogService } from './types';

// ─── Service type cards config ─────────────────────────────
const SERVICE_TYPES: { value: ServiceType; label: string; icon: string; desc: string }[] = [
  { value: 'landscaping_maintenance', label: 'Landscaping', icon: '🌿', desc: 'Mowing, trimming, cleanup' },
  { value: 'snow_removal', label: 'Snow Removal', icon: '❄️', desc: 'Plowing, salting, sidewalks' },
  { value: 'hardscape', label: 'Hardscape', icon: '🧱', desc: 'Mulch, edging, stone work' },
  { value: 'project', label: 'Project', icon: '📋', desc: 'One-time custom project' },
];

// ─── Billing type options per service type ─────────────────
const BILLING_OPTIONS: Record<ServiceType, { value: BillingType; label: string }[]> = {
  landscaping_maintenance: [
    { value: 'monthly_fixed', label: 'Monthly Fixed' },
    { value: 'per_visit', label: 'Per Visit' },
  ],
  snow_removal: [
    { value: 'per_run', label: 'Per Push' },
    { value: 'monthly_fixed', label: 'Monthly Fixed' },
  ],
  hardscape: [
    { value: 'per_visit', label: 'Per Visit' },
    { value: 'project_fixed', label: 'Project Fixed' },
  ],
  project: [
    { value: 'project_fixed', label: 'Project Fixed Price' },
    { value: 'per_visit', label: 'Per Visit' },
  ],
};

// ─── Step 3A: Service Type Selection ───────────────────────
function ServiceTypeSelector() {
  const serviceType = useQuoteWizardStore((s) => s.serviceType);
  const billingType = useQuoteWizardStore((s) => s.billingType);
  const seasonYear = useQuoteWizardStore((s) => s.seasonYear);
  const setServiceType = useQuoteWizardStore((s) => s.setServiceType);
  const setBillingType = useQuoteWizardStore((s) => s.setBillingType);
  const setSeasonYear = useQuoteWizardStore((s) => s.setSeasonYear);

  const billingOptions = serviceType ? BILLING_OPTIONS[serviceType] : [];

  // Auto-select first billing type when service type changes
  useEffect(() => {
    if (serviceType && billingOptions.length > 0 && !billingType) {
      setBillingType(billingOptions[0].value);
    }
  }, [serviceType]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          What type of services are you quoting?
        </p>
        <div className="grid grid-cols-2 gap-3">
          {SERVICE_TYPES.map((st) => (
            <button
              key={st.value}
              onClick={() => setServiceType(st.value)}
              className={`rounded-xl border-2 p-4 text-left transition-all ${
                serviceType === st.value
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="text-2xl mb-1">{st.icon}</div>
              <p className="font-semibold text-gray-900 text-sm">{st.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{st.desc}</p>
              {serviceType === st.value && (
                <div className="mt-2 flex items-center gap-1 text-xs text-green-600 font-medium">
                  <Check size={12} /> Selected
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Billing type */}
      {serviceType && (
        <div>
          <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Billing Type</p>
          <div className="flex flex-wrap gap-2">
            {billingOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setBillingType(opt.value)}
                className={`rounded-lg border-2 px-4 py-2 text-sm font-medium transition-all ${
                  billingType === opt.value
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                {billingType === opt.value && <Check size={12} className="inline mr-1" />}
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Season year */}
      {serviceType && (
        <div>
          <label className="block text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
            Season Year <span className="text-xs font-normal text-gray-400 normal-case">(optional)</span>
          </label>
          <input
            type="number"
            value={seasonYear ?? ''}
            onChange={(e) => setSeasonYear(e.target.value ? Number(e.target.value) : null)}
            placeholder={String(new Date().getFullYear())}
            min={2020}
            max={2040}
            className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
      )}
    </div>
  );
}

// ─── Step 3B: Service Catalog Browser ──────────────────────
function ServiceCatalogBrowser() {
  const serviceType = useQuoteWizardStore((s) => s.serviceType);
  const selectedServices = useQuoteWizardStore((s) => s.selectedServices);
  const toggleService = useQuoteWizardStore((s) => s.toggleService);

  // Map service types to API category param
  const categoryMap: Record<ServiceType, string> = {
    landscaping_maintenance: 'landscaping',
    snow_removal: 'snow',
    hardscape: 'hardscape',
    project: 'project',
  };

  const category = serviceType ? categoryMap[serviceType] : null;

  const { data, isLoading } = useQuery<{ services: CatalogService[] }>({
    queryKey: ['services-catalog', category],
    queryFn: () => api.get(`/services?category=${category}&active=true`),
    enabled: !!category,
    staleTime: 60_000,
  });

  const services = data?.services ?? [];

  // Group services by category sub-label (we'll use first word of name as group)
  const groups = services.reduce((acc: Record<string, CatalogService[]>, svc) => {
    const group = svc.category ?? 'Other';
    if (!acc[group]) acc[group] = [];
    acc[group].push(svc);
    return acc;
  }, {});

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="animate-spin text-green-600" size={28} />
      </div>
    );
  }

  if (services.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-400">
        <p className="text-sm">No services configured for this type.</p>
        <p className="text-xs mt-1">Contact your account owner to add services to the catalog.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {Object.entries(groups).map(([group, groupServices]) => (
        <div key={group}>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{group}</p>
          <div className="space-y-2">
            {groupServices.map((svc) => {
              const isSelected = selectedServices.some((s) => s.id === svc.id);
              return (
                <div
                  key={svc.id}
                  className={`flex items-center justify-between rounded-xl border p-4 transition-all ${
                    isSelected ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex-1 mr-3">
                    <p className="font-medium text-gray-900 text-sm">{svc.name}</p>
                    {svc.description_template && (
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{svc.description_template}</p>
                    )}
                    <p className="text-xs text-gray-300 mt-0.5">Pricing calculated from your measurements</p>
                  </div>
                  <button
                    onClick={() => toggleService(svc)}
                    className={`flex-shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                      isSelected
                        ? 'bg-green-600 text-white hover:bg-red-500'
                        : 'bg-gray-100 text-gray-600 hover:bg-green-100 hover:text-green-700'
                    }`}
                  >
                    {isSelected ? <><Check size={12} /> Added</> : <><Plus size={12} /> Add</>}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Selected footer strip */}
      {selectedServices.length > 0 && (
        <div className="rounded-xl bg-gray-900 text-white p-4">
          <p className="text-xs font-semibold text-gray-400 mb-2">
            SELECTED ({selectedServices.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {selectedServices.map((svc) => (
              <span key={svc.id} className="flex items-center gap-1.5 rounded-full bg-green-600 px-3 py-1 text-xs font-medium">
                <Check size={10} />
                {svc.name}
                <button onClick={() => toggleService(svc)} className="ml-1 hover:text-red-300">
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Step 3 Main ───────────────────────────────────────────
export default function Step3Services() {
  const serviceType = useQuoteWizardStore((s) => s.serviceType);
  const billingType = useQuoteWizardStore((s) => s.billingType);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Select Services</h2>
        <p className="mt-1 text-sm text-gray-500">Choose the service type, billing method, and specific services.</p>
      </div>

      <ServiceTypeSelector />

      {/* Divider + catalog browser — only show when both type and billing selected */}
      {serviceType && billingType && (
        <>
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
              Select Specific Services
            </h3>
            <ServiceCatalogBrowser />
          </div>
        </>
      )}
    </div>
  );
}
