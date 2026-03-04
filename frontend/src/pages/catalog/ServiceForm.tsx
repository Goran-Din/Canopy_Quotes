// ============================================================
// Canopy Quotes – Service Add/Edit Form with Formula Builder
// ============================================================

import { useState, useMemo } from 'react';
import { Plus, X, Loader2, AlertCircle } from 'lucide-react';
import { api } from '../../lib/api';
import type { CatalogService, FormulaType, ServiceCategory, PricingTier, PricingFormula } from './CatalogPage';

// ─── Formula builder sub-components ───────────────────────

function FlatRateBuilder({
  rate, onChange,
}: { rate: number; onChange: (r: number) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Rate per sq ft ($)</label>
        <input
          type="number" min="0.0001" step="0.0001"
          value={rate || ''}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          placeholder="0.0085"
          className="w-40 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>
    </div>
  );
}

function TieredBuilder({
  tiers, onChange,
}: { tiers: PricingTier[]; onChange: (t: PricingTier[]) => void }) {
  function updateTier(idx: number, field: keyof PricingTier, value: any) {
    const updated = tiers.map((t, i) => i === idx ? { ...t, [field]: value } : t);
    onChange(updated);
  }
  function addTier() {
    const last = tiers[tiers.length - 1];
    const newFrom = last ? (last.to_sqft ?? 0) + 1 : 0;
    onChange([...tiers, { from_sqft: newFrom, to_sqft: null, rate_per_sqft: 0 }]);
  }
  function removeTier(idx: number) {
    onChange(tiers.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
              <th className="pb-2 pr-3 font-medium">From (sqft)</th>
              <th className="pb-2 pr-3 font-medium">To (sqft)</th>
              <th className="pb-2 pr-3 font-medium">Rate / sqft ($)</th>
              <th className="pb-2"></th>
            </tr>
          </thead>
          <tbody className="space-y-2">
            {tiers.map((tier, idx) => (
              <tr key={idx}>
                <td className="pr-3 py-1">
                  <input type="number" min="0" value={tier.from_sqft}
                    onChange={(e) => updateTier(idx, 'from_sqft', parseInt(e.target.value) || 0)}
                    className="w-24 rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </td>
                <td className="pr-3 py-1">
                  <input type="number" min="0"
                    value={tier.to_sqft ?? ''}
                    onChange={(e) => updateTier(idx, 'to_sqft', e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="max"
                    className="w-24 rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </td>
                <td className="pr-3 py-1">
                  <input type="number" min="0.0001" step="0.0001"
                    value={tier.rate_per_sqft || ''}
                    onChange={(e) => updateTier(idx, 'rate_per_sqft', parseFloat(e.target.value) || 0)}
                    placeholder="0.0095"
                    className="w-28 rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </td>
                <td className="py-1">
                  <button onClick={() => removeTier(idx)} className="text-red-400 hover:text-red-600 p-1">
                    <X size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={addTier}
        className="flex items-center gap-1.5 text-sm text-green-600 hover:text-green-800 font-medium">
        <Plus size={14} /> Add Tier
      </button>
    </div>
  );
}

function PerVisitBuilder({
  rate, onChange,
}: { rate: number; onChange: (r: number) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">Price per visit ($)</label>
      <input type="number" min="0.01" step="0.01"
        value={rate || ''}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        placeholder="95.00"
        className="w-40 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
    </div>
  );
}

function PerQuantityBuilder({
  rate, unitLabel, onRateChange, onUnitLabelChange,
}: {
  rate: number;
  unitLabel: string;
  onRateChange: (r: number) => void;
  onUnitLabelChange: (u: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Price per unit ($)</label>
        <input type="number" min="0.01" step="0.01"
          value={rate || ''}
          onChange={(e) => onRateChange(parseFloat(e.target.value) || 0)}
          placeholder="12.50"
          className="w-40 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Unit label</label>
        <input type="text" maxLength={50}
          value={unitLabel}
          onChange={(e) => onUnitLabelChange(e.target.value)}
          placeholder="e.g. bag, yard, plant"
          className="w-40 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
        <p className="text-xs text-gray-400 mt-1">Shown as the billing unit on quotes</p>
      </div>
    </div>
  );
}

// ─── Live Preview Calculator ───────────────────────────────
function PricingPreview({
  formula, minPrice,
}: { formula: PricingFormula; minPrice: number | null }) {
  const [testMeasurement, setTestMeasurement] = useState(5000);

  const result = useMemo(() => {
    try {
      if (formula.type === 'flat_rate_sqft') {
        if (!formula.rate_per_sqft) return null;
        const raw = testMeasurement * formula.rate_per_sqft;
        const applied = minPrice ? Math.max(raw, minPrice) : raw;
        return { price: applied, detail: `${testMeasurement.toLocaleString()} sqft × $${formula.rate_per_sqft} = $${raw.toFixed(2)}` };
      }
      if (formula.type === 'per_visit') {
        if (!formula.price_per_visit) return null;
        const price = formula.price_per_visit;
        return { price, detail: `$${price.toFixed(2)} per visit` };
      }
      if (formula.type === 'per_quantity') {
        if (!formula.rate_per_unit) return null;
        const qty = Math.round(testMeasurement);
        const total = qty * formula.rate_per_unit;
        const applied = minPrice ? Math.max(total, minPrice) : total;
        const label = formula.unit_label || 'unit';
        return { price: applied, detail: `${qty} ${label}${qty !== 1 ? 's' : ''} × $${formula.rate_per_unit.toFixed(2)} = $${total.toFixed(2)}` };
      }
      if (formula.type === 'tiered_sqft' && formula.tiers?.length) {
        let remaining = testMeasurement;
        let total = 0;
        const details: string[] = [];
        for (const tier of formula.tiers) {
          if (remaining <= 0) break;
          const tierMax = tier.to_sqft ?? Infinity;
          const tierSize = tier.to_sqft ? Math.min(remaining, tierMax - tier.from_sqft + 1) : remaining;
          const tierAmt = tierSize * tier.rate_per_sqft;
          total += tierAmt;
          details.push(`${tierSize.toLocaleString()} sqft × $${tier.rate_per_sqft} = $${tierAmt.toFixed(2)}`);
          remaining -= tierSize;
        }
        const applied = minPrice ? Math.max(total, minPrice) : total;
        return { price: applied, detail: details.join(' + ') };
      }
      if (formula.type === 'project_fixed') {
        return { price: null, detail: 'Salesperson enters price directly.' };
      }
    } catch { return null; }
    return null;
  }, [formula, testMeasurement, minPrice]);

  if (formula.type === 'project_fixed') {
    return (
      <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 mt-4">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Pricing Preview</p>
        <p className="text-sm text-gray-500">No formula — salesperson enters the price directly when creating the quote.</p>
      </div>
    );
  }

  const unitLabel =
    formula.type === 'per_quantity' ? (formula.unit_label || 'units')
    : formula.type === 'per_visit' ? 'visits'
    : 'sqft';

  return (
    <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 mt-4">
      <p className="text-xs font-bold text-blue-500 uppercase tracking-wide mb-3">Pricing Preview</p>
      <div className="flex items-center gap-3 mb-3">
        <label className="text-xs text-gray-600 font-medium whitespace-nowrap">Test measurement:</label>
        <input type="number" min="0" value={testMeasurement}
          onChange={(e) => setTestMeasurement(parseInt(e.target.value) || 0)}
          className="w-28 rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        <span className="text-xs text-gray-400">{unitLabel}</span>
      </div>
      {result ? (
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-blue-700">${result.price?.toFixed(2)}</span>
            {minPrice && result.price === minPrice && (
              <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">minimum applied</span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1">{result.detail}</p>
        </div>
      ) : (
        <p className="text-sm text-gray-400">Enter formula values above to see preview.</p>
      )}
    </div>
  );
}

// ─── Tier validation ───────────────────────────────────────
function validateTiers(tiers: PricingTier[]): string | null {
  if (tiers.length === 0) return 'Add at least one tier.';
  for (let i = 0; i < tiers.length; i++) {
    if (tiers[i].rate_per_sqft <= 0) return 'Rate must be greater than 0.';
    if (i < tiers.length - 1) {
      const expectedStart = (tiers[i].to_sqft ?? 0) + 1;
      if (tiers[i].to_sqft === null) return `Tier ${i + 1} must have a "To" value (only the last tier can be open-ended).`;
      if (tiers[i + 1].from_sqft !== expectedStart) {
        if (tiers[i + 1].from_sqft < expectedStart) return `Tier overlap: Tier ${i + 2} starts at ${tiers[i + 1].from_sqft} but Tier ${i + 1} ends at ${tiers[i].to_sqft}.`;
        return `Tier gap: Tier ${i + 2} starts at ${tiers[i + 1].from_sqft} but Tier ${i + 1} ends at ${tiers[i].to_sqft}. Tiers must be continuous.`;
      }
    }
    if (i === tiers.length - 1 && tiers[i].to_sqft !== null) {
      return 'The last tier must have an open upper limit (leave "To" blank).';
    }
  }
  return null;
}

// ─── Default formulas ──────────────────────────────────────
const DEFAULT_FORMULAS: Record<FormulaType, PricingFormula> = {
  flat_rate_sqft: { type: 'flat_rate_sqft', rate_per_sqft: 0.0085 },
  tiered_sqft: {
    type: 'tiered_sqft',
    tiers: [
      { from_sqft: 0, to_sqft: 5000, rate_per_sqft: 0.012 },
      { from_sqft: 5001, to_sqft: 15000, rate_per_sqft: 0.0095 },
      { from_sqft: 15001, to_sqft: null, rate_per_sqft: 0.0075 },
    ],
  },
  per_visit: { type: 'per_visit', price_per_visit: 95 },
  project_fixed: { type: 'project_fixed' },
  per_quantity: { type: 'per_quantity', rate_per_unit: 12.50, unit_label: 'bag' },
};

const BILLING_UNIT_SUGGESTIONS: Record<FormulaType, string> = {
  flat_rate_sqft: 'sqft',
  tiered_sqft: 'sqft',
  per_visit: 'visit',
  project_fixed: 'project',
  per_quantity: 'bag',
};

// ─── Main Form ─────────────────────────────────────────────
interface ServiceFormProps {
  service?: CatalogService;
  onSaved: () => void;
  onCancel: () => void;
}

export default function ServiceForm({ service, onSaved, onCancel }: ServiceFormProps) {
  const isEdit = !!service;

  const [name, setName] = useState(service?.name ?? '');
  const [category, setCategory] = useState<ServiceCategory>(service?.category ?? 'landscaping');
  const [billingUnit, setBillingUnit] = useState(service?.billing_unit ?? 'sqft');
  const [descriptionTemplate, setDescriptionTemplate] = useState(service?.description_template ?? '');
  const [sortOrder, setSortOrder] = useState(service?.sort_order ?? 10);
  const [minPrice, setMinPrice] = useState<string>(service?.min_price != null ? Number(service.min_price).toFixed(2) : '');
  const [formula, setFormula] = useState<PricingFormula>(service?.pricing_formula ?? DEFAULT_FORMULAS.flat_rate_sqft);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  // When formula type changes, reset to default for that type and suggest billing unit
  function handleFormulaTypeChange(type: FormulaType) {
    setFormula(DEFAULT_FORMULAS[type]);
    setBillingUnit(BILLING_UNIT_SUGGESTIONS[type]);
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!name.trim() || name.trim().length < 2) e.name = 'Name must be at least 2 characters.';
    if (formula.type === 'flat_rate_sqft' && (!formula.rate_per_sqft || formula.rate_per_sqft <= 0)) {
      e.formula = 'Rate per sqft must be greater than 0.';
    }
    if (formula.type === 'per_visit' && (!formula.price_per_visit || formula.price_per_visit <= 0)) {
      e.formula = 'Price per visit must be greater than 0.';
    }
    if (formula.type === 'per_quantity' && (!formula.rate_per_unit || formula.rate_per_unit <= 0)) {
      e.formula = 'Price per unit must be greater than 0.';
    }
    if (formula.type === 'per_quantity' && (!formula.unit_label || !formula.unit_label.trim())) {
      e.formula = 'Unit label is required (e.g. bag, yard, plant).';
    }
    if (formula.type === 'tiered_sqft') {
      const tierErr = validateTiers(formula.tiers ?? []);
      if (tierErr) e.formula = tierErr;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setLoading(true);
    setApiError('');

    // Build base_price_per_unit from formula
    let basePricePerUnit = 0;
    if (formula.type === 'flat_rate_sqft') basePricePerUnit = formula.rate_per_sqft ?? 0;
    if (formula.type === 'per_visit') basePricePerUnit = formula.price_per_visit ?? 0;
    if (formula.type === 'per_quantity') basePricePerUnit = formula.rate_per_unit ?? 0;
    if (formula.type === 'tiered_sqft') basePricePerUnit = formula.tiers?.[0]?.rate_per_sqft ?? 0;

    // For per_quantity, update the billing unit to match the unit label
    const effectiveBillingUnit =
      formula.type === 'per_quantity' && formula.unit_label
        ? formula.unit_label.trim().toLowerCase()
        : billingUnit;

    const payload = {
      name: name.trim(),
      category,
      billing_unit: effectiveBillingUnit,
      description_template: descriptionTemplate || undefined,
      sort_order: sortOrder,
      min_price: minPrice ? parseFloat(minPrice) : undefined,
      pricing_formula: formula,
      base_price_per_unit: basePricePerUnit,
    };

    try {
      if (isEdit) {
        await api.put(`/services/${service!.id}`, payload);
      } else {
        await api.post('/services', payload);
      }
      onSaved();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? 'Failed to save service.';
      if (msg.toLowerCase().includes('already exists') || msg.toLowerCase().includes('unique')) {
        setErrors((prev) => ({ ...prev, name: 'A service with this name already exists in your catalog.' }));
      } else {
        setApiError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  const FORMULA_TYPES: { value: FormulaType; label: string; desc: string }[] = [
    { value: 'flat_rate_sqft', label: 'Flat Rate sqft', desc: 'Fixed $ per sq ft' },
    { value: 'tiered_sqft', label: 'Tiered sqft', desc: 'Rate changes by size' },
    { value: 'per_visit', label: 'Per Visit', desc: 'Fixed $ per visit' },
    { value: 'per_quantity', label: 'Per Quantity', desc: 'Fixed $ per item/bag/unit' },
    { value: 'project_fixed', label: 'Project Fixed', desc: 'Agent sets price' },
  ];

  const CATEGORIES: { value: ServiceCategory; label: string }[] = [
    { value: 'snow', label: 'Snow Removal' },
    { value: 'landscaping', label: 'Landscaping' },
    { value: 'hardscape', label: 'Hardscape' },
    { value: 'project', label: 'Project' },
  ];

  const BILLING_UNITS = ['sqft', 'linear_ft', 'visit', 'run', 'month', 'project', 'bag', 'yard', 'unit', 'plant', 'pallet'];

  return (
    <div className="space-y-6">
      {apiError && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          <AlertCircle size={16} />{apiError}
        </div>
      )}

      {/* Basic info */}
      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Service Name <span className="text-red-500">*</span>
          </label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Parking Lot Snow Plowing (Per Push)"
            className={`w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${errors.name ? 'border-red-400' : 'border-gray-300'}`} />
          {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Category <span className="text-red-500">*</span></label>
            <select value={category} onChange={(e) => setCategory(e.target.value as ServiceCategory)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Billing Unit <span className="text-red-500">*</span></label>
            <select value={billingUnit} onChange={(e) => setBillingUnit(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
              {BILLING_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Description Template</label>
          <textarea value={descriptionTemplate} onChange={(e) => setDescriptionTemplate(e.target.value)}
            rows={2} maxLength={1000} placeholder="Pre-fills the description field in the Quote Builder."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Min Price ($) <span className="text-gray-400 font-normal">(optional)</span></label>
            <input type="number" min="0" step="0.01" value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              placeholder="Leave blank for no minimum"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Sort Order</label>
            <input type="number" min="0" value={sortOrder}
              onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
        </div>
      </div>

      {/* Formula builder */}
      <div className="rounded-xl border border-gray-200 p-5 space-y-4">
        <p className="text-sm font-bold text-gray-700">Pricing Formula <span className="text-red-500">*</span></p>

        {/* Formula type radio */}
        <div className="grid grid-cols-2 gap-2">
          {FORMULA_TYPES.map((ft) => (
            <button key={ft.value} type="button"
              onClick={() => handleFormulaTypeChange(ft.value)}
              className={`rounded-xl border-2 p-3 text-left transition-all ${formula.type === ft.value ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
              <p className="text-sm font-semibold text-gray-900">{ft.label}</p>
              <p className="text-xs text-gray-400">{ft.desc}</p>
            </button>
          ))}
        </div>

        {/* Formula inputs */}
        <div className="pt-2">
          {formula.type === 'flat_rate_sqft' && (
            <FlatRateBuilder
              rate={formula.rate_per_sqft ?? 0}
              onChange={(r) => setFormula({ ...formula, rate_per_sqft: r })}
            />
          )}
          {formula.type === 'tiered_sqft' && (
            <TieredBuilder
              tiers={formula.tiers ?? []}
              onChange={(tiers) => setFormula({ ...formula, tiers })}
            />
          )}
          {formula.type === 'per_visit' && (
            <PerVisitBuilder
              rate={formula.price_per_visit ?? 0}
              onChange={(r) => setFormula({ ...formula, price_per_visit: r })}
            />
          )}
          {formula.type === 'per_quantity' && (
            <PerQuantityBuilder
              rate={formula.rate_per_unit ?? 0}
              unitLabel={formula.unit_label ?? 'bag'}
              onRateChange={(r) => setFormula({ ...formula, rate_per_unit: r })}
              onUnitLabelChange={(u) => {
                setFormula({ ...formula, unit_label: u });
                if (u.trim()) setBillingUnit(u.trim().toLowerCase());
              }}
            />
          )}
          {formula.type === 'project_fixed' && (
            <p className="text-sm text-gray-400 italic">No formula needed — the salesperson enters the project price directly when creating the quote.</p>
          )}
          {errors.formula && (
            <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
              <AlertCircle size={12} />{errors.formula}
            </p>
          )}
        </div>

        {/* Live preview */}
        <PricingPreview formula={formula} minPrice={minPrice ? parseFloat(minPrice) : null} />
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 pt-2">
        <button onClick={onCancel}
          className="rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
          Cancel
        </button>
        <button onClick={handleSave} disabled={loading}
          className="flex items-center gap-2 rounded-xl bg-green-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 shadow-sm">
          {loading && <Loader2 size={14} className="animate-spin" />}
          {isEdit ? 'Save Changes' : 'Add Service'}
        </button>
      </div>
    </div>
  );
}
