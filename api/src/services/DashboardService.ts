import { Pool } from 'pg';
import { DashboardRepository } from '../repositories/DashboardRepository.js';
import { EmailService } from './EmailService.js';
import {
  QuoteListResult,
  QuoteDetail,
  QuoteStats,
  QuoteFilters,
  UserRole,
} from '../types/dashboard.types.js';

// ── Custom errors ─────────────────────────────────────────────────────────────
export class ForbiddenError extends Error {
  constructor(msg: string) { super(msg); this.name = 'ForbiddenError'; }
}
export class ConflictError extends Error {
  constructor(msg: string) { super(msg); this.name = 'ConflictError'; }
}
export class NotFoundError extends Error {
  constructor(msg: string) { super(msg); this.name = 'NotFoundError'; }
}

// ── Valid status transitions ──────────────────────────────────────────────────
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  sent: ['approved', 'rejected', 'expired'],
  approved: ['converted'],
  rejected: [],
  expired: ['sent'],    // can be re-sent
  draft: ['sent'],
  converted: [],
};

const STATUS_CHANGE_ROLES: string[] = ['owner', 'division_manager', 'n37_super_admin'];

export class DashboardService {
  constructor(
    private dashboardRepo: DashboardRepository,
    private emailService: EmailService,
    _db: Pool
  ) {}

  // ── List quotes ───────────────────────────────────────────────────────────

  async listQuotes(
    tenantId: string,
    userId: string,
    role: UserRole,
    filters: QuoteFilters
  ): Promise<QuoteListResult> {
    return this.dashboardRepo.listQuotes(tenantId, userId, role, filters);
  }

  // ── Stats panel ───────────────────────────────────────────────────────────

  async getStats(
    tenantId: string,
    userId: string,
    role: UserRole,
    month?: string
  ): Promise<QuoteStats> {
    return this.dashboardRepo.getStats(tenantId, userId, role, month);
  }

  // ── Quote detail ──────────────────────────────────────────────────────────

  async getQuoteDetail(
    tenantId: string,
    quoteId: string,
    userId: string,
    role: UserRole
  ): Promise<QuoteDetail> {
    const detail = await this.dashboardRepo.getQuoteDetail(tenantId, quoteId);
    if (!detail) throw new NotFoundError(`Quote ${quoteId} not found`);

    // Salesperson can only see their own quotes
    if (role === 'salesperson' && detail.salesperson_id !== userId) {
      throw new ForbiddenError('You do not have access to this quote');
    }

    return detail;
  }

  // ── Status change (approve / reject) ─────────────────────────────────────

  async changeStatus(
    tenantId: string,
    quoteId: string,
    newStatus: 'approved' | 'rejected',
    changedBy: string,
    role: UserRole
  ): Promise<void> {
    // Only owners and division managers can change status
    if (!STATUS_CHANGE_ROLES.includes(role)) {
      throw new ForbiddenError('Only owners and managers can approve or reject quotes');
    }

    const quote = await this.dashboardRepo.findById(tenantId, quoteId);
    if (!quote) throw new NotFoundError(`Quote ${quoteId} not found`);

    // Validate transition
    const allowed = ALLOWED_TRANSITIONS[quote.status] ?? [];
    if (!allowed.includes(newStatus)) {
      throw new ConflictError(
        `Cannot change status from '${quote.status}' to '${newStatus}'`
      );
    }

    await this.dashboardRepo.updateStatus(tenantId, quoteId, newStatus, changedBy);

    // Send status alert email (fire-and-forget — errors logged internally)
    try {
      await this.emailService.sendQuoteStatusAlert(tenantId, quoteId, newStatus, changedBy);
    } catch (err) {
      console.error('[DashboardService] Status alert email failed (non-fatal):', err);
    }
  }

  // ── Duplicate quote ───────────────────────────────────────────────────────

  async duplicateQuote(
    tenantId: string,
    sourceQuoteId: string,
    requestedBy: string
  ): Promise<{ id: string; quote_number: string }> {
    const source = await this.dashboardRepo.findById(tenantId, sourceQuoteId);
    if (!source) throw new NotFoundError(`Quote ${sourceQuoteId} not found`);

    const newQuoteNumber = await this.dashboardRepo.getNextQuoteNumber(tenantId);
    return this.dashboardRepo.duplicateQuote(tenantId, sourceQuoteId, requestedBy, newQuoteNumber);
  }

  // ── Delete draft ──────────────────────────────────────────────────────────

  async deleteQuote(
    tenantId: string,
    quoteId: string,
    requestedBy: string,
    role: UserRole
  ): Promise<string> {
    const quote = await this.dashboardRepo.findById(tenantId, quoteId);
    if (!quote) throw new NotFoundError(`Quote ${quoteId} not found`);

    // Only drafts can be deleted
    if (quote.status !== 'draft') {
      throw new ConflictError(`Cannot delete a quote with status '${quote.status}'`);
    }

    // Salesperson can only delete their own draft
    if (role === 'salesperson' && quote.created_by !== requestedBy) {
      throw new ForbiddenError('You can only delete your own draft quotes');
    }

    await this.dashboardRepo.deleteDraft(tenantId, quoteId);
    return quote.quote_number;
  }
}
