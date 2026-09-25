import { describe, expect, it } from 'vitest';
import { approximateBoundaryIoU, classifyAreaDifference } from '../src/services/comparisonEngine';

describe('comparisonEngine', () => {
  it('returns near perfect IoU for matching boxes', () => {
    const a = { coordinates: [[1,1],[1,2],[0,2],[0,1]] as [number,number][] };
    const b = { coordinates: [[1,1],[1,2],[0,2],[0,1]] as [number,number][] };
    expect(approximateBoundaryIoU(a,b)).toBe(100);
  });

  it('flags material area differences as conflicts', () => {
    expect(classifyAreaDifference(120,165).status).toBe('CONFLICT');
    expect(classifyAreaDifference(120,124).status).toBe('MATCH');
  });
});
