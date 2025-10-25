import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number | string | null | undefined): string {
  // Handle null, undefined, or empty string
  if (amount === null || amount === undefined || amount === '') {
    return 'KSh 0';
  }

  // Handle objects - if amount is an object, try to extract a numeric value
  if (typeof amount === 'object') {
    // Try to extract a numeric value from common object structures
    if (amount && typeof amount === 'object') {
      // Check for common price object structures
      const numericValue = amount.value || amount.amount || amount.price || amount.total || 0;
      if (typeof numericValue === 'number' && !isNaN(numericValue)) {
        amount = numericValue;
      } else {
        return 'KSh 0';
      }
    }
  }

  // Convert to string to handle different input types
  const amountStr = String(amount).trim();
  
  // Remove any non-numeric characters except decimal point and minus
  const numericStr = amountStr.replace(/[^0-9.-]+/g, '');
  
  // Parse to number
  const numericAmount = parseFloat(numericStr);
  
  // Check if parsing was successful
  if (isNaN(numericAmount)) {
    return 'KSh 0';
  }
  
  try {
    // Format as Kenyan Shillings
    const formatted = new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(numericAmount);
    
    return formatted;
  } catch (error) {
    const fallback = `KSh ${numericAmount.toFixed(0)}`;
    return fallback;
  }
}
