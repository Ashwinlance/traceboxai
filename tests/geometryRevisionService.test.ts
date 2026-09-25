import { describe, expect, it } from 'vitest';
import { demoParcels } from '../src/data/demoData';
import { nudgePolygonMeters, updatePolygonVertex } from '../src/services/geometryEditService';
import { summarizeGeometryChange } from '../src/services/geometryRevisionService';

describe('geometry revision trace', () => {
  const original = demoParcels.find((parcel) => parcel.id === 'PROP-103')!.buildingFootprint;

  it('detects a surveyor geometry change and reports shift metrics', () => {
    const shifted = nudgePolygonMeters(original, 1, 0);
    const summary = summarizeGeometryChange(original, shifted);
    expect(summary.changed).toBe(true);
    expect(summary.centroidShiftMeters).toBeGreaterThan(0.8);
    expect(summary.maxVertexShiftMeters).toBeGreaterThan(0.8);
    expect(Math.abs(summary.areaDeltaPct)).toBeLessThan(0.2);
  });

  it('detects a single edited vertex', () => {
    const [lat, lng] = original.coordinates[0];
    const edited = updatePolygonVertex(original, 0, [lat + 0.000005, lng]);
    const summary = summarizeGeometryChange(original, edited);
    expect(summary.changed).toBe(true);
    expect(summary.changedVertices).toBeGreaterThanOrEqual(1);
  });

  it('reports no change for identical geometry', () => {
    const summary = summarizeGeometryChange(original, original);
    expect(summary.changed).toBe(false);
    expect(summary.changedVertices).toBe(0);
  });
});
