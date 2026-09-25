import { describe, expect, it } from 'vitest';
import { demoParcels } from '../src/data/demoData';
import { nudgePolygonMeters, polygonAreaSqM, scalePolygonAnisotropic, updatePolygonVertex } from '../src/services/geometryEditService';

describe('surveyor geometry correction', () => {
  const footprint = demoParcels.find((parcel) => parcel.id === 'PROP-103')!.buildingFootprint;

  it('keeps area stable when a footprint is nudged', () => {
    const before = polygonAreaSqM(footprint);
    const after = polygonAreaSqM(nudgePolygonMeters(footprint, 1, 0));
    expect(Math.abs(after - before)).toBeLessThan(0.1);
  });

  it('changes area when width is adjusted', () => {
    const before = polygonAreaSqM(footprint);
    const after = polygonAreaSqM(scalePolygonAnisotropic(footprint, 1.06, 1));
    expect(after).toBeGreaterThan(before);
  });
});

// Precision surveyor correction: changing one vertex must not move the other vertices.

describe('precision vertex editing', () => {
  it('updates only the selected polygon vertex', () => {
    const original = { coordinates: [[13,80],[13,80.001],[13.001,80.001],[13.001,80]] as [number, number][] };
    const updated = updatePolygonVertex(original, 1, [13.0002,80.0012]);
    expect(updated.coordinates[1]).toEqual([13.0002,80.0012]);
    expect(updated.coordinates[0]).toEqual(original.coordinates[0]);
    expect(updated.coordinates[2]).toEqual(original.coordinates[2]);
    expect(updated.coordinates[3]).toEqual(original.coordinates[3]);
  });
});
