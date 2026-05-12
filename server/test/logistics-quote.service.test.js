import test from 'node:test';
import assert from 'node:assert/strict';
import LogisticsQuoteService from '../src/services/logisticsQuote.service.js';

const testHub = {
  label: 'Test CBD Hub',
  address: 'CBD',
  latitude: 0,
  longitude: 0
};

test('buyer door delivery fee is ceil distance from hub to buyer times KSh 40', () => {
  const quote = LogisticsQuoteService.quoteBuyerDoorDelivery(
    {
      address: 'Buyer delivery point',
      latitude: 0,
      longitude: 0.01
    },
    {
      hub: testHub,
      rateKesPerKm: 40
    }
  );

  assert.equal(quote.legType, 'delivery');
  assert.equal(quote.payer, 'buyer');
  assert.equal(quote.currency, 'KES');
  assert.equal(quote.rateKesPerKm, 40);
  assert.equal(quote.chargeableDistanceKm, Math.ceil(quote.distanceKm));
  assert.equal(quote.feeAmount, quote.chargeableDistanceKm * 40);
  assert.equal(quote.feeAmount, 80);
});

test('seller pickup fee is ceil distance from hub to seller pickup point times KSh 40', () => {
  const quote = LogisticsQuoteService.quoteSellerPickup(
    {
      address: 'Seller pickup point',
      latitude: 0.01,
      longitude: 0
    },
    {
      hub: testHub,
      rateKesPerKm: 40
    }
  );

  assert.equal(quote.legType, 'pickup');
  assert.equal(quote.payer, 'seller');
  assert.equal(quote.currency, 'KES');
  assert.equal(quote.chargeableDistanceKm, Math.ceil(quote.distanceKm));
  assert.equal(quote.feeAmount, quote.chargeableDistanceKm * 40);
  assert.equal(quote.feeAmount, 80);
});

test('zero distance has zero fee because backend applies the exact ceil distance rule', () => {
  const quote = LogisticsQuoteService.quoteBuyerDoorDelivery(
    {
      address: 'At hub',
      latitude: 0,
      longitude: 0
    },
    {
      hub: testHub,
      rateKesPerKm: 40
    }
  );

  assert.equal(quote.distanceKm, 0);
  assert.equal(quote.chargeableDistanceKm, 0);
  assert.equal(quote.feeAmount, 0);
});

test('quote service rejects invalid coordinates before calculating a fee', () => {
  assert.throws(
    () => LogisticsQuoteService.quoteBuyerDoorDelivery(
      {
        latitude: 91,
        longitude: 0
      },
      {
        hub: testHub,
        rateKesPerKm: 40
      }
    ),
    /buyerLocation\.latitude must be between -90 and 90/
  );

  assert.throws(
    () => LogisticsQuoteService.quoteSellerPickup(
      {
        latitude: 0,
        longitude: 181
      },
      {
        hub: testHub,
        rateKesPerKm: 40
      }
    ),
    /sellerPickupLocation\.longitude must be between -180 and 180/
  );
});

test('configured environment values can override hub and door delivery rate without frontend fee input', () => {
  const env = {
    LOGISTICS_HUB_LABEL: 'Configured Hub',
    LOGISTICS_HUB_ADDRESS: 'Configured Address',
    LOGISTICS_HUB_LATITUDE: '0',
    LOGISTICS_HUB_LONGITUDE: '0',
    LOGISTICS_RATE_KES_PER_KM: '50',
    DOOR_DELIVERY_RATE_KES_PER_KM: '65'
  };

  const quote = LogisticsQuoteService.quoteBuyerDoorDelivery(
    {
      latitude: 0,
      longitude: 0.01
    },
    {
      env
    }
  );

  assert.equal(quote.origin.label, 'Configured Hub');
  assert.equal(quote.origin.address, 'Configured Address');
  assert.equal(quote.rateKesPerKm, 65);
  assert.equal(quote.feeAmount, quote.chargeableDistanceKm * 65);
});

test('seller pickup keeps using the general logistics rate when door delivery has its own rate', () => {
  const quote = LogisticsQuoteService.quoteSellerPickup(
    {
      latitude: 0.01,
      longitude: 0
    },
    {
      env: {
        LOGISTICS_HUB_LATITUDE: '0',
        LOGISTICS_HUB_LONGITUDE: '0',
        LOGISTICS_RATE_KES_PER_KM: '50',
        DOOR_DELIVERY_RATE_KES_PER_KM: '65'
      }
    }
  );

  assert.equal(quote.rateKesPerKm, 50);
  assert.equal(quote.feeAmount, quote.chargeableDistanceKm * 50);
});
