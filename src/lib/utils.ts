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
  if (typeof amount === 'object' && amount !== null) {
    // Try to extract a numeric value from common object structures
    const obj = amount as Record<string, any>;
    const numericValue = obj.value || obj.amount || obj.price || obj.total || 0;
    if (typeof numericValue === 'number' && !isNaN(numericValue)) {
      amount = numericValue;
    } else {
      return 'KSh 0';
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

export function formatDate(dateInput: string | Date, format: 'full' | 'date' | 'time' = 'full'): string {
  try {
    // Handle different date input types
    let date: Date;
    
    // If it's already a Date object
    if (dateInput instanceof Date) {
      date = dateInput;
    } 
    // If it's a string that can be parsed by Date constructor
    else if (typeof dateInput === 'string') {
      // Try parsing the date string
      const parsedDate = new Date(dateInput);
      
      // If the date is invalid, try parsing with Date.parse
      if (isNaN(parsedDate.getTime())) {
        const timestamp = Date.parse(dateInput);
        if (!isNaN(timestamp)) {
          date = new Date(timestamp);
        } else {
          throw new Error(`Invalid date string: ${dateInput}`);
        }
      } else {
        date = parsedDate;
      }
    } else {
      throw new Error(`Invalid date format: ${typeof dateInput}`);
    }

    // Format based on requested format
    switch (format) {
      case 'date':
        return date.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      case 'time':
        return date.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        });
      case 'full':
      default:
        return date.toLocaleString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        });
    }
  } catch (error) {
    console.error('Error formatting date:', error, 'Input:', dateInput);
    return 'Date not available';
  }
}
