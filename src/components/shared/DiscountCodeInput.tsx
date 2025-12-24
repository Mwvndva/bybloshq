import { useState } from 'react';
import { Check, X, Percent, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { formatCurrency } from '@/lib/utils';
import api from '@/lib/api';

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
  const [isValidating, setIsValidating] = useState(false);
  const [appliedDiscount, setAppliedDiscount] = useState<{
    code: string;
    discountAmount: number;
    finalAmount: number;
    description: string;
  } | null>(null);
  const { toast } = useToast();

  const validateDiscountCode = async () => {
    if (!code.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a discount code',
        variant: 'destructive'
      });
      return;
    }

    setIsValidating(true);

    try {
      const response = await api.post('/discount-codes/validate', {
        code: code.trim().toUpperCase(),
        order_amount: orderAmount
      });

      const validation = (response.data as any)?.data;

      if ((response.data as any)?.success && validation.valid) {
        setAppliedDiscount({
          code: code.trim().toUpperCase(),
          discountAmount: validation.discount_amount,
          finalAmount: validation.final_amount,
          description: validation.discount_code.description || ''
        });

        onDiscountApplied(validation.discount_amount, validation.final_amount, code.trim().toUpperCase());

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
    } catch (error: any) {
      console.error('Error validating discount code:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to validate discount code',
        variant: 'destructive'
      });
    } finally {
      setIsValidating(false);
    }
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
      <Card className="border-green-200 bg-green-50/50 rounded-2xl shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Check className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-bold text-green-800">Discount Applied</p>
                  <Badge variant="secondary" className="bg-white text-green-700 hover:bg-white border-green-100">
                    {appliedDiscount.code}
                  </Badge>
                </div>
                <p className="text-sm text-green-600 font-medium">
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
              className="border-green-200 text-green-700 hover:bg-green-100 hover:text-green-800 rounded-xl h-9"
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
    <div className="space-y-3">
      <Label htmlFor="discount-code" className="flex items-center gap-2 text-gray-700 font-semibold text-sm">
        <Percent className="h-4 w-4 text-yellow-500" />
        Have a Discount Code?
      </Label>

      <div className="flex gap-2">
        <Input
          id="discount-code"
          placeholder="ENTER CODE"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyPress={handleKeyPress}
          disabled={isValidating}
          className="uppercase rounded-xl border-gray-200 focus:border-yellow-400 focus:ring-yellow-400 h-11 bg-white font-medium tracking-wide"
        />

        <Button
          onClick={validateDiscountCode}
          disabled={!code.trim() || isValidating}
          className="h-11 px-6 rounded-xl bg-gray-900 text-white hover:bg-gray-800 font-semibold shadow-sm"
        >
          {isValidating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Verifying
            </>
          ) : (
            'Apply'
          )}
        </Button>
      </div>
    </div>
  );
};
