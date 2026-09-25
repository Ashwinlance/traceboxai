import { describe, expect, it } from 'vitest';
import { demoParcels } from '../src/data/demoData';
import { routeAreaParcels, screenHouse } from '../src/services/areaAnalysisService';

 describe('area-wide every-house AI screening', () => {
  it('maps every demo house before routing exceptions', () => {
    const result = routeAreaParcels(demoParcels);
    expect(demoParcels).toHaveLength(96);
    expect(new Set(demoParcels.map((p) => p.id)).size).toBe(96);
    expect(result.summary.total).toBe(96);
    expect(result.summary.directSupervisor + result.summary.targetedVerify + result.summary.deepVerify).toBe(96);
  });

  it('separates no-major-issue houses from the problem-house exception queue', () => {
    const result = routeAreaParcels(demoParcels);
    expect(result.summary.directSupervisor).toBe(80);
    expect(result.summary.targetedVerify).toBe(9);
    expect(result.summary.deepVerify).toBe(7);
    expect(result.summary.noMajorIssue).toBe(80);
    expect(result.summary.needsVerification).toBe(9);
    expect(result.summary.majorConflict).toBe(6);
    expect(result.summary.complexCase).toBe(1);
  });

  it('assigns surveyors only to houses that need field verification', () => {
    const result = routeAreaParcels(demoParcels);
    const surveyCases = result.parcels.filter((p) => p.surveyorId);
    const directCases = result.parcels.filter((p) => !p.surveyorId);
    expect(surveyCases).toHaveLength(16);
    expect(directCases).toHaveLength(80);
    expect(surveyCases.every((p) => screenHouse(p).status !== 'NO_MAJOR_ISSUE')).toBe(true);
  });

  it('keeps the complex overlap case in deep field verification rather than making a legal decision', () => {
    const prop105 = demoParcels.find((p) => p.id === 'PROP-105')!;
    const result = screenHouse(prop105);
    expect(result.status).toBe('COMPLEX_CASE');
    expect(result.route).toBe('DEEP_VERIFY');
  });
});
