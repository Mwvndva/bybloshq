/**
 * Format a date string into a human-readable format
 * @param dateString - ISO date string
 * @param options - Formatting options
 * @returns Formatted date string
 */
export const formatDate = (
  dateString: string,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }
): string => {
  return new Date(dateString).toLocaleDateString('en-US', options);
};

/**
 * Format a time string into a human-readable format
 * @param dateString - ISO date string
 * @returns Formatted time string (e.g., "2:30 PM")
 */
export const formatTime = (dateString: string): string => {
  return new Date(dateString).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
};

/**
 * Format a date range into a human-readable format
 * @param startDate - Start date string
 * @param endDate - End date string
 * @returns Formatted date range string (e.g., "Jan 1 - 3, 2023")
 */
export const formatDateRange = (startDate: string, endDate: string): string => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // If same day, just show the date once
  if (start.toDateString() === end.toDateString()) {
    return formatDate(startDate);
  }
  
  // Same month, different days
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    const options: Intl.DateTimeFormatOptions = { 
      month: 'short',
      day: 'numeric',
    };
    return `${start.toLocaleDateString('en-US', options)} - ${end.getDate()}, ${end.getFullYear()}`;
  }
  
  // Different months
  const startOptions: Intl.DateTimeFormatOptions = { 
    month: 'short', 
    day: 'numeric' 
  };
  const endOptions: Intl.DateTimeFormatOptions = { 
    year: 'numeric',
    month: 'short', 
    day: 'numeric' 
  };
  
  return `${start.toLocaleDateString('en-US', startOptions)} - ${end.toLocaleDateString('en-US', endOptions)}`;
};

/**
 * Format a date string into a relative time string (e.g., "in 2 days", "3 weeks ago")
 * @param dateString - ISO date string
 * @returns Relative time string
 */
export const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((date.getTime() - now.getTime()) / 1000);
  
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  
  // Convert to absolute value
  const absDiff = Math.abs(diffInSeconds);
  
  // Less than a minute
  if (absDiff < 60) {
    return diffInSeconds >= 0 ? 'in a few seconds' : 'a few seconds ago';
  }
  
  // Minutes
  const minutes = Math.floor(absDiff / 60);
  if (minutes < 60) {
    return rtf.format(diffInSeconds >= 0 ? minutes : -minutes, 'minute');
  }
  
  // Hours
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return rtf.format(diffInSeconds >= 0 ? Math.floor(hours) : -Math.floor(hours), 'hour');
  }
  
  // Days
  const days = Math.floor(hours / 24);
  if (days < 30) {
    return rtf.format(diffInSeconds >= 0 ? days : -days, 'day');
  }
  
  // Months
  const months = Math.floor(days / 30);
  if (months < 12) {
    return rtf.format(diffInSeconds >= 0 ? months : -months, 'month');
  }
  
  // Years
  const years = Math.floor(months / 12);
  return rtf.format(diffInSeconds >= 0 ? years : -years, 'year');
};

/**
 * Check if a date is in the past
 * @param dateString - ISO date string
 * @returns boolean indicating if the date is in the past
 */
export const isPastDate = (dateString: string): boolean => {
  return new Date(dateString) < new Date();
};

/**
 * Get the day of the week from a date string
 * @param dateString - ISO date string
 * @returns Day of the week (e.g., "Monday")
 */
export const getDayOfWeek = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', { weekday: 'long' });
};

/**
 * Get the month and day from a date string
 * @param dateString - ISO date string
 * @returns Formatted month and day (e.g., "Jan 1")
 */
export const getMonthDay = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  });
};
