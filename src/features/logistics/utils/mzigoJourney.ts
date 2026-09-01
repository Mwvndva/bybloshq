import type { LogisticsLeg, LogisticsLegType, LogisticsLocation, LogisticsRequestCard, LogisticsStatusUpdate } from '@/features/logistics/api';
import { DELIVERY_ACTIONS, PICKUP_ACTIONS } from '@/features/logistics/utils/mzigoDashboard.constants';
import type { ApiOrder, ApiOrderLogisticsDeliveryLeg } from '@/shared/types';

export type JourneyState = 'normal' | 'delayed' | 'attention';

export interface JourneyStep {
  key: string;
  label: string;
}

export const MZIGO_CBD_HUB = {
  name: 'Byblos CBD Hub (Mzigo Ego)',
  address: 'Shop SL 32, Dynamic Mall, Tom Mboya St, Nairobi',
  mapLink: 'https://www.google.com/maps/search/?api=1&query=Dynamic+Mall+Tom+Mboya+St+Nairobi',
};

export const DOOR_DELIVERY_JOURNEY_STEPS: JourneyStep[] = [
  { key: 'seller_handoff', label: 'Seller Handoff' },
  { key: 'hub_processing', label: 'Mzigo Hub' },
  { key: 'out_for_delivery', label: 'Out for Delivery' },
  { key: 'delivered', label: 'Delivered' },
];

export const HUB_COLLECTION_JOURNEY_STEPS: JourneyStep[] = [
  { key: 'seller_handoff', label: 'Seller Handoff' },
  { key: 'hub_processing', label: 'Mzigo Hub' },
  { key: 'ready_at_hub', label: 'Ready at Hub' },
  { key: 'collected', label: 'Collected' },
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

export const COURIER_JOURNEY_STEPS = DOOR_DELIVERY_JOURNEY_STEPS;
export const PICKUP_JOURNEY_STEPS = HUB_COLLECTION_JOURNEY_STEPS;
export const JOURNEY_STEPS: JourneyStep[] = DOOR_DELIVERY_JOURNEY_STEPS;

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
  activeLeg: 'seller_to_hub' | 'hub' | 'hub_to_buyer' | 'completed';
  activeEta?: string | null;
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
 * Shared journey logic for courier door deliveries (Seller -> Mzigo Hub -> Buyer).
 */
export function deriveJourneyFromStatuses(
  pickup: string | null | undefined,
  delivery: string | null | undefined,
  completed = false,
  pickupDeadline?: string | null,
  deliveryDeadline?: string | null,
): Journey {
  const isCompleted = completed || has(delivery, 'delivered');
  const failed = has(pickup, 'failed') || has(delivery, 'failed');
  const delayed = has(pickup, 'delayed') || has(delivery, 'delayed');
  const riderInMotion = has(delivery, 'out_for_delivery', 'out for');
  const atHub = has(pickup, 'picked_up', 'dropped', 'hub') || has(delivery, 'courier', 'assigned');

  let stepIndex = 0;
  let percentProgress = 15;
  let activeLeg: Journey['activeLeg'] = 'seller_to_hub';
  let activeEta = pickupDeadline || deliveryDeadline || null;

  if (isCompleted || has(delivery, 'delivered')) {
    stepIndex = 3;
    percentProgress = 100;
    activeLeg = 'completed';
    activeEta = deliveryDeadline || null;
  } else if (riderInMotion) {
    stepIndex = 2;
    percentProgress = 75;
    activeLeg = 'hub_to_buyer';
    activeEta = deliveryDeadline || null;
  } else if (atHub) {
    stepIndex = 1;
    percentProgress = 45;
    activeLeg = 'hub';
    activeEta = deliveryDeadline || null;
  } else {
    stepIndex = 0;
    percentProgress = 15;
    activeLeg = 'seller_to_hub';
    activeEta = pickupDeadline || deliveryDeadline || null;
  }

  let state: JourneyState = 'normal';
  if (failed) state = 'attention';
  else if (delayed) state = 'delayed';

  const isDelivered = stepIndex === 3 && state === 'normal';

  const label = journeyLabel(stepIndex, state);
  const detail = journeyDetail(stepIndex, state);

  return {
    stepIndex,
    steps: DOOR_DELIVERY_JOURNEY_STEPS,
    state,
    label,
    detail,
    isDelivered,
    isRiderMoving: riderInMotion,
    activeLeg,
    activeEta,
    percentProgress,
  };
}

function journeyLabel(stepIndex: number, state: JourneyState) {
  if (state === 'attention') return 'Needs attention';
  if (state === 'delayed') return 'Running late';
  return DOOR_DELIVERY_JOURNEY_STEPS[stepIndex]?.label ?? 'Seller Handoff';
}

function journeyDetail(stepIndex: number, state: JourneyState) {
  if (state === 'attention') return 'A pickup or delivery step could not be completed. Follow up with the courier.';
  if (state === 'delayed') return 'The package is taking longer than usual. It is still on track.';
  switch (stepIndex) {
    case 3: return 'Delivered to destination and checked against order.';
    case 2: return 'Rider has departed Mzigo CBD Hub and is en route to your delivery address.';
    case 1: return 'Package verified at Byblos CBD Hub (Shop SL 32, Dynamic Mall). Preparing for dispatch.';
    default: return 'Seller is preparing your package for handoff to Mzigo Ego Hub.';
  }
}

/**
 * Universal journey resolver supporting all fulfillment types:
 * - PHYSICAL (COURIER) Door Delivery: SELLER -> MZIGO HUB -> BUYER
 * - PHYSICAL (COURIER) Hub Pickup: SELLER -> MZIGO HUB -> BUYER AT HUB
 * - DIGITAL: Instant download
 * - SERVICE: Appointment at seller
 */
export function deriveOrderJourney(order: ApiOrder): Journey {
  const isDigital = Boolean(order.isDigital || order.items?.some((i) => i.productType === 'digital' || i.isDigital));
  const isService = Boolean(order.items?.some((i) => i.productType === 'service'));
  const deliveryLeg = order.logistics?.deliveryLeg;
  const pickupLeg = order.logistics?.pickupLeg;
  const hasDoorDelivery = Boolean(deliveryLeg || order.shippingAddress?.address);

  if (isDigital) {
    const isReady = order.status === 'PAID' || order.status === 'COMPLETED' || order.status === 'READY_FOR_BUYER';
    return {
      stepIndex: isReady ? 1 : 0,
      steps: DIGITAL_JOURNEY_STEPS,
      state: 'normal',
      label: isReady ? 'Download Ready' : 'Payment Processing',
      detail: isReady ? 'Your digital purchase is ready for instant download.' : 'Verifying payment for your digital items.',
      isDelivered: isReady,
      activeLeg: isReady ? 'completed' : 'hub',
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
      activeLeg: isCompleted ? 'completed' : 'hub',
      percentProgress: isCompleted ? 100 : isFulfilling ? 60 : 25,
    };
  }

  // Physical: Hub Collection (Buyer collects at Byblos CBD Hub)
  if (!hasDoorDelivery) {
    const isCompleted = order.status === 'COMPLETED';
    const isReady = order.status === 'READY_FOR_BUYER' || order.status === 'COLLECTION_PENDING';
    const isAtHub = has(pickupLeg?.status, 'picked_up', 'dropped', 'hub') || isReady;
    const stepIndex = isCompleted ? 3 : isReady ? 2 : isAtHub ? 1 : 0;

    return {
      stepIndex,
      steps: HUB_COLLECTION_JOURNEY_STEPS,
      state: 'normal',
      label: isCompleted
        ? 'Collected'
        : isReady
          ? 'Ready at Hub'
          : isAtHub
            ? 'Mzigo Hub'
            : 'Seller Handoff',
      detail: isCompleted
        ? 'Package collected at Byblos CBD Hub and confirmed.'
        : isReady
          ? 'Your order is ready for collection at Byblos CBD Hub (Shop SL 32, Dynamic Mall, Tom Mboya St).'
          : isAtHub
            ? 'Package received and verified at Byblos CBD Hub.'
            : 'Seller is preparing package for delivery to Byblos CBD Hub.',
      isDelivered: isCompleted,
      activeLeg: isCompleted ? 'completed' : isReady ? 'hub_to_buyer' : isAtHub ? 'hub' : 'seller_to_hub',
      activeEta: pickupLeg?.deadlineAt || order.logistics?.deadlineAt || null,
      percentProgress: isCompleted ? 100 : isReady ? 75 : isAtHub ? 45 : 15,
    };
  }

  // Physical: Door Delivery (Seller -> Mzigo Hub -> Buyer)
  const isOrderCompleted = order.status === 'COMPLETED';
  return deriveJourneyFromStatuses(
    pickupLeg?.status,
    deliveryLeg?.status,
    isOrderCompleted || order.logistics?.status === 'completed',
    pickupLeg?.deadlineAt,
    deliveryLeg?.deadlineAt,
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
