import { describe, expect, it } from 'vitest';
import {
  createOptionalBuyerLocation,
  hasPreciseLocation,
  normalizeCoordinates,
  toBuyerLocationPayload
} from './location';

describe('location helpers', () => {
  it('normalizes finite coordinates only', () => {
    expect(normalizeCoordinates({ lat: '-1.2921' as unknown, lng: '36.8219' as unknown })).toEqual({
      lat: -1.2921,
      lng: 36.8219
    });
    expect(normalizeCoordinates({ lat: Number.NaN, lng: 36.8219 })).toBeNull();
    expect(normalizeCoordinates(null)).toBeNull();
  });

  it('keeps typed addresses while marking missing coordinates as imprecise', () => {
    const location = createOptionalBuyerLocation('Kimathi Street', null);

    expect(location).toEqual({ address: 'Kimathi Street', lat: null, lng: null });
    expect(hasPreciseLocation(location)).toBe(false);
  });

  it('creates backend buyer location payloads only when address and coordinates exist', () => {
    expect(toBuyerLocationPayload('  Nairobi CBD  ', { lat: -1.286389, lng: 36.817223 })).toEqual({
      address: 'Nairobi CBD',
      lat: -1.286389,
      lng: 36.817223
    });
    expect(toBuyerLocationPayload('', { lat: -1.286389, lng: 36.817223 })).toBeNull();
    expect(toBuyerLocationPayload('Nairobi CBD', null)).toBeNull();
  });
});


