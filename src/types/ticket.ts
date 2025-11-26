export interface TicketType {
  id: string;
  name: string;
  displayName: string;
  description: string;
  price: number;
  quantityAvailable: number;
  salesStart: string | null;
  salesEnd: string | null;
}

export interface TicketBuyer {
  id: string;
  ticketNumber: string;
  customerName: string;
  customerEmail: string;
  price: number;
  status: string;
  createdAt: string;
  scanned: boolean;
  scannedAt: string | null;
  ticketType: TicketType;
}

export interface EventTicketsResponse {
  data: {
    event: {
      id: string;
      name: string;
      start_date?: string;
      end_date?: string;
      location?: string;
    } | null;
    tickets: TicketBuyer[];
  };
}
