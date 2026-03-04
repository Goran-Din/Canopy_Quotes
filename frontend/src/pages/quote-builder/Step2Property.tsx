// ============================================================
// Canopy Quotes – Step 2: Property Selection
// ============================================================

import React, { useState } from 'react';
import { MapPin, Check, Plus, X, Loader2, AlertCircle } from 'lucide-react';
import { useQuoteWizardStore } from '../../store/quoteWizardStore';
import { useCustomerProperties } from '../customers/hooks';
import { api } from '../../lib/api';
import type { WizardProperty } from './types';

// ─── Inline New Property Form ──────────────────────────────
function NewPropertyForm({
  customerId,
  onCreated,
  onCancel,
}: {
  customerId: string;
  onCreated: (p: WizardProperty) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name: '',
    type: 'commercial' as 'commercial' | 'residential',
    street: '',
    city: '',
    state: 'IL',
    zip: '',
    lawn_area_sqft: '',
    parking_area_sqft: '',
    sidewalk_linear_ft: '',
    total_area_sqft: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [nameError, setNameError] = useState('');

  async function handleSave() {
    if (!form.name.trim()) { setNameError('Property name is required.'); return; }
    setLoading(true);
    setError('');
    try {
      const address: Record<string, string> = {};
      if (form.street) address.street = form.street;
      if (form.city) address.city = form.city;
      if (form.state) address.state = form.state;
      if (form.zip) address.zip = form.zip;

      const payload: any = {
        name: form.name.trim(),
        type: form.type,
        address: Object.keys(address).length > 0 ? address : undefined,
        notes: form.notes || undefined,
      };
      ['lawn_area_sqft', 'parking_area_sqft', 'sidewalk_linear_ft', 'total_area_sqft'].forEach((k) => {
        const v = (form as any)[k];
        if (v) payload[k] = Number(v);
      });
      const result = await api.post(`/customers/${customerId}/properties`, payload);
      onCreated(result);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to add property.');
    } finally {
      setLoading(false);
    }
  }

  const f = (field: keyof typeof form, val: string) =>
    setForm((prev) => ({ ...prev, [field]: val }));

  return (
    <div className="mt-4 rounded-xl border-2 border-green-200 bg-green-50 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-green-800">+ Add New Property</p>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700">
          <AlertCircle size={14} />{error}
        </div>
      )}

      {/* Type */}
      <div className="flex rounded-lg border border-gray-300 overflow-hidden w-fit bg-white">
        {(['commercial', 'residential'] as const).map((t) => (
          <button key={t} type="button" onClick={() => f('type', t)}
            className={`px-4 py-2 text-sm font-medium capitalize ${form.type === t ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Name */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Property Name <span className="text-red-500">*</span></label>
        <input type="text" value={form.name} onChange={(e) => { f('name', e.target.value); setNameError(''); }}
          placeholder="e.g. Main Office, Warehouse" className={`w-full rounded-lg border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500 ${nameError ? 'border-red-400' : 'border-gray-300'}`} />
        {nameError && <p className="mt-1 text-xs text-red-600">{nameError}</p>}
      </div>

      {/* Address */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Street Address</label>
        <input type="text" value={form.street} onChange={(e) => f('street', e.target.value)}
          placeholder="123 Main Street" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-1">
          <label className="block text-xs font-medium text-gray-700 mb-1">City</label>
          <input type="text" value={form.city} onChange={(e) => f('city', e.target.value)} placeholder="Aurora"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">State</label>
          <input type="text" value={form.state} onChange={(e) => f('state', e.target.value.toUpperCase())} maxLength={2}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white uppercase focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">ZIP</label>
          <input type="text" value={form.zip} onChange={(e) => f('zip', e.target.value)} maxLength={10}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
      </div>

      {/* Measurements */}
      <div>
        <p className="text-xs font-semibold text-gray-600 mb-2">Measurements (optional — used for auto-pricing)</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { f: 'lawn_area_sqft', label: 'Lawn Area (sq ft)' },
            { f: 'parking_area_sqft', label: 'Parking Area (sq ft)' },
            { f: 'sidewalk_linear_ft', label: 'Sidewalk (linear ft)' },
            { f: 'total_area_sqft', label: 'Total Area (sq ft)' },
          ].map(({ f: field, label }) => (
            <div key={field}>
              <label className="block text-xs text-gray-600 mb-1">{label}</label>
              <input type="number" min="0" value={(form as any)[field]}
                onChange={(e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))}
                placeholder="0" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
          ))}
        </div>
      </div>

      <button onClick={handleSave} disabled={loading}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-green-600 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
        {loading && <Loader2 size={14} className="animate-spin" />}
        Save & Select Property
      </button>
    </div>
  );
}

// ─── Step 2 Main ───────────────────────────────────────────
export default function Step2Property() {
  const [showNewForm, setShowNewForm] = useState(false);

  const customer = useQuoteWizardStore((s) => s.customer);
  const property = useQuoteWizardStore((s) => s.property);
  const setProperty = useQuoteWizardStore((s) => s.setProperty);

  const { data, isLoading, refetch } = useCustomerProperties(customer?.id ?? null);
  const properties = data?.properties ?? [];

  function handleCreated(p: WizardProperty) {
    setProperty(p);
    setShowNewForm(false);
    refetch();
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Select Property</h2>
        <p className="mt-1 text-sm text-gray-500">
          Service location for <span className="font-medium text-gray-700">{customer?.name}</span>
        </p>
      </div>

      {/* Selected property */}
      {property && (
        <div className="flex items-center justify-between rounded-xl border-2 border-green-500 bg-green-50 p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center">
              <Check size={16} className="text-white" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">{property.name}</p>
              <p className="text-xs text-gray-500">
                {property.address?.street && `${property.address.street}, `}{property.address?.city}, {property.address?.state}
              </p>
            </div>
          </div>
          <button onClick={() => setProperty(null)} className="rounded-lg p-1.5 text-gray-400 hover:bg-green-100">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Property list */}
      {!property && (
        <>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin text-green-600" size={28} /></div>
          ) : properties.length === 0 ? (
            <div className="text-center py-6 text-gray-400">
              <MapPin size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No properties on file for this customer.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {properties.map((p: any) => (
                <button key={p.id} onClick={() => setProperty(p)}
                  className="w-full text-left rounded-xl border border-gray-200 p-4 hover:border-green-400 hover:bg-green-50 transition-colors">
                  <p className="font-semibold text-gray-900 text-sm">{p.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {p.address?.street && `${p.address.street}, `}{p.address?.city}, {p.address?.state}
                  </p>
                  {(p.lawn_area_sqft || p.total_area_sqft) && (
                    <div className="flex gap-2 mt-2">
                      {p.lawn_area_sqft && <span className="rounded bg-green-50 border border-green-200 px-2 py-0.5 text-xs text-green-700">Lawn: {Number(p.lawn_area_sqft).toLocaleString()} sqft</span>}
                      {p.total_area_sqft && <span className="rounded bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs text-amber-700">Total: {Number(p.total_area_sqft).toLocaleString()} sqft</span>}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {!showNewForm ? (
            <button onClick={() => setShowNewForm(true)}
              className="flex items-center gap-2 text-sm text-green-600 hover:text-green-800 font-medium">
              <Plus size={16} />+ Add New Property
            </button>
          ) : (
            <NewPropertyForm
              customerId={customer!.id}
              onCreated={handleCreated}
              onCancel={() => setShowNewForm(false)}
            />
          )}
        </>
      )}
    </div>
  );
}
