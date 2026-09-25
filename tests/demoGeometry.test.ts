import { describe, expect, it } from 'vitest';
import { demoParcels } from '../src/data/demoData';
import { approximateBoundaryIoU } from '../src/services/comparisonEngine';
import type { PolygonGeometry } from '../src/types/gis';

const METERS_PER_DEGREE_LAT = 111_320;

function approximateBBoxAreaSqM(poly: PolygonGeometry): number {
  const lats = poly.coordinates.map(([lat]) => lat);
  const lngs = poly.coordinates.map(([, lng]) => lng);
  const meanLat = lats.reduce((sum, lat) => sum + lat, 0) / lats.length;
  const metersPerDegreeLng = METERS_PER_DEGREE_LAT * Math.cos(meanLat * Math.PI / 180);
  const heightM = (Math.max(...lats) - Math.min(...lats)) * METERS_PER_DEGREE_LAT;
  const widthM = (Math.max(...lngs) - Math.min(...lngs)) * metersPerDegreeLng;
  return widthM * heightM;
}

describe('demo GIS geometry scale', () => {
  it('keeps AI building footprints consistent with the displayed detected area', () => {
    for (const parcel of demoParcels) {
      const footprintArea = approximateBBoxAreaSqM(parcel.buildingFootprint);
      expect(footprintArea).toBeGreaterThan(parcel.detectedAreaSqM * 0.95);
      expect(footprintArea).toBeLessThan(parcel.detectedAreaSqM * 1.05);
    }
  });

  it('keeps PROP-103 around the intended 75% boundary IoU conflict', () => {
    const parcel = demoParcels.find((item) => item.id === 'PROP-103');
    expect(parcel).toBeDefined();
    const iou = approximateBoundaryIoU(parcel!.referenceBoundary, parcel!.aiBoundary);
    expect(iou).toBeGreaterThanOrEqual(73);
    expect(iou).toBeLessThanOrEqual(77);
  });
});
