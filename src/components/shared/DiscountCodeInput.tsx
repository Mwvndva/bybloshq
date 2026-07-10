import { useState } from 'react';
import { useAsyncLock } from '@/hooks/useAsyncLock';
import { Check, X, Percent, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { useValidateDiscountCodeMutation } from '@/hooks/buyer/useBuyerPayments';

interface DiscountCodeInputProps {
  eventId: string;
  orderAmount: number;
  onDiscountApplied: (discountAmount: number, finalAmount: number, discountCode: string) => void;
  onDiscountRemoved: () => void;
}

export const DiscountCodeInput = ({
  eventId,
  orderAmount,
  onDiscountApplied,
  onDiscountRemoved
}: DiscountCodeInputProps) => {
  const [code, setCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<{
    code: string;
    discountAmount: number;
    finalAmount: number;
    description: string;
  } | null>(null);
  // FIX (Task 20): Prevent duplicate discount validation via synchronous lock
  const { runWithLock, isLocked: isValidating } = useAsyncLock();
  const { toast } = useToast();

  const validateMutation = useValidateDiscountCodeMutation();

  const validateDiscountCode = async () => {
    if (!code.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a discount code',
        variant: 'destructive'
      });
      return;
    }

    // FIX (Task 20): Prevents duplicate validation requests
    await runWithLock(async () => {
      try {
        const response = await validateMutation.mutateAsync({
          code: code.trim().toUpperCase(),
          order_amount: orderAmount
        });

        const res = response as {
          success?: boolean;
          data?: {
            valid?: boolean;
            discount_amount?: number;
            final_amount?: number;
            discount_code?: { description?: string };
          };
        };
        const validation = res?.data;

        if (res?.success && validation?.valid) {
          setAppliedDiscount({
            code: code.trim().toUpperCase(),
            discountAmount: validation.discount_amount ?? 0,
            finalAmount: validation.final_amount ?? 0,
            description: validation.discount_code?.description || ''
          });

          onDiscountApplied(validation.discount_amount ?? 0, validation.final_amount ?? 0, code.trim().toUpperCase());

          toast({
            title: 'Discount Applied!',
            description: `You've saved ${formatCurrency(validation.discount_amount)} on your order`,
          });
        } else {
          toast({
            title: 'Invalid Discount Code',
            description: validation.message || 'This discount code is not valid',
            variant: 'destructive'
          });
        }
      } catch (error: unknown) {
        const err = error as { response?: { data?: { message?: string } } };
        console.error('Error validating discount code:', error);
        toast({
          title: 'Error',
          description: err.response?.data?.message || 'Failed to validate discount code',
          variant: 'destructive'
        });
      }
    });
  };

  const removeDiscount = () => {
    setAppliedDiscount(null);
    setCode('');
    onDiscountRemoved();
    toast({
      title: 'Discount Removed',
      description: 'Discount code has been removed from your order',
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (appliedDiscount) {
        removeDiscount();
      } else {
        validateDiscountCode();
      }
    }
  };

  if (appliedDiscount) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <Check className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-green-800">Discount Applied</p>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    {appliedDiscount.code}
                  </Badge>
                </div>
                <p className="text-sm text-green-600">
                  You saved {formatCurrency(appliedDiscount.discountAmount)}
                </p>
                {appliedDiscount.description && (
                  <p className="text-xs text-green-600 mt-1">{appliedDiscount.description}</p>
                )}
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={removeDiscount}
              className="border-green-200 text-green-700 hover:bg-green-100"
            >
              <X className="h-4 w-4 mr-1" />
              Remove
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-3">
          <Label htmlFor="discount-code" className="flex items-center gap-2">
            <Percent className="h-4 w-4" />
            Discount Code
          </Label>

          <div className="flex gap-2">
            <Input
              id="discount-code"
              placeholder="Enter discount code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyPress={handleKeyPress}
              disabled={isValidating}
              className="text-base uppercase"
            />

            <Button
              onClick={validateDiscountCode}
              disabled={!code.trim() || isValidating}
              size="sm"
            >
              {isValidating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Validating...
                </>
              ) : (
                'Apply'
              )}
            </Button>
          </div>

          {orderAmount > 0 && (
            <p className="text-xs text-gray-300">
              Enter a discount code to save on your {formatCurrency(orderAmount)} order
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};


