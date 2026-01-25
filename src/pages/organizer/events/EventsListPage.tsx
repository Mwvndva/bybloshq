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
import api from '@/lib/api';
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

            const response = await api.get(`/organizers/events?${params}`);

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
            await api.delete(`/organizers/events/${eventId}`);
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

            const response = await api.post('/organizers/withdrawal-request', payload);

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
                return 'bg-gradient-to-r from-green-100 to-green-200 text-green-800';
            case 'draft':
                return 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-800';
            case 'cancelled':
                return 'bg-gradient-to-r from-red-100 to-red-200 text-red-800';
            case 'completed':
                return 'bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800';
            case 'upcoming':
                return 'bg-gradient-to-r from-yellow-100 to-yellow-200 text-yellow-800';
            default:
                return 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-800';
        }
    };

    if (isLoading && !isRefreshing) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex items-center justify-center">
                <div className="text-center space-y-6 p-8">
                    <div className="w-24 h-24 mx-auto bg-gradient-to-br from-yellow-100 to-yellow-200 rounded-3xl flex items-center justify-center shadow-lg">
                        <Loader2 className="h-12 w-12 text-yellow-600 animate-spin" />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-black mb-3">Loading Events</h3>
                        <p className="text-gray-600 text-lg font-medium">Please wait while we fetch your events...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Back Button */}
                <div className="mb-8">
                    <Button
                        variant="outline"
                        onClick={() => navigate('/organizer/dashboard')}
                        className="inline-flex items-center gap-2 border-gray-200 hover:bg-gray-50 hover:border-gray-300 rounded-xl px-4 py-2"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Dashboard
                    </Button>
                </div>

                {/* Header */}
                <div className="text-center mb-12">
                    <h1 className="text-2xl md:text-4xl font-black text-black mb-4">Event Management</h1>
                    <p className="text-gray-600 text-lg font-medium">Manage all your events in one place</p>
                </div>

                {/* Quick Actions */}
                <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-lg border border-gray-200/50 mb-12">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 space-y-4 sm:space-y-0">
                        <div>
                            <h3 className="text-xl md:text-3xl font-black text-black">Quick Actions</h3>
                            <p className="text-gray-600 font-medium mt-2">Common tasks for your events</p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <Button
                                variant="outline"
                                onClick={handleRefresh}
                                disabled={isRefreshing}
                                className="border-gray-200 hover:bg-gray-50 hover:border-gray-300 rounded-xl px-4 py-2"
                            >
                                {isRefreshing ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                ) : (
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                )}
                                Refresh
                            </Button>
                            <Button
                                onClick={() => navigate('/organizer/events/new')}
                                className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-white hover:from-yellow-500 hover:to-yellow-600 shadow-lg px-6 py-2 rounded-xl font-semibold"
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Create Event
                            </Button>
                        </div>
                    </div>

                    <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                        <Button
                            variant="outline"
                            className="h-14 sm:h-16 justify-start gap-3 sm:gap-4 text-left border-gray-200 hover:bg-yellow-50 hover:border-yellow-300 rounded-xl"
                            onClick={() => navigate('/organizer/events/new')}
                        >
                            <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
                            <div>
                                <p className="font-semibold">Create New Event</p>
                                <p className="text-sm text-gray-500">Start a new event</p>
                            </div>
                        </Button>

                        <Button
                            variant="outline"
                            className="h-14 sm:h-16 justify-start gap-3 sm:gap-4 text-left border-gray-200 hover:bg-yellow-50 hover:border-yellow-300 rounded-xl"
                            onClick={handleRefresh}
                        >
                            <RefreshCw className="h-5 w-5 sm:h-6 sm:w-6" />
                            <div>
                                <p className="font-semibold">Refresh Events</p>
                                <p className="text-sm text-gray-500">Reload all events</p>
                            </div>
                        </Button>

                        <Button
                            variant="outline"
                            className="h-14 sm:h-16 justify-start gap-3 sm:gap-4 text-left border-gray-200 hover:bg-yellow-50 hover:border-yellow-300 rounded-xl"
                            onClick={() => navigate('/organizer/dashboard')}
                        >
                            <CalendarIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                            <div>
                                <p className="font-semibold">Back to Dashboard</p>
                                <p className="text-sm text-gray-500">Return to overview</p>
                            </div>
                        </Button>
                    </div>
                </div>

                {/* Events Grid */}
                <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-lg border border-gray-200/50">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h3 className="text-xl md:text-3xl font-black text-black">Your Events</h3>
                            <p className="text-gray-600 font-medium mt-2">
                                {filteredEvents.length} {filteredEvents.length === 1 ? 'event' : 'events'} total
                            </p>
                        </div>
                        <Badge variant="secondary" className="bg-gradient-to-r from-yellow-100 to-yellow-200 text-yellow-800 px-4 py-2 text-sm font-bold rounded-xl">
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
                                    <Card key={event.id} className="group hover:shadow-2xl transition-all duration-500 border-0 bg-white/80 backdrop-blur-sm transform hover:-translate-y-2">
                                        <div className="relative overflow-hidden rounded-t-2xl">
                                            {event.image_url ? (
                                                <img
                                                    src={event.image_url}
                                                    alt={event.name}
                                                    className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-500"
                                                />
                                            ) : (
                                                <div className="w-full h-48 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                                                    <CalendarIcon className="h-16 w-16 text-gray-400" />
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
                                                    className="h-8 w-8 bg-white/90 hover:bg-white rounded-xl shadow-lg backdrop-blur-sm"
                                                    onClick={(e) => handleDeleteEvent(event.id, e)}
                                                >
                                                    <Trash2 className="h-4 w-4 text-red-600" />
                                                </Button>
                                            </div>
                                        </div>
                                        <CardContent className="p-6">
                                            <h3 className="font-bold text-black mb-2 line-clamp-1 text-lg">{event.name}</h3>
                                            <p className="text-yellow-600 font-black text-xl mb-3">
                                                {event.ticket_price > 0 ? `KSh ${Number(event.ticket_price).toLocaleString('en-KE')}` : 'Free'}
                                            </p>
                                            <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed mb-4">
                                                {event.description || 'No description available'}
                                            </p>

                                            <div className="space-y-3">
                                                <div className="flex items-center text-sm text-gray-500">
                                                    <CalendarIcon className="h-4 w-4 mr-2" />
                                                    <span>
                                                        {isTodayEvent ? 'Today' : format(startDate, 'EEEE')}, {format(startDate, 'h:mm a')}
                                                    </span>
                                                </div>
                                                <div className="flex items-center text-sm text-gray-500">
                                                    <MapPin className="h-4 w-4 mr-2" />
                                                    <span className="truncate">{event.location}</span>
                                                </div>
                                                <div className="flex items-center justify-between text-sm">
                                                    <span className="text-gray-500">Tickets sold</span>
                                                    <span className="font-semibold">{event.tickets_sold} / {event.ticket_quantity}</span>
                                                </div>
                                                <div className="w-full bg-gray-200 rounded-full h-2">
                                                    <div
                                                        className="bg-gradient-to-r from-yellow-400 to-yellow-500 h-2 rounded-full transition-all duration-300"
                                                        style={{
                                                            width: `${Math.min(100, (event.tickets_sold / event.ticket_quantity) * 100)}%`
                                                        }}
                                                    />
                                                </div>
                                            </div>

                                            <div className="mt-4 space-y-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="w-full border-gray-200 hover:bg-gray-50 hover:border-gray-300 rounded-xl"
                                                    onClick={() => navigate(`/organizer/events/${event.id}`)}
                                                >
                                                    View Details
                                                </Button>
                                                {event.withdrawal_status === 'paid' ? (
                                                    <div className="w-full flex items-center justify-center py-2 px-3 bg-green-50 border border-green-200 rounded-xl">
                                                        <div className="flex items-center text-green-700">
                                                            <DollarSign className="h-4 w-4 mr-2" />
                                                            <span className="font-medium">Withdrawn</span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="w-full border-yellow-200 hover:bg-yellow-50 hover:border-yellow-300 rounded-xl text-yellow-700 hover:text-yellow-800 disabled:opacity-50 disabled:cursor-not-allowed"
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
                            <div className="w-24 h-24 mx-auto mb-8 bg-gradient-to-br from-yellow-100 to-yellow-200 rounded-3xl flex items-center justify-center shadow-lg">
                                <CalendarIcon className="h-12 w-12 text-yellow-600" />
                            </div>
                            <h3 className="text-2xl font-black text-black mb-3">No events found</h3>
                            <p className="text-gray-600 text-lg font-medium max-w-md mx-auto mb-6">Create your first event to get started</p>
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
                        <div className="text-sm text-gray-600">
                            Showing <span className="font-medium">{filteredEvents.length}</span> of{' '}
                            <span className="font-medium">{pagination.total}</span> events
                        </div>
                        <div className="flex items-center space-x-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                                disabled={pagination.page === 1}
                                className="border-gray-200 hover:bg-gray-50 hover:border-gray-300 rounded-xl"
                            >
                                Previous
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                                disabled={pagination.page >= pagination.totalPages}
                                className="border-gray-200 hover:bg-gray-50 hover:border-gray-300 rounded-xl"
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                )}

                {/* Withdraw Dialog */}
                <Dialog open={showWithdrawDialog} onOpenChange={setShowWithdrawDialog}>
                    <DialogContent className="bg-white/95 backdrop-blur-sm border-0 shadow-2xl rounded-3xl max-w-md">
                        <DialogHeader className="text-center pb-6">
                            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-yellow-100 to-yellow-200 shadow-lg">
                                <DollarSign className="h-8 w-8 text-yellow-600" />
                            </div>
                            <DialogTitle className="text-2xl font-black text-black mt-4">
                                Withdraw Revenue
                            </DialogTitle>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="mt-2 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                                onClick={() => setShowHistoryModal(true)}
                            >
                                <RefreshCw className="h-3 w-3 mr-1" />
                                View Payout History
                            </Button>
                        </DialogHeader>

                        {selectedEventForWithdraw && (
                            <div className="space-y-6">
                                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-6">
                                    <h3 className="text-lg font-bold text-black mb-2">{selectedEventForWithdraw.name}</h3>
                                    <p className="text-gray-600 text-sm">
                                        {selectedEventForWithdraw.tickets_sold} tickets sold at KSh {Number(selectedEventForWithdraw.ticket_price).toLocaleString('en-KE')} each
                                    </p>
                                </div>

                                {(() => {
                                    const breakdown = calculateRevenueBreakdown(selectedEventForWithdraw);
                                    return (
                                        <div className="space-y-4">
                                            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-6 border border-green-200">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="font-bold text-green-800">
                                                        {selectedEventForWithdraw.balance !== undefined && selectedEventForWithdraw.balance !== null ? 'Available Balance' : 'Total Revenue'}
                                                    </span>
                                                    <span className="text-2xl font-black text-green-600">
                                                        KSh {breakdown.totalRevenue.toLocaleString('en-KE')}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-green-700">
                                                    {selectedEventForWithdraw.balance !== undefined && selectedEventForWithdraw.balance !== null
                                                        ? 'Funds currently available for withdrawal'
                                                        : `${selectedEventForWithdraw.tickets_sold} tickets × KSh ${Number(selectedEventForWithdraw.ticket_price).toLocaleString('en-KE')}`}
                                                </p>
                                            </div>

                                            <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-2xl p-6 border border-red-200">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="font-bold text-red-800">Platform Fee (6%)</span>
                                                    <span className="text-xl font-black text-red-600">
                                                        KSh {breakdown.platformFee.toLocaleString('en-KE')}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-red-700">
                                                    6% of total revenue
                                                </p>
                                            </div>

                                            <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-2xl p-6 border border-yellow-200">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="font-bold text-yellow-800">Net Payout (94%)</span>
                                                    <span className="text-2xl font-black text-yellow-600">
                                                        KSh {breakdown.netPayout.toLocaleString('en-KE')}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-yellow-700">
                                                    Amount you will receive
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* M-Pesa Fields */}
                                <div className="space-y-4">
                                    <div>
                                        <Label className="text-sm font-bold text-gray-700">M-Pesa Number</Label>
                                        <Input
                                            type="tel"
                                            placeholder="2547XXXXXXXX"
                                            value={withdrawDetails.mpesaNumber}
                                            onChange={(e) => setWithdrawDetails(prev => ({ ...prev, mpesaNumber: e.target.value }))}
                                            className="border-gray-200 rounded-xl"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-sm font-bold text-gray-700">Registered Name</Label>
                                        <Input
                                            type="text"
                                            placeholder="Name as registered with M-Pesa"
                                            value={withdrawDetails.registeredName}
                                            onChange={(e) => setWithdrawDetails(prev => ({ ...prev, registeredName: e.target.value }))}
                                            className="border-gray-200 rounded-xl"
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                                    <Button
                                        onClick={processWithdrawal}
                                        disabled={isProcessingWithdraw}
                                        className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-white hover:from-yellow-500 hover:to-yellow-600 shadow-lg px-6 py-3 rounded-xl font-semibold disabled:opacity-50"
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
                                    <Button
                                        variant="outline"
                                        onClick={() => setShowWithdrawDialog(false)}
                                        disabled={isProcessingWithdraw}
                                        className="border-gray-200 hover:bg-gray-50 hover:border-gray-300 rounded-xl px-6 py-3"
                                    >
                                        Cancel
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