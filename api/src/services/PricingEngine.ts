import { ServiceCatalogRepository } from '../repositories/ServiceCatalogRepository.js';
import {
  PriceCalculation,
  PricingFormula,
  PricingFormulaSchema,
} from '../types/serviceCatalog.js';

// ── Custom errors (reuse from shared error module if available) ────────────────
export class NotFoundError extends Error { constructor(msg: string) { super(msg); this.name = 'NotFoundError'; } }
export class BusinessError extends Error { constructor(msg: string) { super(msg); this.name = 'BusinessError'; } }
export class ValidationError extends Error { constructor(msg: string) { super(msg); this.name = 'ValidationError'; } }
export class PricingEngineError extends Error { constructor(msg: string) { super(msg); this.name = 'PricingEngineError'; } }

/**
 * PricingEngine — pure read-only service.
 * No database writes. Called from QuoteController (Step 4 live calculation)
 * and QuoteService.updateLineItems to validate final prices.
 */
export class PricingEngine {
  constructor(private catalogRepo: ServiceCatalogRepository) {}

  /**
   * Calculate price for a single service given a measurement.
   * Applies: formula → min_price → pricing_rules (in order).
   */
  async calculate(
    tenantId: string,
    serviceId: string,
    measurement: number,
    _measurementUnit: string
  ): Promise<PriceCalculation> {
    // 1. Load service (validates tenant scope)
    const service = await this.catalogRepo.findById(tenantId, serviceId);
    if (!service) throw new NotFoundError(`Service ${serviceId} not found`);
    if (!service.is_active) throw new BusinessError('Service is no longer active');

    // 2. Validate measurement
    if (measurement <= 0) throw new ValidationError('Measurement must be greater than 0');

    // 3. Parse and validate formula
    let formula: PricingFormula;
    try {
      formula = PricingFormulaSchema.parse(service.pricing_formula);
    } catch {
      throw new PricingEngineError('Unable to evaluate pricing formula. Contact support.');
    }

    // 4. Evaluate formula
    let calculatedTotal: number;
    let unitPrice: number;

    switch (formula.type) {
      case 'flat_rate_sqft':
        ({ calculatedTotal, unitPrice } = this.evaluateFlatRate(measurement, formula.rate_per_sqft));
        break;
      case 'tiered_sqft':
        ({ calculatedTotal, unitPrice } = this.evaluateTiered(measurement, formula.tiers));
        break;
      case 'per_visit':
        ({ calculatedTotal, unitPrice } = this.evaluatePerVisit(measurement, formula.price_per_visit));
        break;
      case 'per_quantity':
        ({ calculatedTotal, unitPrice } = this.evaluatePerQuantity(measurement, formula.rate_per_unit));
        break;
      case 'project_fixed':
        // Salesperson provides the price — measurement IS the price
        calculatedTotal = measurement;
        unitPrice = measurement;
        break;
      default:
        throw new PricingEngineError('Unknown formula type');
    }

    // 5. Apply minimum price
    const minPriceApplied = service.min_price !== null && calculatedTotal < service.min_price;
    let lineTotal = minPriceApplied ? service.min_price! : calculatedTotal;
    if (minPriceApplied) {
      unitPrice = lineTotal / measurement;
    }

    // 6. Apply pricing rules (compound, in order)
    const rules = await this.catalogRepo.findActiveRulesForService(
      tenantId,
      serviceId,
      service.category
    );

    let pricingRuleApplied = false;
    for (const rule of rules) {
      pricingRuleApplied = true;
      switch (rule.rule_type) {
        case 'percentage_markup':
          lineTotal = lineTotal * (1 + rule.adjustment_value / 100);
          break;
        case 'percentage_discount':
          lineTotal = lineTotal * (1 - rule.adjustment_value / 100);
          break;
        case 'fixed_surcharge':
          lineTotal = lineTotal + rule.adjustment_value;
          break;
        case 'fixed_discount':
          lineTotal = lineTotal - rule.adjustment_value;
          break;
      }
    }

    // 7. Round to 2 decimal places
    lineTotal = Math.round(lineTotal * 100) / 100;
    unitPrice = Math.round(unitPrice * 10000) / 10000; // 4dp for rates

    return {
      unit_price: unitPrice,
      line_total: lineTotal,
      min_price_applied: minPriceApplied,
      formula_type: formula.type,
      pricing_rule_applied: pricingRuleApplied,
    };
  }

  // ── Formula evaluators ────────────────────────────────────────────────────

  private evaluateFlatRate(
    measurement: number,
    ratePerSqft: number
  ): { calculatedTotal: number; unitPrice: number } {
    const calculatedTotal = measurement * ratePerSqft;
    return { calculatedTotal, unitPrice: ratePerSqft };
  }

  private evaluateTiered(
    measurement: number,
    tiers: Array<{ from_sqft: number; to_sqft: number | null; rate_per_sqft: number }>
  ): { calculatedTotal: number; unitPrice: number } {
    let remaining = measurement;
    let calculatedTotal = 0;

    for (const tier of tiers) {
      if (remaining <= 0) break;

      const tierMax = tier.to_sqft ?? Infinity;
      const tierSize = tierMax - tier.from_sqft;
      const sqftInThisTier = Math.min(remaining, tierSize);

      calculatedTotal += sqftInThisTier * tier.rate_per_sqft;
      remaining -= sqftInThisTier;
    }

    // Effective unit price = total / measurement
    const unitPrice = calculatedTotal / measurement;
    return { calculatedTotal, unitPrice };
  }

  private evaluatePerVisit(
    measurement: number, // number of visits
    pricePerVisit: number
  ): { calculatedTotal: number; unitPrice: number } {
    const calculatedTotal = Math.round(measurement) * pricePerVisit;
    return { calculatedTotal, unitPrice: pricePerVisit };
  }

  private evaluatePerQuantity(
    measurement: number, // number of units/bags/items
    ratePerUnit: number
  ): { calculatedTotal: number; unitPrice: number } {
    const calculatedTotal = Math.round(measurement) * ratePerUnit;
    return { calculatedTotal, unitPrice: ratePerUnit };
  }
}
