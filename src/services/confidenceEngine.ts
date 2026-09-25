import type { ConfidenceBreakdown, ConfidenceBand, FeatureResult } from '../types/parcel';

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function confidenceBand(score: number): ConfidenceBand {
  if (score >= 75) return 'HIGH';
  if (score >= 40) return 'MEDIUM';
  return 'LOW';
}

export function calculateConfidence(input: {
  aiDetectionPct: number;
  featureMatchPct: number;
  boundaryMatchPct: number;
  imageryQualityPct: number;
  recordConsistencyPct: number;
}): ConfidenceBreakdown {
  const aiDetection = clamp(input.aiDetectionPct * 0.25);
  const featureMatch = clamp(input.featureMatchPct * 0.30);
  const boundaryMatch = clamp(input.boundaryMatchPct * 0.25);
  const imageryQuality = clamp(input.imageryQualityPct * 0.10);
  const recordConsistency = clamp(input.recordConsistencyPct * 0.10);
  const total = clamp(aiDetection + featureMatch + boundaryMatch + imageryQuality + recordConsistency);
  return { aiDetection, featureMatch, boundaryMatch, imageryQuality, recordConsistency, total, band: confidenceBand(total) };
}

export function featureMatchPercentage(features: FeatureResult[]): number {
  if (!features.length) return 0;
  const observable = features.filter((f) => f.status !== 'NOT_OBSERVABLE');
  if (!observable.length) return 0;
  return (observable.filter((f) => f.status === 'MATCH').length / observable.length) * 100;
}
