import { describe, expect, it } from 'vitest';
import { demoParcels } from '../src/data/demoData';

 describe('every-house demo dataset', () => {
  it('gives every detected demo house a footprint, reference geometry and confidence result', () => {
    for (const house of demoParcels) {
      expect(house.buildingFootprint.coordinates.length).toBeGreaterThanOrEqual(4);
      expect(house.referenceBoundary.coordinates.length).toBeGreaterThanOrEqual(4);
      expect(house.aiBoundary.coordinates.length).toBeGreaterThanOrEqual(4);
      expect(house.detectedAreaSqM).toBeGreaterThan(0);
      expect(house.confidence.total).toBeGreaterThanOrEqual(0);
      expect(house.confidence.total).toBeLessThanOrEqual(100);
      expect(house.features.length).toBeGreaterThan(0);
    }
  });
});
