import { describe, expect, it } from 'vitest';
import { isLikelyHouseCandidate } from '../src/services/liveBuildingService';
import type { PolygonGeometry } from '../src/types/gis';

const house: PolygonGeometry = {
  coordinates: [
    [13.04180, 80.23660],
    [13.04180, 80.23670],
    [13.04170, 80.23670],
    [13.04170, 80.23660]
  ]
};

const sliver: PolygonGeometry = {
  coordinates: [
    [13.04180, 80.23660],
    [13.04180, 80.23720],
    [13.04178, 80.23720],
    [13.04178, 80.23660]
  ]
};

describe('live building house-candidate filter', () => {
  it('accepts a normal building footprint', () => {
    expect(isLikelyHouseCandidate(house, { building: 'house' })).toBe(true);
  });

  it('rejects road/highway geometry', () => {
    expect(isLikelyHouseCandidate(house, { building: 'yes', highway: 'residential' })).toBe(false);
  });

  it('rejects roof-only and shed structures', () => {
    expect(isLikelyHouseCandidate(house, { building: 'roof' })).toBe(false);
    expect(isLikelyHouseCandidate(house, { building: 'shed' })).toBe(false);
  });

  it('rejects extreme sliver geometry', () => {
    expect(isLikelyHouseCandidate(sliver, { building: 'yes' })).toBe(false);
  });
});
