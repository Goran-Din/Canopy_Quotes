import type { QuoteDetail } from '../../types';
import { formatCurrency } from '../../utils';

interface Props {
  quote: QuoteDetail;
}

export default function QuoteLineItemsTable({ quote }: Props) {
  const hasDiscount =
    (quote.discount_pct && quote.discount_pct > 0) ||
    (quote.discount_amount && quote.discount_amount > 0);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Services
        </h2>
      </div>

      {/* Line items table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Service</th>
              <th className="px-5 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">Qty</th>
              <th className="px-5 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">Unit Price</th>
              <th className="px-5 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">Total</th>
            </tr>
          </thead>
          <tbody>
            {quote.line_items.map((item) => (
              <tr key={item.id} className="border-b border-gray-50 last:border-0">
                <td className="px-5 py-3">
                  <p className="text-sm font-medium text-gray-900">{item.service_name}</p>
                  {item.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                  )}
                  {item.frequency && (
                    <p className="text-xs text-blue-600 mt-0.5">{item.frequency}</p>
                  )}
                </td>
                <td className="px-5 py-3 text-right">
                  <span className="text-sm text-gray-700">
                    {item.quantity} {item.unit}
                  </span>
                </td>
                <td className="px-5 py-3 text-right">
                  <span className="text-sm text-gray-700">{formatCurrency(item.unit_price)}</span>
                </td>
                <td className="px-5 py-3 text-right">
                  <span className="text-sm font-semibold text-gray-900">
                    {formatCurrency(item.line_total)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pricing summary */}
      <div className="px-5 py-4 bg-gray-50 border-t border-gray-100 space-y-2">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Subtotal</span>
          <span>{formatCurrency(quote.subtotal)}</span>
        </div>

        {hasDiscount && (
          <div className="flex justify-between text-sm text-green-700">
            <span>
              Discount
              {quote.discount_pct ? ` (${quote.discount_pct}%)` : ''}
            </span>
            <span>
              −{formatCurrency(quote.discount_amount ?? (quote.subtotal * (quote.discount_pct ?? 0)) / 100)}
            </span>
          </div>
        )}

        <div className="flex justify-between font-bold text-lg text-gray-900 pt-2 border-t border-gray-200">
          <span>Total</span>
          <span>{formatCurrency(quote.total_amount)}</span>
        </div>
      </div>
    </div>
  );
}
