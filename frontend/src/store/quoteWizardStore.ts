// ============================================================
// Canopy Quotes – Quote Wizard Zustand Store
// ============================================================

import { create } from 'zustand';
import type {
  QuoteWizardState,
  WizardCustomer,
  WizardProperty,
  CatalogService,
  WizardLineItem,
  ServiceType,
  BillingType,
} from '../pages/quote-builder/types';

interface QuoteWizardStore extends QuoteWizardState {
  // Navigation
  goToStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;

  // Step 1
  setCustomer: (customer: WizardCustomer | null) => void;

  // Step 2
  setProperty: (property: WizardProperty | null) => void;

  // Step 3
  setServiceType: (type: ServiceType) => void;
  setBillingType: (type: BillingType) => void;
  setSeasonYear: (year: number | null) => void;
  toggleService: (service: CatalogService) => void;

  // After step 3 DB write
  setQuoteId: (id: string, number: string) => void;

  // Step 4
  setLineItems: (items: WizardLineItem[]) => void;
  updateLineItem: (serviceId: string, updates: Partial<WizardLineItem>) => void;
  setDiscountPct: (pct: number) => void;

  // Step 5
  setNotesInternal: (v: string) => void;
  setNotesClient: (v: string) => void;
  setSendToEmail: (v: string) => void;

  // Auto-save
  setAutoSaveStatus: (status: QuoteWizardState['autoSaveStatus']) => void;

  // Reset
  reset: () => void;
}

const INITIAL_STATE: QuoteWizardState = {
  currentStep: 1,
  customer: null,
  property: null,
  serviceType: null,
  billingType: null,
  seasonYear: new Date().getFullYear(),
  selectedServices: [],
  lineItems: [],
  discountPct: 0,
  quoteId: null,
  quoteNumber: null,
  notesInternal: '',
  notesClient: '',
  sendToEmail: '',
  autoSaveStatus: 'idle',
};

export const useQuoteWizardStore = create<QuoteWizardStore>((set) => ({
  ...INITIAL_STATE,

  goToStep: (step) => set({ currentStep: step }),
  nextStep: () => set((s) => ({ currentStep: Math.min(5, s.currentStep + 1) })),
  prevStep: () => set((s) => ({ currentStep: Math.max(1, s.currentStep - 1) })),

  setCustomer: (customer) => set({ customer, property: null }),
  setProperty: (property) => set({ property }),

  setServiceType: (serviceType) =>
    set({ serviceType, selectedServices: [], lineItems: [] }),
  setBillingType: (billingType) => set({ billingType }),
  setSeasonYear: (seasonYear) => set({ seasonYear }),

  toggleService: (service) =>
    set((s) => {
      const exists = s.selectedServices.find((sv) => sv.id === service.id);
      if (exists) {
        return {
          selectedServices: s.selectedServices.filter((sv) => sv.id !== service.id),
        };
      }
      return { selectedServices: [...s.selectedServices, service] };
    }),

  setQuoteId: (quoteId, quoteNumber) => set({ quoteId, quoteNumber }),

  setLineItems: (lineItems) => set({ lineItems }),
  updateLineItem: (serviceId, updates) =>
    set((s) => ({
      lineItems: s.lineItems.map((item) =>
        item.service_catalog_id === serviceId ? { ...item, ...updates } : item
      ),
    })),
  setDiscountPct: (discountPct) => set({ discountPct }),

  setNotesInternal: (notesInternal) => set({ notesInternal }),
  setNotesClient: (notesClient) => set({ notesClient }),
  setSendToEmail: (sendToEmail) => set({ sendToEmail }),

  setAutoSaveStatus: (autoSaveStatus) => set({ autoSaveStatus }),

  reset: () => set(INITIAL_STATE),
}));
