import { formatCurrency } from '@/lib/utils';

interface SubtotalDisplayProps {
  basePrice: number;
  finalPrice: number;
  discountAmount: number;
}

export function SubtotalDisplay({ basePrice, finalPrice, discountAmount }: SubtotalDisplayProps) {
  return (
    <div className="pt-2">
      <div className="flex items-center justify-between border-t border-gray-200 pt-4">
        <div>
          <span className="font-medium">Subtotal</span>
          {discountAmount > 0 && (
            <div className="text-sm text-green-600">
              Discount: -{formatCurrency(discountAmount)}
            </div>
          )}
        </div>
        <div className="text-right">
          <span className="text-lg font-bold">{formatCurrency(finalPrice)}</span>
          {discountAmount > 0 && (
            <div className="text-sm text-gray-300 line-through">
              {formatCurrency(basePrice)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
