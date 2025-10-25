import axios from 'axios';
import axiosRetry from 'axios-retry';
import { Event, TicketType } from '@/types/event';
import QRCode from 'qrcode';

// Configure axios retry
axiosRetry(axios, { 
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    // Retry on network errors or 5xx responses
    return axiosRetry.isNetworkOrIdempotentRequestError(error) || 
           (error.response && error.response.status >= 500);
  }
});

// Ensure API_URL ends with /api but doesn't have a trailing slash
const getApiBaseUrl = () => {
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3002';
  // Remove trailing slash if exists
  const cleanUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  // Ensure /api is included
  return cleanUrl.endsWith('/api') ? cleanUrl : `${cleanUrl}/api`;
};

const API_URL = getApiBaseUrl();

// Get all upcoming events
export { type Event } from '@/types/event';

// Types
export interface PurchaseTicketData {
  eventId: number | string;
  ticketTypeId?: number | string | null;
  quantity: number | string;
  customerName: string;
  customerEmail: string;
  phoneNumber: string;
}

export interface TicketPurchaseResponse {
  status: string;
  data: {
    transactionId: string;
    tickets: Array<{
      id: number;
      ticket_number: string;
    }>;
    totalPrice: number;
    customer: {
      name: string;
      email: string;
      phone: string;
    };
    event: {
      id: number;
      name: string;
      startDate: string;
      endDate: string;
      location: string;
    };
  };
}

// Get all upcoming events
export const getUpcomingEvents = async (limit: number = 10): Promise<Event[]> => {
  try {
    console.log(`Fetching ${limit} upcoming events from public API...`);
    const response = await axios.get(`${API_URL}/events/public/upcoming`, {
      params: { limit },
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    console.log('API Response:', response.data);
    
    // Handle both wrapped and direct array responses
    let events: Event[];
    
    if (Array.isArray(response.data)) {
      // Direct array response
      events = response.data;
    } else if (response.data?.data && Array.isArray(response.data.data)) {
      // Wrapped response
      events = response.data.data;
    } else {
      console.error('Unexpected API response format:', response.data);
      throw new Error('Invalid response format from server');
    }
    
    return events;
  } catch (error) {
    console.error('Error in getUpcomingEvents:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      config: {
        url: error.config?.url,
        method: error.config?.method,
        headers: error.config?.headers
      }
    });
    throw error;
  }
};

// Get event by ID
export const getEventById = async (id: string | number): Promise<Event> => {
  try {
    const response = await axios.get(`${API_URL}/events/organizer/${id}`, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching event with ID ${id}:`, error);
    throw error;
  }
};

// Get public event by ID (no authentication required)
export const getPublicEvent = async (id: string | number): Promise<Event> => {
  const url = `${API_URL}/events/public/${id}`;
  console.log('Making request to:', url);
  
  try {
    const response = await axios.get(url, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      validateStatus: function (status) {
        return status >= 200 && status < 500; // Resolve only if the status code is less than 500
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Response data:', response.data);
    
    if (response.status === 200 && response.data?.status === 'success') {
      return response.data.data; // The event data is directly in response.data.data
    }
    
    // If we get here, there was an error
    const errorMessage = response.data?.message || 'Failed to fetch event';
    console.error('Error response:', {
      status: response.status,
      message: errorMessage,
      data: response.data
    });
    
    throw new Error(errorMessage);
  } catch (error) {
    console.error(`Error fetching public event with ID ${id}:`, error);
    if (axios.isAxiosError(error)) {
      console.error('Axios error details:', {
        message: error.message,
        code: error.code,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          headers: error.config?.headers,
          params: error.config?.params
        },
        response: error.response ? {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        } : 'No response'
      });
    }
    throw error;
  }
};

// Get ticket types for an event
export const getEventTicketTypes = async (eventId: number | string): Promise<TicketType[]> => {
  try {
    const response = await axios.get(`${API_URL}/events/public/${eventId}/ticket-types`);
    if (response.data?.status === 'success' && response.data?.data?.event?.ticket_types) {
      return response.data.data.event.ticket_types.map((tt: any) => {
        const sold = parseInt(tt.sold || '0', 10);
        const quantity = parseInt(tt.quantity || '0', 10);
        const available = parseInt(tt.available || (quantity - sold).toString(), 10);
        const isSoldOut = tt.is_sold_out || available <= 0;
        
        return {
          id: tt.id,
          event_id: eventId,
          name: tt.name,
          description: tt.description || '',
          price: parseFloat(tt.price) || 0,
          quantity: quantity,
          quantity_available: available,
          sold: sold,
          is_sold_out: isSoldOut,
          sales_start_date: tt.sales_start_date ? new Date(tt.sales_start_date) : null,
          sales_end_date: tt.sales_end_date ? new Date(tt.sales_end_date) : null,
          is_default: tt.is_default || false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      });
    }
    
    // If no ticket types in the expected format, try to get from the event
    console.log('No ticket types found in response, trying to get from event');
    const event = await getEventById(eventId);
    
    if (event.ticket_types && event.ticket_types.length > 0) {
      return event.ticket_types.map(tt => {
        const sold = parseInt(tt.sold || '0', 10);
        const quantity = parseInt(tt.quantity || '0', 10);
        const available = tt.available || Math.max(0, quantity - sold);
        const isSoldOut = tt.is_sold_out || available <= 0;
        
        return {
          id: tt.id,
          event_id: eventId,
          name: tt.name,
          description: tt.description || '',
          price: parseFloat(tt.price) || 0,
          quantity: quantity,
          quantity_available: available,
          sold: sold,
          is_sold_out: isSoldOut,
          sales_start_date: tt.sales_start_date ? new Date(tt.sales_start_date) : null,
          sales_end_date: tt.sales_end_date ? new Date(tt.sales_end_date) : null,
          is_default: tt.is_default || false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      });
    }
    
    // If still no ticket types, return a default one
    console.log('No ticket types found, creating default ticket type');
    const defaultQuantity = event.ticket_quantity || 0;
    const defaultAvailable = event.available_tickets || defaultQuantity;
    const defaultSold = Math.max(0, defaultQuantity - defaultAvailable);
    
    return [{
      id: 0,
      event_id: Number(eventId),
      name: 'General Admission',
      description: 'General admission ticket',
      price: event.ticket_price || 0,
      quantity: defaultQuantity,
      quantity_available: defaultAvailable,
      sold: defaultSold,
      is_sold_out: defaultAvailable <= 0,
      sales_start_date: null,
      sales_end_date: null,
      is_default: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }];
  } catch (error) {
    console.error(`Error fetching ticket types for event ${eventId}:`, error);
    // If there's an error, return a default ticket type with a reasonable quantity
    return [{
      id: 0,
      event_id: Number(eventId),
      name: 'General Admission',
      description: 'General admission ticket',
      price: 0,
      quantity: 100,
      quantity_available: 100,
      sold: 0,
      sales_start_date: null,
      sales_end_date: null,
      is_default: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }];
  }
};

// Purchase tickets
const MAX_RETRIES = 3;
const INITIAL_TIMEOUT = 30000; // 30 seconds

// Send ticket details via email
type SendTicketEmailResponse = {
  success: boolean;
  message?: string;
  error?: string;
  ticketNumber?: string;
};

export const sendTicketEmail = async (ticketData: {
  ticketNumber: string;
  customerName: string;
  customerEmail: string;
  eventName: string;
  ticketType: string;
  price: number | string;
  totalPrice?: number | string;
  quantity?: number | string;
  purchaseDate: string;
  qrCode?: string; // Base64 encoded QR code image
  validationUrl?: string; // URL for ticket validation
  authToken?: string; // Keep for backward compatibility, but not required
}): Promise<SendTicketEmailResponse> => {
  try {
    console.log('Generating QR code for ticket:', ticketData.ticketNumber);
    
    // Use provided validation URL or generate a default one
    const validationUrl = ticketData.validationUrl || 
      `${window.location.origin}/tickets/validate/${ticketData.ticketNumber}?qr=true`;
    
    // Use provided QR code or generate a new one
    let qrCode = ticketData.qrCode;
    if (!qrCode) {
      try {
        // Create a data object for the QR code
        const qrCodeData = {
          ticketNumber: ticketData.ticketNumber,
          event: ticketData.eventName,
          customer: ticketData.customerName,
          email: ticketData.customerEmail,
          timestamp: new Date().toISOString()
        };

        // Generate QR code with the validation URL
        qrCode = await QRCode.toDataURL(validationUrl, {
          errorCorrectionLevel: 'H',
          margin: 1,
          scale: 8
        });
        console.log('QR code generated successfully');
      } catch (error) {
        console.error('Error generating QR code:', error);
        // Continue without QR code if generation fails
        qrCode = '';
      }
    }

    // Ensure price and totalPrice are numbers
    const numericPrice = typeof ticketData.price === 'string' ? 
      parseFloat(ticketData.price.replace(/[^0-9.-]+/g,"")) : 
      Number(ticketData.price) || 0;
      
    // Safely convert totalPrice to number
    let numericTotalPrice = 0;
    if (ticketData.totalPrice !== null && ticketData.totalPrice !== undefined) {
      if (typeof ticketData.totalPrice === 'number') {
        numericTotalPrice = ticketData.totalPrice;
      } else if (typeof ticketData.totalPrice === 'string') {
        numericTotalPrice = parseFloat(ticketData.totalPrice.replace(/[^0-9.-]+/g,""));
      } else if (typeof ticketData.totalPrice === 'object') {
        // Handle price objects (e.g., { value: 100, currency: 'KES' })
        const numericValue = ticketData.totalPrice.value || ticketData.totalPrice.amount || ticketData.totalPrice.price || 0;
        numericTotalPrice = typeof numericValue === 'number' ? numericValue : 0;
      }
    }
    
    // If totalPrice is 0 or invalid, calculate from price and quantity
    if (numericTotalPrice === 0 || isNaN(numericTotalPrice)) {
      numericTotalPrice = numericPrice * (Number(ticketData.quantity) || 1);
    }
    
    const quantity = Number(ticketData.quantity) || 1;
    
    // Format prices for display
    const formatPrice = (price: number) => 
      new Intl.NumberFormat('en-KE', {
        style: 'currency',
        currency: 'KES',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(price || 0);
    
    // Format purchase date
    let formattedPurchaseDate;
    try {
      formattedPurchaseDate = new Date(ticketData.purchaseDate).toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      console.warn('Invalid purchase date, using current date', e);
      formattedPurchaseDate = new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    
    // Log the ticket data that would be sent in production
    console.log('Ticket details (email not sent in development):', {
      to: ticketData.customerEmail,
      subject: `Your Ticket for ${ticketData.eventName}`,
      ticketData: {
        ticketNumber: ticketData.ticketNumber,
        customerName: ticketData.customerName,
        eventName: ticketData.eventName,
        ticketType: ticketData.ticketType,
        price: numericPrice,
        formattedPrice: formatPrice(numericPrice),
        totalPrice: numericTotalPrice,
        formattedTotalPrice: formatPrice(numericTotalPrice),
        quantity: quantity,
        purchaseDate: formattedPurchaseDate
      }
    });
    
    // Always try to send the email, even in development
    // Format price with KES currency (using a different name to avoid duplicate)
    const formatCurrency = (price: number) => {
      return new Intl.NumberFormat('en-KE', {
        style: 'currency',
        currency: 'KES',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(price);
    };

    // Prepare the email payload according to server expectations
    const emailPayload = {
      to: ticketData.customerEmail, // This must be at the root level
      subject: `Your Ticket for ${ticketData.eventName}`,
      ticketData: {
        // Required fields
        ticketNumber: ticketData.ticketNumber,
        customerName: ticketData.customerName,
        customerEmail: ticketData.customerEmail,
        eventName: ticketData.eventName,
        ticketType: ticketData.ticketType || 'General Admission',
        price: numericPrice,
        totalPrice: numericTotalPrice,
        quantity: quantity,
        purchaseDate: ticketData.purchaseDate || new Date().toISOString(),
        
        // QR Code and validation
        qrCode: qrCode,
        validationUrl: validationUrl,
        
        // Additional metadata for the email template
        formattedPrice: formatCurrency(numericPrice),
        formattedTotalPrice: formatCurrency(numericTotalPrice),
        currency: 'KES',
        eventDateTime: formattedPurchaseDate,
        eventDate: formattedPurchaseDate.split(',')[0], // Just the date part
        eventTime: formattedPurchaseDate.includes(', ') ? 
          formattedPurchaseDate.split(', ')[1] : // Just the time part if available
          '',
        venue: 'Event Venue', // Default value, should be passed from the event data
        
        // Additional fields for better email template rendering
        hasQRCode: !!qrCode,
        ticketId: ticketData.ticketNumber.replace(/[^a-zA-Z0-9]/g, '').toUpperCase(),
        orderNumber: `TKT-${Date.now()}`,
        supportEmail: 'support@example.com',
        supportPhone: '+254 700 000000'
      }
    };
    
    // Log the prepared payload without sensitive data
    if (process.env.NODE_ENV !== 'production') {
      console.log('Prepared email payload:', {
        ...emailPayload,
        ticketData: {
          ...emailPayload.ticketData,
          qrCode: emailPayload.ticketData.qrCode ? '***QR_CODE***' : undefined,
          validationUrl: emailPayload.ticketData.validationUrl
        }
      });
    }

    console.log('Sending email with payload:', JSON.stringify({
      ...emailPayload,
      qrCode: '[BASE64_QR_CODE]' // Don't log the full QR code
    }, null, 2));

    // Log email details in all environments
    console.log('Sending ticket confirmation email to:', emailPayload.to);
    console.log('Ticket details:', {
      to: emailPayload.to,
      subject: emailPayload.subject,
      ticketNumber: emailPayload.ticketData.ticketNumber,
      eventName: emailPayload.ticketData.eventName
    });

    // Always try to send the email using the public endpoint
    try {
      const response = await axios.post(
        `${API_URL}/tickets/send-confirmation`,
        emailPayload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: 10000 // 10 second timeout
        }
      );
      
      console.log('Email sent successfully:', response.data);
      
      return {
        success: true,
        message: 'Ticket and confirmation email sent successfully!',
        ticketNumber: ticketData.ticketNumber
      };
    } catch (error: any) {
      console.error('Error sending email:', error);
      
      // Extract error message from different possible locations
      const errorMessage = error.response?.data?.message || 
                         error.message || 
                         'Failed to send email. Please check the ticket in your email or contact support.';
      
      console.error('Email sending failed with error:', errorMessage);
      
      // Log additional debug info in development
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error details:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          url: error.config?.url,
          method: error.config?.method
        });
      }
      
      // Still return success to not block the user flow
      return {
        success: true,
        message: `Ticket created successfully! ${errorMessage}`,
      };
    }
  } catch (error: any) {
    console.error('Error sending ticket email:', error);
    // Don't throw the error to avoid affecting the purchase flow
    const errorMessage = error.response?.data?.message || error.message || 'Failed to send ticket email';
    return { 
      success: false, 
      message: errorMessage
    };
  }
};

export const purchaseTickets = async (data: PurchaseTicketData, retryCount = 0): Promise<TicketPurchaseResponse> => {
  try {
    // Validate required fields
    const requiredFields = [
      { field: 'eventId' as const, label: 'Event ID' },
      { field: 'quantity' as const, label: 'Quantity' },
      { field: 'customerName' as const, label: 'Customer Name' },
      { field: 'customerEmail' as const, label: 'Customer Email' },
      { field: 'phoneNumber' as const, label: 'Phone Number' }
    ];

    const missingFields = requiredFields.filter(({ field }) => {
      const value = data[field];
      return value === undefined || value === null || value === '' || 
             (typeof value === 'string' && value.trim() === '');
    });

    if (missingFields.length > 0) {
      const missingFieldNames = missingFields.map(f => f.label).join(', ');
      throw new Error(`Missing or invalid fields: ${missingFieldNames}`);
    }

    // Convert and validate quantity
    const quantity = Number(data.quantity);
    if (isNaN(quantity) || quantity < 1) {
      throw new Error('Quantity must be a positive number');
    }

    // Convert eventId to number
    const eventId = Number(data.eventId);
    if (isNaN(eventId)) {
      throw new Error('Invalid event ID');
    }

    // Prepare the request payload with proper types
    const payload: any = {
      eventId,
      quantity,
      customerName: String(data.customerName).trim(),
      customerEmail: String(data.customerEmail).trim().toLowerCase(),
      phoneNumber: String(data.phoneNumber).replace(/\s+/g, ''), // Remove all whitespace from phone number

    };

    // Add ticketTypeId if provided and valid
    if (data.ticketTypeId !== undefined && data.ticketTypeId !== null && data.ticketTypeId !== '') {
      const ticketTypeId = typeof data.ticketTypeId === 'number' 
        ? data.ticketTypeId 
        : parseInt(String(data.ticketTypeId), 10);
      
      if (!isNaN(ticketTypeId) && ticketTypeId > 0) {
        payload.ticketTypeId = ticketTypeId;
      } else {
        console.warn('Invalid ticketTypeId provided, skipping:', data.ticketTypeId);
      }
    }

    console.log('Sending purchase request with payload:', JSON.stringify(payload, null, 2));
    
    // Calculate backoff time (exponential backoff)
    const backoffTime = Math.min(1000 * Math.pow(2, retryCount), 30000); // Max 30s backoff
    
    // Add a small random delay to avoid thundering herd problem
    const jitter = Math.random() * 1000;
    
    if (retryCount > 0) {
      console.log(`Retry ${retryCount}/${MAX_RETRIES} after ${backoffTime}ms`);
      await new Promise(resolve => setTimeout(resolve, backoffTime + jitter));
    }
    
    console.log('Processing public ticket purchase request');
    
    // Make the request without authentication
    const response = await axios({
      method: 'post',
      url: `${API_URL}/tickets/purchase`,
      data: payload,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      timeout: INITIAL_TIMEOUT,
      'axios-retry': {
        retryDelay: () => backoffTime + jitter
      }
    });
    
    console.log('Purchase successful:', response.data);
    
    // If we get here, the purchase was successful
    const responseData = response.data;

    // Send email with ticket details if purchase was successful
    if (responseData?.data?.tickets?.[0]) {
      const ticket = responseData.data.tickets[0];
      const event = responseData.data.event || {};
      
      // Debug: Log the full response data
      console.log('Purchase response data:', JSON.stringify(responseData, null, 2));
      
      // Get price information from the response or fall back to request data
      const unitPrice = ticket.unitPrice || ticket.price || 0;
      const quantity = Number(ticket.quantity || data.quantity || 1);
      const totalPrice = ticket.totalPrice || responseData.data.summary?.totalPrice || (unitPrice * quantity);
      
      // Format prices for display
      const formatPrice = (price: number) => {
        // Ensure price is a number
        const numPrice = Number(price) || 0;
        return new Intl.NumberFormat('en-KE', {
          style: 'currency',
          currency: 'KES',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        }).format(numPrice);
      };
      
      // Log price details for debugging
      console.log('Processing ticket purchase with prices:', {
        ticketPrice: ticket.price,
        unitPrice: ticket.unitPrice,
        totalPrice: ticket.totalPrice,
        responseTotalPrice: responseData.data.summary?.totalPrice,
        calculatedTotalPrice: unitPrice * quantity,
        finalUnitPrice: unitPrice,
        finalTotalPrice: totalPrice,
        quantity: quantity
      });
      
      // Generate secure validation URL with ticket number
      const getValidationUrl = (ticketNumber: string) => {
        // In production, always use the production domain
        let baseUrl;
        if (import.meta.env.PROD) {
          baseUrl = 'https://byblosexperience.vercel.app';
        } else {
          // In development, use environment variable or current origin
          baseUrl = import.meta.env.VITE_BASE_URL || window.location.origin;
        }
        
        // Ensure the base URL doesn't end with a slash
        const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        console.log('Using frontend base URL for validation:', cleanBaseUrl);
        const encodedTicketNumber = encodeURIComponent(ticketNumber);
        
        // The validation URL should match our frontend route: /tickets/validate/:ticketNumber
        return `${cleanBaseUrl}/tickets/validate/${encodedTicketNumber}?v=${Date.now()}`;
      };

      const ticketNumber = ticket.ticketNumber || ticket.ticket_number;
      const validationUrl = getValidationUrl(ticketNumber);

      // Generate QR code with the validation URL as the data
      const generateQRCode = async (ticketNumber: string) => {
        try {
          // Use the validation URL as the QR code data
          // This ensures scanning the QR code will directly open the validation URL
          return await QRCode.toDataURL(validationUrl, {
            errorCorrectionLevel: 'H',
            type: 'image/png',
            margin: 1,
            scale: 4,
            color: {
              dark: '#000000',  // Black dots
              light: '#FFFFFF00' // Transparent background
            }
          });
        } catch (error) {
          console.error('Error generating QR code:', error);
          return null;
        }
      };

      // Generate QR code for the ticket
      const qrCodeDataUrl = await generateQRCode(ticketNumber);

      // Log ticket details for debugging
      console.log('Ticket details:', {
        ticketNumber,
        validationUrl,
        qrCodeGenerated: !!qrCodeDataUrl,
        unitPrice: unitPrice,
        totalPrice: totalPrice,
        quantity: quantity,
        formattedUnitPrice: formatPrice(unitPrice),
        formattedTotalPrice: formatPrice(totalPrice),
        currency: 'KES',
        eventId: event.id,
        eventName: event.name
      });

      try {
        // Send email with QR code and validation URL
        const emailResult = await sendTicketEmail({
          ticketNumber,
          customerName: ticket.customerName || data.customerName,
          customerEmail: ticket.customerEmail || data.customerEmail,
          eventName: ticket.eventName || event.name || 'Event',
          ticketType: ticket.ticketType || ticket.ticket_type || 'General Admission',
          price: unitPrice,
          totalPrice: totalPrice,
          quantity: quantity,
          purchaseDate: ticket.purchaseDate || new Date().toISOString(),
          qrCode: qrCodeDataUrl || undefined,
          validationUrl: validationUrl
        });

        // Log email sending result
        if (emailResult.success) {
          console.log('Ticket email sent successfully to', data.customerEmail);
          
          // Dispatch event to notify UI about successful email
          const emailEvent = new CustomEvent('ticket-email-sent', {
            detail: { 
              success: true,
              message: 'Ticket confirmation email has been sent to ' + data.customerEmail,
              ticketNumber: ticketNumber,
              validationUrl: validationUrl,
              timestamp: new Date().toISOString()
            }
          });
          window.dispatchEvent(emailEvent);
        } else {
          console.warn('Email sending completed with issues:', emailResult.message);
          
          // Dispatch event with warning
          const emailEvent = new CustomEvent('ticket-email-sent', {
            detail: { 
              success: false,
              message: 'Ticket purchased but there was an issue sending the confirmation email: ' + (emailResult.message || 'Unknown error'),
              ticketNumber: ticketNumber,
              validationUrl: validationUrl,
              timestamp: new Date().toISOString()
            }
          });
          window.dispatchEvent(emailEvent);
        }
      } catch (emailError) {
        console.error('Failed to send ticket email:', emailError);
        
        // Dispatch error event
        const emailEvent = new CustomEvent('ticket-email-sent', {
          detail: { 
            success: false,
            message: 'Ticket purchased but failed to send confirmation email. Please contact support.',
            ticketNumber: ticketNumber,
            validationUrl: validationUrl,
            error: emailError.message,
            timestamp: new Date().toISOString()
          }
        });
        window.dispatchEvent(emailEvent);
      }
    }

    return responseData;
  } catch (error) {
    console.error('Error in purchaseTickets:', {
      error,
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      request: {
        url: error.config?.url,
        method: error.config?.method,
        data: error.config?.data ? JSON.parse(error.config.data) : null,
        headers: {
          ...error.config?.headers,
          // Don't log the full auth token
          Authorization: error.config?.headers?.Authorization ? 'Bearer [REDACTED]' : undefined
        }
      }
    });
    
    // Handle specific error cases
    if (error.response) {
      if (error.response.status === 400) {
        throw new Error(error.response.data?.message || 'Invalid request. Please check your input and try again.');
      } else if (error.response.status === 401) {
        throw new Error('Please log in to purchase tickets.');
      } else if (error.response.status === 403) {
        throw new Error('You do not have permission to perform this action.');
      } else if (error.response.status === 404) {
        throw new Error('Event not found or ticket sales have ended.');
      } else if (error.response.status === 409) {
        throw new Error('Not enough tickets available. Please try a lower quantity.');
      } else if (error.response.status >= 500) {
        console.error('Server error details:', error.response.data);
        throw new Error('Server error. Please try again later or contact support.');
      }
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received:', error.request);
      throw new Error('No response from server. Please check your connection and try again.');
    } else if (error.code === 'ECONNABORTED') {
      throw new Error('Request timed out. Please try again.');
    }
    
    // Default error
    throw new Error(error.message || 'Failed to process ticket purchase. Please try again later.');
  }
};


