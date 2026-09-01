import type { LogisticsLeg, LogisticsLegType, LogisticsLocation, LogisticsRequestCard, LogisticsStatusUpdate } from '@/features/logistics/api';
import { DELIVERY_ACTIONS, PICKUP_ACTIONS } from '@/features/logistics/utils/mzigoDashboard.constants';
import type { ApiOrder, ApiOrderLogisticsDeliveryLeg } from '@/shared/types';

export type JourneyState = 'normal' | 'delayed' | 'attention';

export interface JourneyStep {
  key: string;
  label: string;
}

export const COURIER_JOURNEY_STEPS: JourneyStep[] = [
  { key: 'preparing', label: 'Preparing' },
  { key: 'picked_up', label: 'Picked up' },
  { key: 'on_the_way', label: 'On the way' },
  { key: 'delivered', label: 'Delivered' },
];

export const PICKUP_JOURNEY_STEPS: JourneyStep[] = [
  { key: 'order_paid', label: 'Order Paid' },
  { key: 'preparing', label: 'Preparing' },
  { key: 'ready_pickup', label: 'Ready for Pickup' },
  { key: 'completed', label: 'Collected' },
];

export const DIGITAL_JOURNEY_STEPS: JourneyStep[] = [
  { key: 'paid', label: 'Payment Confirmed' },
  { key: 'ready', label: 'Download Ready' },
];

export const SERVICE_JOURNEY_STEPS: JourneyStep[] = [
  { key: 'booked', label: 'Booking Paid' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
];

export const JOURNEY_STEPS: JourneyStep[] = COURIER_JOURNEY_STEPS;

export interface Journey {
  /** 0-based index into steps for the step currently active. */
  stepIndex: number;
  steps: JourneyStep[];
  state: JourneyState;
  /** Plain-language headline for the current situation. */
  label: string;
  /** One line of reassuring context under the headline. */
  detail: string;
  isDelivered: boolean;
  isRiderMoving?: boolean;
  percentProgress: number;
}

function has(status: string | null | undefined, ...needles: string[]) {
  const value = String(status || '').toLowerCase();
  return needles.some((needle) => value.includes(needle));
}

/** Check whether rider has actively started moving on the delivery leg */
export function isRiderMoving(deliveryLeg?: ApiOrderLogisticsDeliveryLeg | LogisticsLeg | null) {
  if (!deliveryLeg) return false;
  const status = String(deliveryLeg.status || '').toLowerCase();
  return status === 'out_for_delivery' || Boolean((deliveryLeg as any).startedAt && status !== 'delivered' && status !== 'failed');
}

/** Check whether pickup is actively in progress */
export function isPickupTrackable(status: string | null | undefined) {
  const s = String(status || '').toLowerCase();
  if (/picked|dropped|failed|cancelled/.test(s)) return false;
  return /assigned|started|out_for_pickup|en_route/.test(s);
}

/** Check whether delivery is actively in transit */
export function isDeliveryTrackable(status: string | null | undefined) {
  return /out_for_delivery|out for delivery/.test(String(status || '').toLowerCase());
}

/** A courier request currently in motion on either leg. */
export function isRequestTrackable(request: LogisticsRequestCard) {
  return isDeliveryTrackable(request.deliveryLeg?.status) || isPickupTrackable(request.pickupLeg?.status);
}

/** Collapse pickup + delivery leg statuses into one linear courier journey. */
export function deriveJourney(request: LogisticsRequestCard): Journey {
  return deriveJourneyFromStatuses(
    request.pickupLeg?.status ?? null,
    request.deliveryLeg?.status ?? null,
    Boolean(request.isCompleted) || request.status === 'completed',
  );
}

/**
 * Shared journey logic for courier door deliveries.
 */
export function deriveJourneyFromStatuses(
  pickup: string | null | undefined,
  delivery: string | null | undefined,
  completed = false,
): Journey {
  const isCompleted = completed || has(delivery, 'delivered');
  const failed = has(pickup, 'failed') || has(delivery, 'failed');
  const delayed = has(pickup, 'delayed') || has(delivery, 'delayed');
  const riderInMotion = has(delivery, 'out_for_delivery', 'out for');

  let stepIndex = 0;
  let percentProgress = 15;

  if (isCompleted || has(delivery, 'delivered')) {
    stepIndex = 3;
    percentProgress = 100;
  } else if (riderInMotion) {
    stepIndex = 2;
    percentProgress = 75;
  } else if (
    has(pickup, 'picked_up', 'dropped', 'hub')
    || has(delivery, 'courier', 'assigned')
  ) {
    stepIndex = 1;
    percentProgress = 45;
  } else {
    stepIndex = 0;
    percentProgress = 15;
  }

  let state: JourneyState = 'normal';
  if (failed) state = 'attention';
  else if (delayed) state = 'delayed';

  const isDelivered = stepIndex === 3 && state === 'normal';

  const label = journeyLabel(stepIndex, state);
  const detail = journeyDetail(stepIndex, state);

  return {
    stepIndex,
    steps: COURIER_JOURNEY_STEPS,
    state,
    label,
    detail,
    isDelivered,
    isRiderMoving: riderInMotion,
    percentProgress,
  };
}

function journeyLabel(stepIndex: number, state: JourneyState) {
  if (state === 'attention') return 'Needs attention';
  if (state === 'delayed') return 'Running late';
  return COURIER_JOURNEY_STEPS[stepIndex]?.label ?? 'Preparing';
}

function journeyDetail(stepIndex: number, state: JourneyState) {
  if (state === 'attention') return 'A pickup or delivery step could not be completed. Follow up with the courier.';
  if (state === 'delayed') return 'The package is taking longer than usual. It is still on track.';
  switch (stepIndex) {
    case 3: return 'Delivered to destination and checked against order.';
    case 2: return 'The rider is actively on the way to your delivery address.';
    case 1: return 'Mzigo Ego has collected the package and is arranging delivery.';
    default: return 'Seller is preparing your package for Mzigo courier pickup.';
  }
}

/**
 * Universal journey resolver supporting all fulfillment types:
 * - COURIER (door delivery)
 * - BUYER_TO_SELLER (pickup)
 * - DIGITAL (instant access)
 * - SERVICE (booking)
 */
export function deriveOrderJourney(order: ApiOrder): Journey {
  const fulfillmentType = String(order.fulfillment_type || '').toUpperCase();
  const isDigital = Boolean(order.isDigital || order.items?.some((i) => i.productType === 'digital' || i.isDigital));
  const isService = Boolean(order.items?.some((i) => i.productType === 'service'));
  const hasLogistics = Boolean(order.logistics?.deliveryLeg || order.logistics?.pickupLeg);

  if (isDigital) {
    const isReady = order.status === 'PAID' || order.status === 'COMPLETED' || order.status === 'READY_FOR_BUYER';
    return {
      stepIndex: isReady ? 1 : 0,
      steps: DIGITAL_JOURNEY_STEPS,
      state: 'normal',
      label: isReady ? 'Download Ready' : 'Payment Processing',
      detail: isReady ? 'Your digital purchase is ready for instant download.' : 'Verifying payment for your digital items.',
      isDelivered: isReady,
      percentProgress: isReady ? 100 : 50,
    };
  }

  if (isService) {
    const isCompleted = order.status === 'COMPLETED';
    const isFulfilling = order.status === 'FULFILLING' || order.status === 'PROCESSING';
    const stepIndex = isCompleted ? 2 : isFulfilling ? 1 : 0;
    return {
      stepIndex,
      steps: SERVICE_JOURNEY_STEPS,
      state: 'normal',
      label: isCompleted ? 'Completed' : isFulfilling ? 'In Progress' : 'Booking Confirmed',
      detail: isCompleted
        ? 'Service rendered and confirmed.'
        : isFulfilling
          ? 'Seller is currently providing the booked service.'
          : 'Service booking is confirmed and scheduled.',
      isDelivered: isCompleted,
      percentProgress: isCompleted ? 100 : isFulfilling ? 60 : 25,
    };
  }

  if (fulfillmentType === 'BUYER_TO_SELLER' || (!hasLogistics && fulfillmentType !== 'COURIER')) {
    const isCompleted = order.status === 'COMPLETED';
    const isReady = order.status === 'READY_FOR_BUYER' || order.status === 'COLLECTION_PENDING';
    const isFulfilling = order.status === 'FULFILLING' || order.status === 'PROCESSING';

    const stepIndex = isCompleted ? 3 : isReady ? 2 : isFulfilling ? 1 : 0;
    return {
      stepIndex,
      steps: PICKUP_JOURNEY_STEPS,
      state: 'normal',
      label: isCompleted
        ? 'Collected'
        : isReady
          ? 'Ready for Pickup'
          : isFulfilling
            ? 'Preparing Order'
            : 'Order Placed',
      detail: isCompleted
        ? 'Order collected from shop and confirmed.'
        : isReady
          ? 'Your order is ready for pickup at the seller\'s shop location.'
          : isFulfilling
            ? 'Seller is preparing your items for collection.'
            : 'Payment confirmed. Waiting for seller to begin preparation.',
      isDelivered: isCompleted,
      percentProgress: isCompleted ? 100 : isReady ? 75 : isFulfilling ? 40 : 15,
    };
  }

  // Default to Courier Journey
  const pickupLeg = order.logistics?.pickupLeg;
  const deliveryLeg = order.logistics?.deliveryLeg;
  const isOrderCompleted = order.status === 'COMPLETED';

  return deriveJourneyFromStatuses(
    pickupLeg?.status,
    deliveryLeg?.status,
    isOrderCompleted || order.logistics?.status === 'completed',
  );
}

export interface NextAction {
  legType: LogisticsLegType;
  status: LogisticsStatusUpdate;
  label: string;
}

/**
 * The single "next thing the courier does".
 */
export function courierActions(request: LogisticsRequestCard): {
  legType: LogisticsLegType;
  leg: LogisticsLeg;
  primary: NextAction | null;
  secondary: NextAction[];
} | null {
  const pickup = request.pickupLeg ?? null;
  const delivery = request.deliveryLeg ?? null;

  const pickupDone = has(pickup?.status, 'picked_up', 'dropped', 'hub');

  const chosen: { legType: LogisticsLegType; leg: LogisticsLeg } | null = (() => {
    if (pickup && !pickupDone) {
      const actions = PICKUP_ACTIONS[String(pickup.status || '').toLowerCase()] || [];
      if (actions.length) return { legType: 'pickup', leg: pickup };
    }
    if (delivery) {
      const actions = DELIVERY_ACTIONS[String(delivery.status || '').toLowerCase()] || [];
      if (actions.length) return { legType: 'delivery', leg: delivery };
    }
    if (pickup) {
      const actions = PICKUP_ACTIONS[String(pickup.status || '').toLowerCase()] || [];
      if (actions.length) return { legType: 'pickup', leg: pickup };
    }
    return null;
  })();

  if (!chosen) return null;

  const raw = chosen.legType === 'pickup'
    ? PICKUP_ACTIONS[String(chosen.leg.status || '').toLowerCase()] || []
    : DELIVERY_ACTIONS[String(chosen.leg.status || '').toLowerCase()] || [];

  const mapped: NextAction[] = raw.map((action) => ({
    legType: chosen.legType,
    status: action.status,
    label: action.label,
  }));

  const secondary = mapped.filter((action) => /fail|delay/i.test(action.label));
  const primary = mapped.find((action) => !/fail|delay/i.test(action.label)) || null;

  return { legType: chosen.legType, leg: chosen.leg, primary, secondary };
}

/** Route link to open in Google Maps */
export function routeLink(request: LogisticsRequestCard): { href: string; label: string } | null {
  const origin: LogisticsLocation | null =
    request.pickupLeg?.origin
    || request.sellerDropoff
    || (request.seller.mapLink ? { mapLink: request.seller.mapLink } : null);
  const destination = request.deliveryLeg?.destination || null;

  const originCoord = coord(origin);
  const destCoord = coord(destination);

  if (originCoord && destCoord) {
    return {
      href: `https://www.google.com/maps/dir/?api=1&origin=${originCoord}&destination=${destCoord}&travelmode=driving`,
      label: 'Open route',
    };
  }
  const single = destination?.mapLink || origin?.mapLink || request.seller.mapLink;
  if (single) return { href: single, label: destination ? 'Open delivery map' : 'Open pickup map' };
  return null;
}

function coord(location?: LogisticsLocation | { latitude?: number | null; longitude?: number | null } | null) {
  if (!location) return null;
  const lat = location.latitude;
  const lng = location.longitude;
  if (lat === null || lat === undefined || lng === null || lng === undefined) return null;
  const nLat = Number(lat);
  const nLng = Number(lng);
  if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) return null;
  return `${nLat},${nLng}`;
}
