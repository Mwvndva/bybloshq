import eventBus from '../../application/events/eventBus.js';
import { DomainEvents, AppEvents } from './domainEvents.js';

/**
 * Domain-level Event Dispatcher Facade
 * Provides a clean downward interface for domain services to emit events
 * without directly importing application-level event bus implementations.
 */
export const domainEventDispatcher = {
  emit(event, ...args) {
    return eventBus.emit(event, ...args);
  },
  async enqueueInTransaction(client, event, payload = {}) {
    return eventBus.enqueueInTransaction(client, event, payload);
  },
  async enqueue(event, payload = {}) {
    return eventBus.enqueue(event, payload);
  },
  dispatchAfterCommit(eventId, context = 'DomainEventDispatcher') {
    return eventBus.dispatchAfterCommit(eventId, context);
  },
  dispatchManyAfterCommit(eventIds = [], context = 'DomainEventDispatcher') {
    return eventBus.dispatchManyAfterCommit(eventIds, context);
  },
  async enqueueAndDispatch(event, payload = {}, context = 'DomainEventDispatcher') {
    return eventBus.enqueueAndDispatch(event, payload, context);
  }
};

export { DomainEvents, AppEvents };
export default domainEventDispatcher;
