import { describe, expect, it } from 'vitest';
import { confidenceBand, calculateConfidence } from '../src/services/confidenceEngine';

describe('confidenceEngine', () => {
  it('uses configured confidence bands', () => {
    expect(confidenceBand(39)).toBe('LOW');
    expect(confidenceBand(40)).toBe('MEDIUM');
    expect(confidenceBand(74)).toBe('MEDIUM');
    expect(confidenceBand(75)).toBe('HIGH');
  });

  it('creates weighted explainable scores', () => {
    const score = calculateConfidence({ aiDetectionPct: 92, featureMatchPct: 90, boundaryMatchPct: 92, imageryQualityPct: 90, recordConsistencyPct: 80 });
    expect(score.total).toBeGreaterThanOrEqual(85);
    expect(score.band).toBe('HIGH');
  });
});
