import type { QuoteStatus } from '../../types';
import { getStatusConfig } from '../../utils';

interface StatusBadgeProps {
  status: QuoteStatus;
  isOldDraft?: boolean;
}

export default function StatusBadge({ status, isOldDraft }: StatusBadgeProps) {
  const config = getStatusConfig(status);
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${config.className}`}
      >
        {config.label}
      </span>
      {isOldDraft && status === 'draft' && (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 border border-orange-300">
          Old
        </span>
      )}
    </span>
  );
}
