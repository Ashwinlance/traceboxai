import type { PolygonGeometry } from '../types/gis';
import { polygonAreaSqM, polygonCentroid } from './geometryEditService';

const EARTH_RADIUS_M = 6_371_000;

function distanceMeters(a: [number, number], b: [number, number]) {
  const lat1 = a[0] * Math.PI / 180;
  const lat2 = b[0] * Math.PI / 180;
  const dLat = (b[0] - a[0]) * Math.PI / 180;
  const dLng = (b[1] - a[1]) * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export interface GeometryChangeSummary {
  beforeAreaSqM: number;
  afterAreaSqM: number;
  areaDeltaSqM: number;
  areaDeltaPct: number;
  centroidShiftMeters: number;
  maxVertexShiftMeters: number;
  changedVertices: number;
  changed: boolean;
}

export function summarizeGeometryChange(before: PolygonGeometry, after: PolygonGeometry): GeometryChangeSummary {
  const beforeAreaSqM = polygonAreaSqM(before);
  const afterAreaSqM = polygonAreaSqM(after);
  const areaDeltaSqM = afterAreaSqM - beforeAreaSqM;
  const areaDeltaPct = beforeAreaSqM > 0 ? (areaDeltaSqM / beforeAreaSqM) * 100 : 0;
  const centroidShiftMeters = distanceMeters(polygonCentroid(before), polygonCentroid(after));
  const count = Math.min(before.coordinates.length, after.coordinates.length);
  let maxVertexShiftMeters = 0;
  let changedVertices = Math.abs(before.coordinates.length - after.coordinates.length);
  for (let i = 0; i < count; i += 1) {
    const shift = distanceMeters(before.coordinates[i], after.coordinates[i]);
    if (shift > maxVertexShiftMeters) maxVertexShiftMeters = shift;
    if (shift > 0.05) changedVertices += 1;
  }
  const changed = Math.abs(areaDeltaSqM) > 0.1 || centroidShiftMeters > 0.05 || maxVertexShiftMeters > 0.05 || before.coordinates.length !== after.coordinates.length;
  return {
    beforeAreaSqM,
    afterAreaSqM,
    areaDeltaSqM,
    areaDeltaPct,
    centroidShiftMeters,
    maxVertexShiftMeters,
    changedVertices,
    changed
  };
}
