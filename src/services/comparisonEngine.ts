import type { PolygonGeometry } from '../types/gis';
import type { FeatureResult } from '../types/parcel';

function bbox(poly: PolygonGeometry) {
  const lats = poly.coordinates.map(([lat]) => lat);
  const lngs = poly.coordinates.map(([, lng]) => lng);
  return { minLat: Math.min(...lats), maxLat: Math.max(...lats), minLng: Math.min(...lngs), maxLng: Math.max(...lngs) };
}

export function approximateBoundaryIoU(a: PolygonGeometry, b: PolygonGeometry): number {
  const A = bbox(a); const B = bbox(b);
  const iMinLat = Math.max(A.minLat, B.minLat); const iMaxLat = Math.min(A.maxLat, B.maxLat);
  const iMinLng = Math.max(A.minLng, B.minLng); const iMaxLng = Math.min(A.maxLng, B.maxLng);
  const intersection = Math.max(0, iMaxLat - iMinLat) * Math.max(0, iMaxLng - iMinLng);
  const areaA = (A.maxLat - A.minLat) * (A.maxLng - A.minLng);
  const areaB = (B.maxLat - B.minLat) * (B.maxLng - B.minLng);
  const union = areaA + areaB - intersection;
  return union <= 0 ? 0 : Math.round((intersection / union) * 100);
}

export function classifyAreaDifference(existing: number, detected: number): FeatureResult {
  const deltaPct = Math.abs(detected - existing) / Math.max(existing, 1) * 100;
  return {
    id: 'building-area', name: 'Building area', expected: `${existing} sq.m`, detected: `${detected} sq.m`,
    status: deltaPct <= 8 ? 'MATCH' : 'CONFLICT',
    aiConfidence: Math.max(55, Math.round(96 - deltaPct / 2)),
    note: deltaPct <= 8 ? 'Within configured tolerance' : `Area differs by ${deltaPct.toFixed(1)}%`
  };
}
