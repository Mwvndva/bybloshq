export interface Event {
  id: number;
  organizer_id: number;
  name: string;
  description: string;
  image_url: string | null;
  location: string;
  ticket_quantity: number;
  ticket_price: number;
  start_date: string; // ISO date string
  end_date: string; // ISO date string
  status: 'draft' | 'published' | 'cancelled' | 'completed';
  created_at: string; // ISO date string
  updated_at: string; // ISO date string
  available_tickets?: number; // Computed field
  ticketTypes?: TicketType[]; // Array of ticket types for this event
  // Additional optional fields that might be present
  capacity?: number;
  is_online?: boolean;
  timezone?: string;
  category?: string;
  tags?: string[];
  // For booking reference
  booking_reference?: string;
  // Additional fields that might be returned by the API
  organizer?: {
    id: number;
    name: string;
    email: string;
    avatar_url?: string;
  };
  // Add any other fields that might be present in the API response
  [key: string]: any;
}

export interface EventFormData {
  name: string;
  description: string;
  location: string;
  ticket_quantity: number;
  ticket_price: number;
  start_date: string;
  end_date: string;
  image_data_url?: string;
}

export interface TicketType {
  id: number;
  event_id: number;
  name: string;
  description?: string;
  sold?: number;
  is_sold_out?: boolean;
  price: number;
  quantity?: number; // Made optional to match API response
  quantity_available: number;
  created_at: string;
  updated_at: string;
  min_per_order?: number;
  max_per_order?: number; // Maximum number of tickets that can be purchased in a single order
  sales_start_date?: string | null;
  sales_end_date?: string | null;
  is_active?: boolean;
  is_default?: boolean; // Indicates if this is a default ticket type
}

export interface TicketPurchaseData {
  eventId: number;
  ticketType: string;
  ticketTypeId?: number;
  quantity: number;
  customerName: string;
  customerEmail: string;
  phoneNumber: string;
}
