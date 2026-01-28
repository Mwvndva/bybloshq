import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, MoreHorizontal, Loader2, RefreshCw, Calendar as CalendarIcon, MapPin, ArrowLeft, Trash2, DollarSign, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

import { format, parseISO, isAfter, isBefore, isToday, differenceInMinutes, differenceInHours } from 'date-fns';
import apiClient from '@/lib/apiClient';
import { WithdrawalHistoryModal } from '@/components/organizer/WithdrawalHistoryModal';

type EventStatus = 'draft' | 'published' | 'cancelled' | 'completed' | 'upcoming' | 'past';

interface Event {
    id: number;
    name: string;
    status: EventStatus;
    start_date: string;
    end_date: string;
    ticket_quantity: number;
    ticket_price: number;
    tickets_sold: number;
    revenue?: number;
    balance?: string | number;
    location: string;
    description?: string;
    image_url?: string | null;
    created_at: string;
    updated_at: string;
    withdrawal_status?: string;
    withdrawal_date?: string;
    withdrawal_amount?: number;
}

interface EventsResponse {
    data: {
        events: Event[];
        pagination: {
            total: number;
            page: number;
            limit: number;
            total_pages: number;
        };
    };
}

const POLLING_INTERVAL = 30000; // 30 seconds

export default function EventsListPage() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [events, setEvents] = useState<Event[]>([]);
    const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 1
    });
    const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);
    const [selectedEventForWithdraw, setSelectedEventForWithdraw] = useState<Event | null>(null);
    const [isProcessingWithdraw, setIsProcessingWithdraw] = useState(false);
    const [withdrawDetails, setWithdrawDetails] = useState({
        mpesaNumber: '',
        registeredName: ''
    });
    const [showHistoryModal, setShowHistoryModal] = useState(false);

    const fetchEvents = useCallback(async (page = 1, limit = 10, isInitialLoad = false) => {
        try {
            // Only show loading screen on initial load, not during refreshes
            if (isInitialLoad) {
                setIsLoading(true);
            }

            const params = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
            });

            const response = await apiClient.get(`/organizers/events?${params}`);

            // Handle different possible response structures
            const responseData = response.data as any;
            const eventsData = responseData?.data?.events || responseData?.data || [];
            const paginationData = responseData?.data?.pagination || {
                total: eventsData.length,
                page: page,
                limit: limit,
                total_pages: Math.ceil(eventsData.length / limit)
            };

            setEvents(Array.isArray(eventsData) ? eventsData : []);
            setFilteredEvents(Array.isArray(eventsData) ? eventsData : []);
            setPagination(prev => ({
                ...prev,
                page: page,
                limit: limit,
                total: paginationData.total || 0,
                totalPages: paginationData.total_pages || 1
            }));
            setLastUpdated(new Date());
        } catch (error) {
            console.error('Error fetching events:', error);
            toast({
                title: "Error",
                description: "Failed to load events. Please try again later.",
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    // Initial fetch and setup polling
    useEffect(() => {
        fetchEvents(pagination.page, pagination.limit, true); // Initial load

        const intervalId = setInterval(() => {
            fetchEvents(pagination.page, pagination.limit, false); // Background refresh
        }, POLLING_INTERVAL);

        return () => clearInterval(intervalId);
    }, []); // Empty dependency array to prevent re-running

    const handleRefresh = () => {
        setIsRefreshing(true);
        fetchEvents(pagination.page, pagination.limit, false);
    };

    const handleDeleteEvent = async (eventId: number, event: React.MouseEvent) => {
        event.stopPropagation();

        if (!window.confirm('Are you sure you want to delete this event? This action cannot be undone.')) {
            return;
        }

        try {
            await apiClient.delete(`/organizers/events/${eventId}`);
            toast({
                title: "Success",
                description: "Event deleted successfully",
                variant: "default"
            });
            fetchEvents(pagination.page, pagination.limit, false); // Refresh the events list
        } catch (error) {
            console.error('Error deleting event:', error);
            toast({
                title: "Error",
                description: "Failed to delete event. Please try again.",
                variant: "destructive"
            });
        }
    };

    const handleWithdrawClick = (event: Event, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedEventForWithdraw(event);
        setShowWithdrawDialog(true);
    };

    const calculateRevenueBreakdown = (event: Event) => {
        let totalRevenue = 0;

        // If backend provides specific balance (available funds), use it
        if (event.balance !== undefined && event.balance !== null) {
            totalRevenue = typeof event.balance === 'string' ? parseFloat(event.balance) : Number(event.balance);
        } else {
            // Fallback: This calculates lifetime revenue from sales
            totalRevenue = (event.tickets_sold || 0) * (event.ticket_price || 0);
        }

        const platformFee = totalRevenue * 0.06; // 6% platform fee
        const netPayout = totalRevenue * 0.94; // 94% net payout

        return {
            totalRevenue,
            platformFee,
            netPayout
        };
    };

    // Format event date for display
    const formatEventDate = (dateString: string) => {
        try {
            return format(parseISO(dateString), 'EEEE, MMMM d, yyyy');
        } catch (e) {
            console.error('Error formatting date:', e);
            return 'Date not available';
        }
    };

    const processWithdrawal = async () => {
        if (!selectedEventForWithdraw) return;

        // Validate required fields (M-Pesa is now the only option)
        if (!withdrawDetails.mpesaNumber || !withdrawDetails.registeredName) {
            toast({
                title: "Validation Error",
                description: "Please fill in M-Pesa number and registered name",
                variant: "destructive"
            });
            return;
        }

        try {
            setIsProcessingWithdraw(true);

            const breakdown = calculateRevenueBreakdown(selectedEventForWithdraw);

            const payload = {
                eventId: selectedEventForWithdraw.id,
                amount: breakdown.netPayout, // withdrawing the net amount
                mpesaNumber: withdrawDetails.mpesaNumber,
                mpesaName: withdrawDetails.registeredName
            };

            const response = await apiClient.post('/organizers/withdrawal-request', payload);

            const responseData = response.data as any;

            if (responseData.status === 'success') {
                toast({
                    title: "Success",
                    description: "Withdrawal initiated! You will receive an M-Pesa notification shortly.",
                    variant: "default"
                });
                setShowWithdrawDialog(false);
                // Refresh events to update status/balance if needed
                fetchEvents(pagination.page, pagination.limit, false);

                // Reset form
                setWithdrawDetails({
                    mpesaNumber: '',
                    registeredName: ''
                });
            } else {
                throw new Error(responseData.message || 'Failed to initiate M-Pesa withdrawal');
            }

        } catch (error: any) {
            console.error('Withdrawal error:', error);
            let errorMessage = error.response?.data?.message || error.message || 'Failed to process withdrawal request';

            // Append detail if available (useful for debugging)
            if (error.response?.data?.detail) {
                errorMessage += `\nDetails: ${error.response.data.detail}`;
            }

            toast({
                title: "Error",
                description: errorMessage,
                variant: "destructive",
                duration: 8000 // Show for longer since it might be long
            });
        } finally {
            setIsProcessingWithdraw(false);
        }
    };

    const getEventStatus = (event: Event): EventStatus => {
        if (event.status === 'cancelled' || event.status === 'completed') {
            return event.status;
        }

        const now = new Date();
        const startDate = new Date(event.start_date);
        const endDate = new Date(event.end_date);

        if (isAfter(now, endDate)) return 'completed';
        if (isBefore(now, startDate)) return 'upcoming';
        return 'published';
    };

    const formatEventDuration = (start: Date, end: Date) => {
        const minutes = differenceInMinutes(end, start);
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;

        if (hours > 0 && remainingMinutes > 0) {
            return `${hours}h ${remainingMinutes}m`;
        } else if (hours > 0) {
            return `${hours}h`;
        } else {
            return `${minutes}m`;
        }
    };

    const getStatusBadgeVariant = (status: EventStatus) => {
        switch (status) {
            case 'published':
                return 'default';
            case 'draft':
                return 'secondary';
            case 'cancelled':
                return 'destructive';
            case 'completed':
                return 'outline';
            case 'upcoming':
                return 'default';
            default:
                return 'default';
        }
    };

    const getStatusColor = (status: EventStatus) => {
        switch (status) {
            case 'published':
                return 'bg-green-500/10 text-green-400 border border-green-400/30';
            case 'draft':
                return 'bg-[#111111] text-[#a1a1a1] border border-[#222222]';
            case 'cancelled':
                return 'bg-red-500/10 text-red-400 border border-red-400/30';
            case 'completed':
                return 'bg-blue-500/10 text-blue-400 border border-blue-400/30';
            case 'upcoming':
                return 'bg-yellow-500/10 text-yellow-400 border border-yellow-400/30';
            default:
                return 'bg-[#111111] text-[#a1a1a1] border border-[#222222]';
        }
    };

    if (isLoading && !isRefreshing) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="text-center space-y-6 p-8">
                    <div className="w-24 h-24 mx-auto bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-3xl flex items-center justify-center shadow-lg">
                        <Loader2 className="h-12 w-12 text-white animate-spin" />
                    </div>
                    <div>
                        <h3 className="text-2xl font-semibold text-white mb-3">Loading Events</h3>
                        <p className="text-[#a1a1a1] text-lg font-normal">Please wait while we fetch your events...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black">
            {/* Desktop Header - Full Width */}
            <div className="hidden md:block bg-black/80 backdrop-blur-md border-b border-white/10 sticky top-0 z-10 shadow-sm px-4 sm:px-6 lg:px-8 py-3 sm:py-4 mb-8 md:mb-10">
                <div className="relative flex items-center justify-between h-14 lg:h-16">
                    <div className="flex-1 flex items-center justify-start">
                        <Button
                            variant="secondary-byblos"
                            onClick={() => navigate('/organizer/dashboard')}
                            className="rounded-xl px-2 sm:px-3 py-1.5 text-xs sm:text-sm h-8"
                        >
                            <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                            <span className="hidden sm:inline">Back to Dashboard</span>
                            <span className="sm:hidden">Back</span>
                        </Button>
                    </div>

                    <div className="absolute left-1/2 -translate-x-1/2 min-w-0 max-w-[50%] text-center px-1 sm:px-2">
                        <h1 className="text-sm sm:text-lg md:text-xl font-black text-white tracking-tight truncate">
                            Event Management
                        </h1>
                        <p className="hidden sm:block text-xs text-gray-300 font-medium truncate">
                            Manage all your events in one place
                        </p>
                    </div>

                    <div className="flex-1 flex items-center justify-end">
                        <Button
                            variant="secondary-byblos"
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            className="flex items-center gap-1 sm:gap-2 rounded-xl h-8 px-2 sm:px-3 py-1.5"
                        >
                            {isRefreshing ? (
                                <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
                            ) : (
                                <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            )}
                            <span className="hidden md:inline text-sm">Refresh</span>
                        </Button>
                    </div>
                </div>
            </div>

            <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

                {/* Quick Actions */}
                <div
                    className="rounded-2xl sm:rounded-3xl border shadow-2xl p-4 sm:p-5 md:p-6 mb-12"
                    style={{
                        background: '#111111',
                        backdropFilter: 'blur(12px)',
                        WebkitBackdropFilter: 'blur(12px)',
                        border: '1px solid #222222',
                        boxShadow: 'none'
                    }}
                >
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 space-y-4 sm:space-y-0">
                        <div>
                            <h3 className="text-xl md:text-3xl font-semibold text-white">Quick Actions</h3>
                            <p className="text-[#a1a1a1] font-normal mt-2">Common tasks for your events</p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <Button
                                variant="secondary-byblos"
                                onClick={() => navigate('/organizer/events/new')}
                                className="px-6 py-2 rounded-xl border-yellow-400/40"
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Create Event
                            </Button>
                        </div>
                    </div>

                    <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                        <Button
                            variant="secondary-byblos"
                            className="h-14 sm:h-16 gap-3 sm:gap-4 rounded-xl"
                            onClick={() => navigate('/organizer/events/new')}
                        >
                            <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
                            <div>
                                <p className="font-medium text-yellow-400">Create New Event</p>
                                <p className="text-sm text-yellow-400/70">Start a new event</p>
                            </div>
                        </Button>

                        <Button
                            variant="secondary-byblos"
                            className="h-14 sm:h-16 gap-3 sm:gap-4 rounded-xl"
                            onClick={handleRefresh}
                        >
                            <RefreshCw className="h-5 w-5 sm:h-6 sm:w-6" />
                            <div>
                                <p className="font-medium text-yellow-400">Refresh Events</p>
                                <p className="text-sm text-yellow-400/70">Reload all events</p>
                            </div>
                        </Button>

                        <Button
                            variant="secondary-byblos"
                            className="h-14 sm:h-16 gap-3 sm:gap-4 rounded-xl"
                            onClick={() => navigate('/organizer/dashboard')}
                        >
                            <CalendarIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                            <div>
                                <p className="font-medium text-yellow-400">Back to Dashboard</p>
                                <p className="text-sm text-yellow-400/70">Return to overview</p>
                            </div>
                        </Button>
                    </div>
                </div>

                {/* Events Grid */}
                <div className="bg-[#111111] rounded-3xl p-8 border border-[#222222]">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h3 className="text-xl md:text-3xl font-semibold text-white">Your Events</h3>
                            <p className="text-[#a1a1a1] font-normal mt-2">
                                {filteredEvents.length} {filteredEvents.length === 1 ? 'event' : 'events'} total
                            </p>
                        </div>
                        <Badge variant="secondary" className="bg-gradient-to-r from-yellow-400/20 to-yellow-500/20 text-yellow-400 px-4 py-2 text-sm font-semibold rounded-xl border border-yellow-400/30">
                            {filteredEvents.filter(e => getEventStatus(e) === 'upcoming' || getEventStatus(e) === 'published').length} Active
                        </Badge>
                    </div>

                    {filteredEvents.length > 0 ? (
                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                            {filteredEvents.map((event) => {
                                const status = getEventStatus(event);
                                const startDate = parseISO(event.start_date);
                                const endDate = parseISO(event.end_date);
                                const isTodayEvent = isToday(startDate);

                                return (
                                    <Card key={event.id} className="group transition-all duration-500 border border-white/10 bg-black backdrop-blur-md transform hover:-translate-y-2">
                                        <div className="relative overflow-hidden rounded-t-2xl">
                                            {event.image_url ? (
                                                <img
                                                    src={event.image_url}
                                                    alt={event.name}
                                                    className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-500"
                                                />
                                            ) : (
                                                <div className="w-full h-48 bg-[#111111] flex items-center justify-center">
                                                    <CalendarIcon className="h-16 w-16 text-gray-300" />
                                                </div>
                                            )}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                            <Badge
                                                className={`absolute top-4 left-4 px-3 py-1 text-xs font-bold rounded-xl ${getStatusColor(status)}`}
                                            >
                                                {status}
                                            </Badge>
                                            <div className="absolute top-4 right-4">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 bg-transparent hover:bg-white/5 rounded-xl border border-[#222222] text-[#a1a1a1] hover:text-white"
                                                    onClick={(e) => handleDeleteEvent(event.id, e)}
                                                >
                                                    <Trash2 className="h-4 w-4 text-red-400" />
                                                </Button>
                                            </div>
                                        </div>
                                        <CardContent className="p-6">
                                            <h3 className="font-semibold text-white mb-2 line-clamp-1 text-lg">{event.name}</h3>
                                            <p className="text-yellow-600 font-black text-xl mb-3">
                                                {event.ticket_price > 0 ? `KSh ${Number(event.ticket_price).toLocaleString('en-KE')}` : 'Free'}
                                            </p>
                                            <p className="text-sm text-[#a1a1a1] line-clamp-2 leading-relaxed mb-4">
                                                {event.description || 'No description available'}
                                            </p>

                                            <div className="space-y-3">
                                                <div className="flex items-center text-sm text-[#a1a1a1]">
                                                    <CalendarIcon className="h-4 w-4 mr-2" />
                                                    <span>
                                                        {isTodayEvent ? 'Today' : format(startDate, 'EEEE')}, {format(startDate, 'h:mm a')}
                                                    </span>
                                                </div>
                                                <div className="flex items-center text-sm text-[#a1a1a1]">
                                                    <MapPin className="h-4 w-4 mr-2" />
                                                    <span className="truncate">{event.location}</span>
                                                </div>
                                                <div className="flex items-center justify-between text-sm">
                                                    <span className="text-[#a1a1a1]">Tickets sold</span>
                                                    <span className="font-medium text-white">{event.tickets_sold} / {event.ticket_quantity}</span>
                                                </div>
                                                <div className="w-full bg-gray-800 rounded-full h-2">
                                                    <div
                                                        className="bg-gradient-to-r from-yellow-400 to-yellow-500 h-2 rounded-full transition-all duration-300"
                                                        style={{
                                                            width: `${Math.min(100, (event.tickets_sold / event.ticket_quantity) * 100)}%`
                                                        }}
                                                    />
                                                </div>
                                            </div>

                                            <div className="mt-4 flex flex-col sm:flex-row gap-2">
                                                <Button
                                                    variant="secondary-byblos"
                                                    size="sm"
                                                    className="flex-1 rounded-xl"
                                                    onClick={() => navigate(`/organizer/events/${event.id}`)}
                                                >
                                                    View Details
                                                </Button>
                                                {event.withdrawal_status === 'paid' ? (
                                                    <div className="flex-1 flex items-center justify-center py-2 px-3 bg-green-500/20 border border-green-400/30 rounded-xl">
                                                        <div className="flex items-center text-green-400">
                                                            <DollarSign className="h-4 w-4 mr-2" />
                                                            <span className="font-medium">Withdrawn</span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <Button
                                                        variant="secondary-byblos"
                                                        size="sm"
                                                        className="flex-1 rounded-xl border-yellow-400/40"
                                                        onClick={(e) => handleWithdrawClick(event, e)}
                                                        disabled={!calculateRevenueBreakdown(event).netPayout || calculateRevenueBreakdown(event).netPayout <= 0}
                                                    >
                                                        <DollarSign className="h-4 w-4 mr-2" />
                                                        {(calculateRevenueBreakdown(event).netPayout || 0) > 0 ? "Withdraw" : "No Funds"}
                                                    </Button>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-20">
                            <div className="w-24 h-24 mx-auto mb-8 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-3xl flex items-center justify-center shadow-lg">
                                <CalendarIcon className="h-12 w-12 text-white" />
                            </div>
                            <h3 className="text-2xl font-semibold text-white mb-3">No events found</h3>
                            <p className="text-[#a1a1a1] text-lg font-normal max-w-md mx-auto mb-6">Create your first event to get started</p>
                            <Button
                                onClick={() => navigate('/organizer/events/new')}
                                className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-white hover:from-yellow-500 hover:to-yellow-600 shadow-lg px-8 py-3 rounded-xl font-semibold"
                            >
                                <Plus className="h-5 w-5 mr-2" />
                                Create Your First Event
                            </Button>
                        </div>
                    )}
                </div>

                {pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between mt-8">
                        <div className="text-sm text-[#a1a1a1]">
                            Showing <span className="font-medium">{filteredEvents.length}</span> of{' '}
                            <span className="font-medium">{pagination.total}</span> events
                        </div>
                        <div className="flex items-center space-x-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                                disabled={pagination.page === 1}
                                className="rounded-xl"
                            >
                                Previous
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                                disabled={pagination.page >= pagination.totalPages}
                                className="rounded-xl"
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                )}

                {/* Withdraw Dialog */}
                <Dialog open={showWithdrawDialog} onOpenChange={setShowWithdrawDialog}>
                    <DialogContent
                        className="rounded-2xl border shadow-2xl max-w-md"
                        style={{
                            background: 'rgba(20, 20, 20, 0.7)',
                            backdropFilter: 'blur(12px)',
                            WebkitBackdropFilter: 'blur(12px)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.6)'
                        }}
                    >
                        <DialogHeader className="text-center pb-6">
                            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-yellow-500 shadow-lg">
                                <DollarSign className="h-8 w-8 text-white" />
                            </div>
                            <DialogTitle className="text-2xl font-semibold text-white mt-4">
                                Withdraw Revenue
                            </DialogTitle>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="mt-2 text-yellow-400 hover:text-yellow-300 hover:bg-white/5"
                                onClick={() => setShowHistoryModal(true)}
                            >
                                <RefreshCw className="h-3 w-3 mr-1" />
                                View Payout History
                            </Button>
                        </DialogHeader>

                        {selectedEventForWithdraw && (
                            <div className="space-y-6">
                                <div className="bg-[#111111] rounded-2xl p-6 border border-[#222222]">
                                    <h3 className="text-lg font-semibold text-white mb-2">{selectedEventForWithdraw.name}</h3>
                                    <p className="text-gray-300 text-sm">
                                        {selectedEventForWithdraw.tickets_sold} tickets sold at KSh {Number(selectedEventForWithdraw.ticket_price).toLocaleString('en-KE')} each
                                    </p>
                                </div>

                                {(() => {
                                    const breakdown = calculateRevenueBreakdown(selectedEventForWithdraw);
                                    return (
                                        <div className="space-y-4">
                                            <div className="bg-green-500/20 rounded-2xl p-6 border border-green-400/30">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="font-semibold text-green-400">
                                                        {selectedEventForWithdraw.balance !== undefined && selectedEventForWithdraw.balance !== null ? 'Available Balance' : 'Total Revenue'}
                                                    </span>
                                                    <span className="text-2xl font-semibold text-green-400">
                                                        KSh {breakdown.totalRevenue.toLocaleString('en-KE')}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-green-500">
                                                    {selectedEventForWithdraw.balance !== undefined && selectedEventForWithdraw.balance !== null
                                                        ? 'Funds currently available for withdrawal'
                                                        : `${selectedEventForWithdraw.tickets_sold} tickets × KSh ${Number(selectedEventForWithdraw.ticket_price).toLocaleString('en-KE')}`}
                                                </p>
                                            </div>

                                            <div className="bg-red-500/20 rounded-2xl p-6 border border-red-400/30">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="font-semibold text-red-400">Platform Fee (6%)</span>
                                                    <span className="text-xl font-semibold text-red-400">
                                                        KSh {breakdown.platformFee.toLocaleString('en-KE')}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-red-500">
                                                    6% of total revenue
                                                </p>
                                            </div>

                                            <div className="bg-yellow-500/20 rounded-2xl p-6 border border-yellow-400/30">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="font-semibold text-yellow-400">Net Payout (94%)</span>
                                                    <span className="text-2xl font-semibold text-yellow-400">
                                                        KSh {breakdown.netPayout.toLocaleString('en-KE')}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-yellow-500">
                                                    Amount you will receive
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* M-Pesa Fields */}
                                <div className="space-y-4">
                                    <div>
                                        <Label className="text-sm font-medium text-white">M-Pesa Number</Label>
                                        <Input
                                            type="tel"
                                            placeholder="2547XXXXXXXX"
                                            value={withdrawDetails.mpesaNumber}
                                            onChange={(e) => setWithdrawDetails(prev => ({ ...prev, mpesaNumber: e.target.value }))}
                                            className="input-mobile rounded-xl bg-gray-800 border-gray-700 text-white placeholder:text-gray-300 focus:border-yellow-400 focus:ring-yellow-400"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-sm font-medium text-white">Registered Name</Label>
                                        <Input
                                            type="text"
                                            placeholder="Name as registered with M-Pesa"
                                            value={withdrawDetails.registeredName}
                                            onChange={(e) => setWithdrawDetails(prev => ({ ...prev, registeredName: e.target.value }))}
                                            className="input-mobile rounded-xl bg-gray-800 border-gray-700 text-white placeholder:text-gray-300 focus:border-yellow-400 focus:ring-yellow-400"
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row justify-between gap-3 pt-4">
                                    <Button
                                        variant="outline"
                                        onClick={() => setShowWithdrawDialog(false)}
                                        disabled={isProcessingWithdraw}
                                        className="h-12 border-2 border-white/10 hover:bg-white/5 hover:border-yellow-400/30 rounded-xl px-6 py-3 text-gray-300 hover:text-white order-2 sm:order-1"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        variant="byblos"
                                        onClick={processWithdrawal}
                                        disabled={isProcessingWithdraw}
                                        className="h-12 shadow-lg px-6 py-3 rounded-xl order-1 sm:order-2 flex-1"
                                    >
                                        {isProcessingWithdraw ? (
                                            <>
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                Processing...
                                            </>
                                        ) : (
                                            <>
                                                <CreditCard className="h-4 w-4 mr-2" />
                                                Process Withdrawal
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>

                {selectedEventForWithdraw && (
                    <WithdrawalHistoryModal
                        isOpen={showHistoryModal}
                        onClose={() => setShowHistoryModal(false)}
                        eventId={selectedEventForWithdraw.id}
                        eventName={selectedEventForWithdraw.name}
                    />
                )}
            </div>
        </div>
    );
}