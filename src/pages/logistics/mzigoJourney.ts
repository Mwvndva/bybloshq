import type { LogisticsLeg, LogisticsLegType, LogisticsRequestCard, LogisticsStatusUpdate } from '@/api/logistics';
import { DELIVERY_ACTIONS, PICKUP_ACTIONS } from './mzigoDashboard.constants';

// The backend tracks a package as two separate legs (pickup + delivery), each
// with its own status machine. For a human that is one journey. This file
// collapses both legs into a single linear story everyone can read at a glance:
//
//   Preparing  →  Picked up  →  On the way  →  Delivered
//
// with two overlays that can happen at any point: "Delayed" and "Needs attention".

export type JourneyState = 'normal' | 'delayed' | 'attention';

export interface JourneyStep {
  key: string;
  label: string;
}

export const JOURNEY_STEPS: JourneyStep[] = [
  { key: 'preparing', label: 'Preparing' },
  { key: 'picked_up', label: 'Picked up' },
  { key: 'on_the_way', label: 'On the way' },
  { key: 'delivered', label: 'Delivered' },
];

export interface Journey {
  /** 0-based index into JOURNEY_STEPS for the step the package is currently on. */
  stepIndex: number;
  state: JourneyState;
  /** Plain-language headline for the current situation. */
  label: string;
  /** One line of reassuring context under the headline. */
  detail: string;
  isDelivered: boolean;
}

function has(status: string | null | undefined, ...needles: string[]) {
  const value = String(status || '').toLowerCase();
  return needles.some((needle) => value.includes(needle));
}

// Mirrors the server (logisticsLiveLocation.service.js): which leg statuses mean
// the courier is actively in motion and worth live-tracking. Kept in sync so the
// courier only broadcasts, and buyers/sellers only poll, when it's useful.
export function isPickupTrackable(status: string | null | undefined) {
  const s = String(status || '').toLowerCase();
  if (/picked|dropped|failed|cancelled/.test(s)) return false;
  return /assigned|started|out_for_pickup|en_route/.test(s);
}

export function isDeliveryTrackable(status: string | null | undefined) {
  return /out_for_delivery|out for delivery/.test(String(status || '').toLowerCase());
}

/** A courier request currently in motion on either leg. */
export function isRequestTrackable(request: LogisticsRequestCard) {
  return isDeliveryTrackable(request.deliveryLeg?.status) || isPickupTrackable(request.pickupLeg?.status);
}

/** Collapse pickup + delivery leg statuses into one linear journey. */
export function deriveJourney(request: LogisticsRequestCard): Journey {
  return deriveJourneyFromStatuses(
    request.pickupLeg?.status ?? null,
    request.deliveryLeg?.status ?? null,
    Boolean(request.isCompleted) || request.status === 'completed',
  );
}

/**
 * Shared journey logic keyed only on the two leg statuses, so both the courier
 * dashboard (LogisticsRequestCard) and the buyer/seller order view (ApiOrder,
 * a different leg shape) can render the same story.
 */
export function deriveJourneyFromStatuses(
  pickup: string | null | undefined,
  delivery: string | null | undefined,
  completed = false,
): Journey {
  const isCompleted = completed || has(delivery, 'delivered');
  const failed = has(pickup, 'failed') || has(delivery, 'failed');
  const delayed = has(pickup, 'delayed') || has(delivery, 'delayed');

  let stepIndex = 0;
  if (isCompleted || has(delivery, 'delivered')) {
    stepIndex = 3;
  } else if (has(delivery, 'out_for_delivery', 'out for')) {
    stepIndex = 2;
  } else if (
    has(pickup, 'picked_up', 'dropped', 'hub')
    || has(delivery, 'courier', 'assigned')
  ) {
    stepIndex = 1;
  } else {
    stepIndex = 0;
  }

  let state: JourneyState = 'normal';
  if (failed) state = 'attention';
  else if (delayed) state = 'delayed';

  const isDelivered = stepIndex === 3 && state === 'normal';

  const label = journeyLabel(stepIndex, state);
  const detail = journeyDetail(stepIndex, state);

  return { stepIndex, state, label, detail, isDelivered };
}

function journeyLabel(stepIndex: number, state: JourneyState) {
  if (state === 'attention') return 'Needs attention';
  if (state === 'delayed') return 'Running late';
  return JOURNEY_STEPS[stepIndex]?.label ?? 'Preparing';
}

function journeyDetail(stepIndex: number, state: JourneyState) {
  if (state === 'attention') return 'A pickup or delivery step could not be completed. Follow up with the courier.';
  if (state === 'delayed') return 'The package is taking longer than the 24 hour window. It is still on track.';
  switch (stepIndex) {
    case 3: return 'Delivered and checked against the order.';
    case 2: return 'The courier is on the way to the buyer.';
    case 1: return 'Mzigo Ego has the package and is arranging delivery.';
    default: return 'Waiting for the seller handover before pickup.';
  }
}

export interface NextAction {
  legType: LogisticsLegType;
  status: LogisticsStatusUpdate;
  label: string;
}

/**
 * The single "next thing the courier does". Pickup is finished once the package
 * is picked up / dropped at the hub, after which the delivery leg drives the
 * action. Returns the forward action first, then any issue actions (fail/delay).
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

  // Forward actions read as progress; "Mark failed"/"Mark delayed" are issue
  // actions we push behind. The forward action is always first in the maps.
  const secondary = mapped.filter((action) => /fail|delay/i.test(action.label));
  const primary = mapped.find((action) => !/fail|delay/i.test(action.label)) || null;

  return { legType: chosen.legType, leg: chosen.leg, primary, secondary };
}

/** Best single map link for the package's route: seller pickup → buyer delivery. */
export function routeLink(request: LogisticsRequestCard): { href: string; label: string } | null {
  const origin = request.pickupLeg?.origin
    || request.sellerDropoff
    || (request.seller.mapLink ? { mapLink: request.seller.mapLink } as { mapLink?: string | null } : null);
  const destination = request.deliveryLeg?.destination || null;

  const originCoord = coord(origin);
  const destCoord = coord(destination);

  if (originCoord && destCoord) {
    return {
      href: `https://www.google.com/maps/dir/?api=1&origin=${originCoord}&destination=${destCoord}&travelmode=driving`,
      label: 'Open route',
    };
  }
  // Fall back to whichever single pin we have.
  const single = destination?.mapLink || request.pickupLeg?.origin?.mapLink || request.sellerDropoff?.mapLink || request.seller.mapLink;
  if (single) return { href: single, label: destination ? 'Open delivery map' : 'Open pickup map' };
  return null;
}

function coord(location?: { latitude?: number | null; longitude?: number | null } | null) {
  if (!location) return null;
  const lat = location.latitude;
  const lng = location.longitude;
  if (lat === null || lat === undefined || lng === null || lng === undefined) return null;
  const nLat = Number(lat);
  const nLng = Number(lng);
  if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) return null;
  return `${nLat},${nLng}`;
}
