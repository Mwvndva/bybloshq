class EventPolicy {
    /**
     * Check if user can manage the event
     * @param {Object} user 
     * @param {Object} event 
     * @returns {boolean}
     */
    static manage(user, event) {
        if (!user || !event) return false;

        if (user.userType === 'admin') return true;

        const organizerId = String(event.organizer_id || event.organizerId);
        return String(user.id) === organizerId;
    }

    /**
     * Check if user can verify tickets for the event
     * @param {Object} user 
     * @param {Object} event 
     * @returns {boolean}
     */
    static verifyTicket(user, event) {
        return this.manage(user, event);
    }
}

export default EventPolicy;
