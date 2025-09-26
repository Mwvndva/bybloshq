import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number | string | null | undefined): string {
  // Debug log the input
  console.log('formatCurrency called with:', { 
    amount, 
    type: typeof amount,
    isNaN: typeof amount === 'number' ? isNaN(amount) : 'N/A',
    stack: new Error().stack // This will show where the function was called from
  });

  // Handle null, undefined, or empty string
  if (amount === null || amount === undefined || amount === '') {
    console.warn('formatCurrency: No amount provided');
    return 'KSh 0';
  }

  // Convert to string to handle different input types
  const amountStr = String(amount).trim();
  
  // Remove any non-numeric characters except decimal point and minus
  const numericStr = amountStr.replace(/[^0-9.-]+/g, '');
  
  // Parse to number
  const numericAmount = parseFloat(numericStr);
  
  // Check if parsing was successful
  if (isNaN(numericAmount)) {
    console.warn('formatCurrency: Could not parse amount:', amount);
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
    
    console.log('formatCurrency formatted:', formatted);
    return formatted;
  } catch (error) {
    console.error('Error formatting currency:', error);
    const fallback = `KSh ${numericAmount.toFixed(0)}`;
    console.log('formatCurrency fallback:', fallback);
    return fallback;
  }
}
