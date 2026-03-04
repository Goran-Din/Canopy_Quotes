// ============================================================
// Canopy Quotes – Service Catalog Management Page
// Owner role only
// ============================================================

import React, { useState, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Edit2, Ban, RefreshCw, ChevronDown, ChevronUp,
  Snowflake, Leaf, Layers, ClipboardList, AlertCircle, X, Loader2
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../lib/api';
import ServiceForm from './ServiceForm';

// ─── Types ────────────────────────────────────────────────
export type FormulaType = 'flat_rate_sqft' | 'tiered_sqft' | 'per_visit' | 'project_fixed' | 'per_quantity';
export type ServiceCategory = 'snow' | 'landscaping' | 'hardscape' | 'project';

export interface PricingTier {
  from_sqft: number;
  to_sqft: number | null;
  rate_per_sqft: number;
}

export interface PricingFormula {
  type: FormulaType;
  rate_per_sqft?: number;
  price_per_visit?: number;
  rate_per_unit?: number;
  unit_label?: string;
  tiers?: PricingTier[];
  notes?: string;
}

export interface CatalogService {
  id: string;
  name: string;
  category: ServiceCategory;
  billing_unit: string;
  description_template: string | null;
  sort_order: number;
  is_active: boolean;
  base_price_per_unit: number;
  min_price: number | null;
  pricing_formula: PricingFormula;
}

// ─── Category config ───────────────────────────────────────
const CATEGORIES: { value: ServiceCategory; label: string; icon: React.ReactNode }[] = [
  { value: 'snow', label: 'Snow Removal', icon: <Snowflake size={16} className="text-blue-400" /> },
  { value: 'landscaping', label: 'Landscaping', icon: <Leaf size={16} className="text-green-500" /> },
  { value: 'hardscape', label: 'Hardscape', icon: <Layers size={16} className="text-amber-500" /> },
  { value: 'project', label: 'Project', icon: <ClipboardList size={16} className="text-purple-400" /> },
];

function formulaBadge(f: PricingFormula, _minPrice: number | null) {
  const typeLabel: Record<FormulaType, string> = {
    flat_rate_sqft: 'flat sqft',
    tiered_sqft: 'tiered sqft',
    per_visit: 'per visit',
    project_fixed: 'project fixed',
    per_quantity: 'per quantity',
  };
  const color: Record<FormulaType, string> = {
    flat_rate_sqft: 'bg-blue-50 text-blue-700 border-blue-200',
    tiered_sqft: 'bg-purple-50 text-purple-700 border-purple-200',
    per_visit: 'bg-green-50 text-green-700 border-green-200',
    project_fixed: 'bg-amber-50 text-amber-700 border-amber-200',
    per_quantity: 'bg-teal-50 text-teal-700 border-teal-200',
  };
  return (
    <span className={`rounded border px-2 py-0.5 text-xs font-medium ${color[f.type]}`}>
      {typeLabel[f.type]}
    </span>
  );
}

// ─── Confirm Dialog ────────────────────────────────────────
function ConfirmDialog({
  title, message, confirmLabel, onConfirm, onCancel, danger = true,
}: {
  title: string; message: string; confirmLabel: string;
  onConfirm: () => void; onCancel: () => void; danger?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start gap-3 mb-4">
          <AlertCircle size={22} className={danger ? 'text-red-500 flex-shrink-0 mt-0.5' : 'text-amber-500 flex-shrink-0 mt-0.5'} />
          <div>
            <p className="font-bold text-gray-900">{title}</p>
            <p className="text-sm text-gray-500 mt-1">{message}</p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-500 hover:bg-amber-600'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Service Row ───────────────────────────────────────────
function ServiceRow({
  service,
  onEdit,
  onDeactivate,
  onReactivate,
}: {
  service: CatalogService;
  onEdit: (s: CatalogService) => void;
  onDeactivate: (s: CatalogService) => void;
  onReactivate: (s: CatalogService) => void;
}) {
  return (
    <div className={`flex items-center justify-between rounded-xl border px-4 py-3 ${service.is_active ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100 opacity-70'}`}>
      <div className="flex-1 min-w-0 mr-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-gray-900 text-sm">{service.name}</span>
          {formulaBadge(service.pricing_formula, service.min_price)}
          {service.min_price != null && (
            <span className="text-xs text-gray-400">min ${Number(service.min_price).toFixed(2)}</span>
          )}
        </div>
        {service.description_template && (
          <p className="text-xs text-gray-400 mt-0.5 truncate">{service.description_template}</p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {service.is_active ? (
          <>
            <button
              onClick={() => onEdit(service)}
              className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              <Edit2 size={12} /> Edit
            </button>
            <button
              onClick={() => onDeactivate(service)}
              title="Deactivate"
              className="rounded-lg border border-red-200 p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600"
            >
              <Ban size={14} />
            </button>
          </>
        ) : (
          <button
            onClick={() => onReactivate(service)}
            className="flex items-center gap-1 rounded-lg border border-green-300 px-3 py-1.5 text-xs font-medium text-green-600 hover:bg-green-50"
          >
            <RefreshCw size={12} /> Reactivate
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────
export default function CatalogPage() {
  const queryClient = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);

  const [showAddForm, setShowAddForm] = useState(false);
  const [editService, setEditService] = useState<CatalogService | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<CatalogService | null>(null);
  const [showDeactivated, setShowDeactivated] = useState(false);

  // ─── Fetch services ──────────────────────────────────────
  const { data, isLoading, error } = useQuery<{ services: CatalogService[] }>({
    queryKey: ['catalog-services'],
    queryFn: () => api.get('/services?active=false'),
  });

  const allServices = data?.services ?? [];
  const activeServices = allServices.filter((s) => s.is_active);
  const inactiveServices = allServices.filter((s) => !s.is_active);

  // Group active by category
  const grouped = useMemo(() => {
    return CATEGORIES.map((cat) => ({
      ...cat,
      services: activeServices.filter((s) => s.category === cat.value),
    })).filter((g) => g.services.length > 0);
  }, [activeServices]);

  // ─── Deactivate ──────────────────────────────────────────
  const deactivateMutation = useMutation({
    mutationFn: (id: string) => api.put(`/services/${id}/deactivate`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog-services'] });
      setDeactivateTarget(null);
    },
  });

  // ─── Reactivate ──────────────────────────────────────────
  const reactivateMutation = useMutation({
    mutationFn: (id: string) => api.put(`/services/${id}/reactivate`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['catalog-services'] }),
  });

  // Role guard — AFTER all hooks (React Rules of Hooks)
  if (role && role !== 'owner') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Service Catalog</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage services and pricing formulas</p>
          </div>
          <button
            onClick={() => { setShowAddForm(true); setEditService(null); }}
            className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 shadow-sm"
          >
            <Plus size={16} />
            Add Service
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">

        {/* Add form */}
        {showAddForm && (
          <div className="rounded-2xl border border-green-200 bg-white shadow-sm overflow-hidden">
            <div className="bg-green-50 border-b border-green-100 px-6 py-4 flex items-center justify-between">
              <p className="font-bold text-green-900">Add New Service</p>
              <button onClick={() => setShowAddForm(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="p-6">
              <ServiceForm
                onSaved={() => {
                  setShowAddForm(false);
                  queryClient.invalidateQueries({ queryKey: ['catalog-services'] });
                }}
                onCancel={() => setShowAddForm(false)}
              />
            </div>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-green-600" size={36} />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            <AlertCircle size={16} /> Failed to load services. Please refresh the page.
          </div>
        )}

        {/* Active services grouped by category */}
        {!isLoading && activeServices.length === 0 && !showAddForm && (
          <div className="text-center py-16 text-gray-400">
            <ClipboardList size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No active services yet.</p>
            <p className="text-sm mt-1">Click + Add Service to create your first service.</p>
          </div>
        )}

        {grouped.map((group) => (
          <div key={group.value}>
            <div className="flex items-center gap-2 mb-3">
              {group.icon}
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest">{group.label}</h2>
              <span className="text-xs text-gray-300">({group.services.length})</span>
            </div>
            <div className="space-y-2">
              {group.services.map((svc) => (
                <ServiceRow
                  key={svc.id}
                  service={svc}
                  onEdit={(s) => { setEditService(s); setShowAddForm(false); }}
                  onDeactivate={setDeactivateTarget}
                  onReactivate={(s) => reactivateMutation.mutate(s.id)}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Deactivated section */}
        {inactiveServices.length > 0 && (
          <div>
            <button
              onClick={() => setShowDeactivated((v) => !v)}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 font-medium"
            >
              {showDeactivated ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              Deactivated Services ({inactiveServices.length})
            </button>
            {showDeactivated && (
              <div className="mt-3 space-y-2">
                {inactiveServices.map((svc) => (
                  <ServiceRow
                    key={svc.id}
                    service={svc}
                    onEdit={(s) => setEditService(s)}
                    onDeactivate={setDeactivateTarget}
                    onReactivate={(s) => reactivateMutation.mutate(s.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit slide-over */}
      {editService && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1 bg-black/30" onClick={() => setEditService(null)} />
          <div className="w-full max-w-lg bg-white shadow-2xl flex flex-col">
            <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
              <p className="font-bold text-gray-900">Edit Service</p>
              <button onClick={() => setEditService(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <ServiceForm
                service={editService}
                onSaved={() => {
                  setEditService(null);
                  queryClient.invalidateQueries({ queryKey: ['catalog-services'] });
                }}
                onCancel={() => setEditService(null)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Deactivate confirm */}
      {deactivateTarget && (
        <ConfirmDialog
          title={`Deactivate "${deactivateTarget.name}"?`}
          message="It will no longer appear for new quotes. Existing quotes are not affected."
          confirmLabel="Deactivate"
          onConfirm={() => deactivateMutation.mutate(deactivateTarget.id)}
          onCancel={() => setDeactivateTarget(null)}
        />
      )}
    </div>
  );
}
