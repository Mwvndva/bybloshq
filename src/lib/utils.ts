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

export function decodeJwt(token: string): any {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    return JSON.parse(jsonPayload);
  } catch (error) {
    return null;
  }
}

export function isTokenExpired(token: string): boolean {
  const decoded = decodeJwt(token);
  if (!decoded || !decoded.exp) return true;

  const currentTime = Date.now() / 1000;
  return decoded.exp < currentTime;
}

/**
 * Normalizes an image path or URL to a full URL
 * Handles base64, absolute URLs, and relative paths from the backend
 */
export function getImageUrl(path: string | undefined | null): string {
  // Return placeholder image if no path provided
  if (!path) return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="400"%3E%3Crect width="400" height="400" fill="%23111111"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="20" fill="%23666666"%3ENo Image%3C/text%3E%3C/svg%3E';

  // 1. If it's already a full URL (http/https) or a data URL (base64), return it as is
  if (path.startsWith('http') || path.startsWith('data:')) {
    return path;
  }

  // 2. Identify the backend base URL
  // We strip the /api suffix if present to get the root serving static files
  const VITE_API_URL = import.meta.env.VITE_API_URL;
  let baseUrl = '';

  if (VITE_API_URL) {
    baseUrl = VITE_API_URL.replace(/\/api$/, '').replace(/\/$/, '');
  } else {
    // In production or development without VITE_API_URL, use the current origin
    baseUrl = window.location.origin;
  }

  // 3. Normalize the path (ensure it starts with /)
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  // 4. Combine and return
  return `${baseUrl}${cleanPath}`;
}
