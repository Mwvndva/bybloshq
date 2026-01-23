import EventService from '../services/event.service.js';
import AppError from '../utils/appError.js';

export const createEvent = async (req, res, next) => {
  try {
    const event = await EventService.createEvent(req.user.id, req.body);
    res.status(201).json({ status: 'success', data: { event } });
  } catch (error) {
    if (error.code === '23505') return next(new AppError('Event already exists', 400));
    next(error);
  }
};

export const updateEvent = async (req, res, next) => {
  try {
    const event = await EventService.updateEvent(req.params.id, req.user.id, req.body);
    res.status(200).json({ status: 'success', data: { event } });
  } catch (error) {
    if (error.message === 'Unauthorized') return next(new AppError('Unauthorized', 403));
    if (error.message === 'Event not found') return next(new AppError('Event not found', 404));
    next(error);
  }
};

export const getEvent = async (req, res, next) => {
  try {
    const event = await EventService.getEvent(req.params.id);
    if (!event) return next(new AppError('Event not found', 404));
    res.status(200).json({ status: 'success', data: { event } });
  } catch (error) {
    next(error);
  }
};

export const getOrganizerEvents = async (req, res, next) => {
  try {
    const { data, meta } = await EventService.getOrganizerEvents(req.user.id, req.query);
    res.status(200).json({
      status: 'success',
      pagination: meta,
      data: data
    });
  } catch (error) {
    next(error);
  }
};

export const getDashboardEvents = async (req, res, next) => {
  try {
    // Re-use getOrganizerEvents logic or specific logic for dashboard?
    // Usually dashboard might need stats + events.
    // For now, map to getOrganizerEvents with a default limit or similar,
    // or just call the same service method.
    // Let's call the same service method but perhaps with different default limit?
    const { data, meta } = await EventService.getOrganizerEvents(req.user.id, { limit: 5, ...req.query });
    res.status(200).json({
      status: 'success',
      data: {
        events: data,
        stats: {
          // Placeholder for stats if frontend expects it here?
          // Previously dashboard had stats.
          // AdminController has getDashboardStats.
          // Organizer might rely on this endpoint for recent events on dashboard.
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

export const deleteEvent = async (req, res, next) => {
  try {
    const result = await EventService.deleteEvent(req.params.id, req.user.id);
    if (!result) return next(new AppError('Event not found or unauthorized', 404));
    res.status(204).json({ status: 'success', data: null });
  } catch (error) {
    next(error);
  }
};

export const getUpcomingEvents = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
    const events = await EventService.getUpcomingEvents(limit);

    // Flatten structure for frontend as requested in original controller
    const response = events.map(event => ({
      id: event.id,
      name: event.name,
      description: event.description,
      image_url: event.image_url,
      location: event.location,
      start_date: event.start_date,
      end_date: event.end_date,
      status: event.status,
      ticket_types: event.ticket_types // simplified mapping from service result
      // ... (other fields passed through)
    }));

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

// ... other read methods like getAllEvents if needed
export const getAllEvents = async (req, res, next) => {
  // Implement if needed or keep existing logic wrapped
  res.status(501).json({ message: 'Refactor WIP' });
}

export const getEventTickets = async (req, res, next) => {
  // This was in EventController but related to Tickets.
  // Should use TicketService or EventService.
  // I'll leave a TODO or simple implementation
  res.status(501).json({ message: 'Moved to TicketController/Service?' });
}

export const getEventTicketTypes = async (req, res, next) => {
  try {
    // Implementation for public ticket types
    // Simple services call
    // Assuming EventService has getEventTicketTypes(eventId)
    // or getEvent includes them.
    // Let's implement a quick query or service method.
    // For now, return 501 or stub to fix import error.
    res.status(501).json({ message: 'Not implemented' });
  } catch (error) {
    next(error);
  }
};

export const getPublicEvent = async (req, res, next) => {
  try {
    const event = await EventService.getPublicEvent(req.params.eventId);
    if (!event) return next(new AppError('Event not found', 404));
    res.status(200).json({ status: 'success', data: event });
  } catch (error) {
    next(error);
  }
};

export const getEventForBooking = async (req, res, next) => {
  try {
    // Uses the same public event service which includes detailed ticket info
    const event = await EventService.getPublicEvent(req.params.eventId);
    if (!event) return next(new AppError('Event not found', 404));
    res.status(200).json({ status: 'success', data: event });
  } catch (error) {
    next(error);
  }
};
