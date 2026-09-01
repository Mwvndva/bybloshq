import { describe, expect, it } from 'vitest';
import {
  COURIER_JOURNEY_STEPS,
  DIGITAL_JOURNEY_STEPS,
  DOOR_DELIVERY_JOURNEY_STEPS,
  HUB_COLLECTION_JOURNEY_STEPS,
  PICKUP_JOURNEY_STEPS,
  SERVICE_JOURNEY_STEPS,
  deriveJourneyFromStatuses,
  deriveOrderJourney,
  isDeliveryTrackable,
  isPickupTrackable,
  isRiderMoving,
} from '@/features/logistics/utils/mzigoJourney';
import type { ApiOrder } from '@/shared/types';

describe('Mzigo ETA & Central Hub Fulfillment Journey System', () => {
  describe('1. Door Delivery Two-Leg Journey Progression (Seller -> Hub -> Buyer)', () => {
    it('initializes in Seller Handoff stage with Leg 1 active when order is paid', () => {
      const journey = deriveJourneyFromStatuses('pending', 'delivery_pending', false, '2026-09-02T10:00:00Z', '2026-09-02T18:00:00Z');
      expect(journey.stepIndex).toBe(0);
      expect(journey.label).toBe('Seller Handoff');
      expect(journey.steps).toEqual(DOOR_DELIVERY_JOURNEY_STEPS);
      expect(journey.activeLeg).toBe('seller_to_hub');
      expect(journey.activeEta).toBe('2026-09-02T10:00:00Z');
      expect(journey.isDelivered).toBe(false);
      expect(journey.isRiderMoving).toBe(false);
      expect(journey.percentProgress).toBe(15);
    });

    it('advances to Mzigo Hub stage when Leg 1 completes (package arrives at Hub)', () => {
      const journey = deriveJourneyFromStatuses('picked_up', 'assigned', false, '2026-09-02T10:00:00Z', '2026-09-02T18:00:00Z');
      expect(journey.stepIndex).toBe(1);
      expect(journey.label).toBe('Mzigo Hub');
      expect(journey.activeLeg).toBe('hub');
      expect(journey.activeEta).toBe('2026-09-02T18:00:00Z');
      expect(journey.isRiderMoving).toBe(false);
      expect(journey.percentProgress).toBe(45);
    });

    it('activates Out for Delivery with Leg 2 Rider Moving when second rider starts to buyer', () => {
      const journey = deriveJourneyFromStatuses('picked_up', 'out_for_delivery', false, null, '2026-09-02T18:00:00Z');
      expect(journey.stepIndex).toBe(2);
      expect(journey.label).toBe('Out for Delivery');
      expect(journey.activeLeg).toBe('hub_to_buyer');
      expect(journey.activeEta).toBe('2026-09-02T18:00:00Z');
      expect(journey.isRiderMoving).toBe(true);
      expect(journey.percentProgress).toBe(75);
    });

    it('marks Delivered when delivery leg reaches delivered status', () => {
      const journey = deriveJourneyFromStatuses('picked_up', 'delivered');
      expect(journey.stepIndex).toBe(3);
      expect(journey.label).toBe('Delivered');
      expect(journey.activeLeg).toBe('completed');
      expect(journey.isDelivered).toBe(true);
      expect(journey.percentProgress).toBe(100);
    });

    it('displays Running late when delayed overlay occurs without crashing countdown', () => {
      const journey = deriveJourneyFromStatuses('picked_up', 'delayed');
      expect(journey.state).toBe('delayed');
      expect(journey.label).toBe('Running late');
      expect(journey.detail).toContain('longer than usual');
    });

    it('displays Needs attention when leg fails', () => {
      const journey = deriveJourneyFromStatuses('failed', 'delivery_pending');
      expect(journey.state).toBe('attention');
      expect(journey.label).toBe('Needs attention');
    });
  });

  describe('2. Rider Starts Moving Trigger Verification', () => {
    it('returns false before rider moves', () => {
      expect(isRiderMoving({ status: 'assigned' } as any)).toBe(false);
      expect(isRiderMoving({ status: 'pending' } as any)).toBe(false);
      expect(isRiderMoving(null)).toBe(false);
    });

    it('returns true when rider starts moving (out_for_delivery or startedAt populated)', () => {
      expect(isRiderMoving({ status: 'out_for_delivery', startedAt: '2026-09-01T12:00:00Z' } as any)).toBe(true);
      expect(isRiderMoving({ status: 'out_for_delivery' } as any)).toBe(true);
    });

    it('returns false after delivery is completed', () => {
      expect(isRiderMoving({ status: 'delivered', startedAt: '2026-09-01T12:00:00Z' } as any)).toBe(false);
    });
  });

  describe('3. Central Hub Collection (Buyer Collects at Mzigo CBD Hub) Journey', () => {
    const baseHubOrder: ApiOrder = {
      id: 'ord-123',
      orderNumber: 'BYB-123',
      status: 'PAID',
      totalAmount: 1500,
      currency: 'KES',
      createdAt: '2026-09-01T10:00:00Z',
      updatedAt: '2026-09-01T10:00:00Z',
      paymentStatus: 'paid',
      fulfillment_type: 'COURIER',
      items: [{ id: '1', productId: 'p1', name: 'Hoodie', price: 1500, quantity: 1, imageUrl: '', productType: 'physical', subtotal: 1500 }],
      customer: { id: 'c1', name: 'Roy', email: 'roy@example.com' },
      seller: { id: 's1', name: 'Vintage Vault', shopName: 'Vintage Vault' },
      shippingAddress: { address: '', city: '', country: 'Kenya', postalCode: '' },
    };

    it('shows Seller Handoff for new paid hub pickup order', () => {
      const journey = deriveOrderJourney(baseHubOrder);
      expect(journey.stepIndex).toBe(0);
      expect(journey.label).toBe('Seller Handoff');
      expect(journey.steps).toEqual(HUB_COLLECTION_JOURNEY_STEPS);
    });

    it('shows Ready at Hub when package is ready for collection at Byblos CBD Hub', () => {
      const journey = deriveOrderJourney({ ...baseHubOrder, status: 'READY_FOR_BUYER' });
      expect(journey.stepIndex).toBe(2);
      expect(journey.label).toBe('Ready at Hub');
      expect(journey.detail).toContain('Byblos CBD Hub (Shop SL 32, Dynamic Mall, Tom Mboya St)');
    });

    it('shows Collected when buyer confirms pickup from Central Hub', () => {
      const journey = deriveOrderJourney({ ...baseHubOrder, status: 'COMPLETED' });
      expect(journey.stepIndex).toBe(3);
      expect(journey.label).toBe('Collected');
      expect(journey.isDelivered).toBe(true);
    });
  });

  describe('4. Digital Goods Journey', () => {
    const digitalOrder: ApiOrder = {
      id: 'ord-dig-1',
      orderNumber: 'BYB-DIG-1',
      status: 'PAID',
      totalAmount: 500,
      currency: 'KES',
      createdAt: '2026-09-01T10:00:00Z',
      updatedAt: '2026-09-01T10:00:00Z',
      paymentStatus: 'paid',
      isDigital: true,
      items: [{ id: '1', productId: 'd1', name: 'Design Pack', price: 500, quantity: 1, imageUrl: '', productType: 'digital', isDigital: true, subtotal: 500 }],
      customer: { id: 'c1', name: 'Roy', email: 'roy@example.com' },
      seller: { id: 's1', name: 'Creative Studio' },
      shippingAddress: { address: '', city: '', country: '', postalCode: '' },
    };

    it('immediately presents Download Ready upon payment', () => {
      const journey = deriveOrderJourney(digitalOrder);
      expect(journey.stepIndex).toBe(1);
      expect(journey.label).toBe('Download Ready');
      expect(journey.steps).toEqual(DIGITAL_JOURNEY_STEPS);
      expect(journey.isDelivered).toBe(true);
    });
  });

  describe('5. Service Booking Journey', () => {
    const serviceOrder: ApiOrder = {
      id: 'ord-srv-1',
      orderNumber: 'BYB-SRV-1',
      status: 'PAID',
      totalAmount: 2500,
      currency: 'KES',
      createdAt: '2026-09-01T10:00:00Z',
      updatedAt: '2026-09-01T10:00:00Z',
      paymentStatus: 'paid',
      fulfillment_type: 'SERVICE',
      items: [{ id: '1', productId: 's1', name: 'Photoshoot Session', price: 2500, quantity: 1, imageUrl: '', productType: 'service', subtotal: 2500 }],
      customer: { id: 'c1', name: 'Roy', email: 'roy@example.com' },
      seller: { id: 's1', name: 'Roy Visuals' },
      shippingAddress: { address: '', city: '', country: '', postalCode: '' },
    };

    it('shows Booking Confirmed upon payment', () => {
      const journey = deriveOrderJourney(serviceOrder);
      expect(journey.stepIndex).toBe(0);
      expect(journey.label).toBe('Booking Confirmed');
      expect(journey.steps).toEqual(SERVICE_JOURNEY_STEPS);
    });

    it('shows In Progress when service is being rendered', () => {
      const journey = deriveOrderJourney({ ...serviceOrder, status: 'FULFILLING' });
      expect(journey.stepIndex).toBe(1);
      expect(journey.label).toBe('In Progress');
    });

    it('shows Completed when service is delivered', () => {
      const journey = deriveOrderJourney({ ...serviceOrder, status: 'COMPLETED' });
      expect(journey.stepIndex).toBe(2);
      expect(journey.label).toBe('Completed');
      expect(journey.isDelivered).toBe(true);
    });
  });
});
