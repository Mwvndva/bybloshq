// Pure-logic unit tests for the live-ETA math (no DB, no Redis). Covers the
// traffic-velocity model, ETA-minutes computation, and the physical-progress
// ratio + clamping used by the live GPS tracking layer.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  URBAN_DETOUR_FACTOR,
  getTrafficVelocityKmPerHour,
  calculateEtaMinutes,
  calculatePhysicalProgress
} from '../src/domains/logistics/logisticsEtaMath.js';

const utc = (h, m = 0) => new Date(Date.UTC(2026, 0, 1, h, m));

describe('getTrafficVelocityKmPerHour (EAT = UTC+3 time-of-day model)', () => {
  test('morning peak (07:00–10:00 EAT) is congested', () => {
    assert.equal(getTrafficVelocityKmPerHour(utc(4, 30)), 16); // 07:30 EAT
  });
  test('evening peak (16:30–19:30 EAT) is congested', () => {
    assert.equal(getTrafficVelocityKmPerHour(utc(14)), 16); // 17:00 EAT
  });
  test('daytime (10:00–16:00 EAT) is standard flow', () => {
    assert.equal(getTrafficVelocityKmPerHour(utc(9)), 24); // 12:00 EAT
  });
  test('night/off-peak is free flow', () => {
    assert.equal(getTrafficVelocityKmPerHour(utc(20)), 32); // 23:00 EAT
  });
});

describe('calculateEtaMinutes', () => {
  test('applies the urban detour factor + a 3-minute delivery buffer', () => {
    // 2km * 1.28 = 2.56 road km; /24 km/h * 60 = 6.4 -> round 6; +3 buffer = 9
    assert.equal(calculateEtaMinutes(2, 24), 9);
  });
  test('never returns less than 1 minute', () => {
    assert.ok(calculateEtaMinutes(0, 24) >= 1);
  });
  test('floors velocity at 5 km/h so a bad reading cannot explode the ETA to Infinity', () => {
    const eta = calculateEtaMinutes(10, 0.0001);
    assert.ok(Number.isFinite(eta) && eta > 0);
  });
  test('treats negative/garbage distance as zero', () => {
    assert.equal(calculateEtaMinutes(-5, 24), 3); // 0 travel + 3 buffer
  });
});

describe('calculatePhysicalProgress', () => {
  test('is the travelled/total ratio', () => {
    assert.equal(calculatePhysicalProgress(4, 1), 0.75); // travelled 3 of 4
  });
  test('is clamped at 0.95 — 1.0 is reserved for delivered confirmation only', () => {
    assert.equal(calculatePhysicalProgress(4, 0), 0.95);
  });
  test('never goes negative when the rider is farther than the total leg', () => {
    assert.equal(calculatePhysicalProgress(4, 10), 0);
  });
  test('rounds to two decimals', () => {
    assert.equal(calculatePhysicalProgress(3, 1), 0.67); // 2/3
  });
});

describe('constants', () => {
  test('URBAN_DETOUR_FACTOR is the documented 1.28', () => {
    assert.equal(URBAN_DETOUR_FACTOR, 1.28);
  });
});
