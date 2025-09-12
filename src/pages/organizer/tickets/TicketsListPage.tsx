import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Search, MoreHorizontal, Loader2, Ticket, User, Calendar, Mail, CreditCard, Hash, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import api from '@/lib/api';

interface Ticket {
  id: number;
  organizer_id: number;
  event_id: number;
  event_name: string;
  ticket_number: string;
  customer_name: string;
  customer_email: string;
  ticket_type_name?: string;  // Added this line
  ticket_type: string;
  price: number;
  status: 'pending' | 'paid' | 'cancelled' | 'refunded';
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
  // Additional fields that might come from the API
  event_title?: string;
  sale_date?: string;
  quantity?: number;
}

export default function TicketsListPage() {
  const { eventId } = useParams<{ eventId?: string }>();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        setLoading(true);
        const endpoint = eventId 
          ? `/organizers/tickets/events/${eventId}`
          : '/organizers/tickets';
        const response = await api.get(endpoint);
        console.log('Tickets API Response:', response.data);
        const ticketsData = response.data.data.tickets || [];
        console.log('Processed Tickets:', ticketsData);
        setTickets(ticketsData);
      } catch (error) {
        console.error('Error fetching tickets:', error);
        toast({
          title: 'Error',
          description: 'Failed to load tickets. Please try again later.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchTickets();
  }, [eventId, toast]);

  const handleStatusUpdate = async (ticketId: number, newStatus: 'pending' | 'paid' | 'cancelled' | 'refunded') => {
    try {
      const response = await api.patch(`/organizers/tickets/${ticketId}/status`, { status: newStatus });
      
      if (response.data.status === 'success') {
        // Update the local state with the updated ticket
        setTickets(tickets.map(ticket => 
          ticket.id === ticketId ? { ...ticket, status: newStatus } : ticket
        ));
        
        toast({
          title: 'Success',
          description: 'Ticket status updated successfully',
        });
      } else {
        throw new Error('Failed to update ticket status');
      }
    } catch (error) {
      console.error('Error updating ticket status:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to update ticket status. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const filteredTickets = tickets.filter(ticket => 
    (ticket.customer_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (ticket.customer_email?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (ticket.ticket_number?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (ticket.event_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (ticket.ticket_type?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Tickets</h1>
          {eventId && (
            <p className="text-muted-foreground mt-1">
              Viewing tickets for this event
            </p>
          )}
        </div>

      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search tickets..."
            className="pl-8 w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ticket #</TableHead>
              {!eventId && <TableHead>Event</TableHead>}
              <TableHead>Customer</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Purchased</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTickets.length > 0 ? (
              filteredTickets.map((ticket) => (
                <TableRow key={ticket.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center">
                      <Ticket className="h-4 w-4 mr-2 text-muted-foreground" />
                      {ticket.ticket_number}
                    </div>
                  </TableCell>
                  {!eventId && (
                    <TableCell>
                      <Link 
                        to={`/organizer/events/${ticket.event_id}`}
                        className="hover:underline text-primary"
                      >
                        {ticket.event_name}
                      </Link>
                    </TableCell>
                  )}
                  <TableCell>
                    <div>
                      <div className="font-medium">{ticket.customer_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {ticket.customer_email}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{
                    ticket.ticket_type_name || // First check ticket_type_name
                    ticket.ticket_type ||      // Fall back to ticket_type
                    (ticket.metadata?.ticketType || 'General') // Then check metadata
                  }</TableCell>
                  <TableCell>KSh {Number(ticket.price || 0).toLocaleString('en-KE', {minimumFractionDigits: 0, maximumFractionDigits: 0})}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        ticket.status === 'paid'
                          ? 'bg-green-100 text-green-800'
                          : ticket.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : ticket.status === 'cancelled'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {new Date(ticket.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setSelectedTicket(ticket)}>
                          View Details
                        </DropdownMenuItem>
                        {ticket.status !== 'cancelled' && (
                          <DropdownMenuItem 
                            className="text-red-600"
                            onClick={() => handleStatusUpdate(ticket.id, 'cancelled')}
                          >
                            Cancel Ticket
                          </DropdownMenuItem>
                        )}
                        {ticket.status === 'cancelled' && (
                          <DropdownMenuItem 
                            className="text-green-600"
                            onClick={() => handleStatusUpdate(ticket.id, 'paid')}
                          >
                            Reissue
                          </DropdownMenuItem>
                        )}
                        {ticket.status === 'pending' && (
                          <DropdownMenuItem 
                            onClick={() => handleStatusUpdate(ticket.id, 'paid')}
                          >
                            Mark as Paid
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell 
                  colSpan={eventId ? 7 : 8} 
                  className="text-center py-8 text-muted-foreground"
                >
                  {tickets.length === 0 ? (
                    'No tickets found.'
                  ) : (
                    'No tickets match your search.'
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Ticket Details Dialog */}
      <Dialog open={!!selectedTicket} onOpenChange={(open) => !open && setSelectedTicket(null)}>
        <DialogContent className="sm:max-w-[600px]">
          {selectedTicket && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Ticket className="h-5 w-5 text-primary" />
                  Ticket Details
                </DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <Hash className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Ticket Number</p>
                      <p className="font-medium">{selectedTicket.ticket_number}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Customer</p>
                      <p className="font-medium">{selectedTicket.customer_name}</p>
                      <p className="text-sm text-muted-foreground">{selectedTicket.customer_email}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Event</p>
                        <p className="font-medium">{selectedTicket.event_name}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Type</p>
                        <p className="font-medium">{selectedTicket.ticket_type}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Info className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Status</p>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            selectedTicket.status === 'paid'
                              ? 'bg-green-100 text-green-800'
                              : selectedTicket.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-800'
                              : selectedTicket.status === 'cancelled'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {selectedTicket.status.charAt(0).toUpperCase() + selectedTicket.status.slice(1)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Price</p>
                        <p className="font-medium">
                          KSh {Number(selectedTicket.price || 0).toLocaleString('en-KE', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                        </p>
                      </div>
                    </div>
                  </div>

                  
                  <div className="pt-2 border-t">
                    <p className="text-sm text-muted-foreground">Purchase Date</p>
                    <p className="text-sm">
                      {new Date(selectedTicket.created_at).toLocaleString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>

                {selectedTicket.metadata && Object.keys(selectedTicket.metadata).length > 0 && (
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium mb-2">Additional Information</h4>
                    <div className="space-y-2">
                      {Object.entries(selectedTicket.metadata).map(([key, value]) => (
                        <div key={key} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{key}:</span>
                          <span className="font-medium">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setSelectedTicket(null)}>
                  Close
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
