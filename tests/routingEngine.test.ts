import { describe, expect, it } from 'vitest';
import { demoParcels } from '../src/data/demoData';
import { decideRoute, verificationRequirements } from '../src/services/routingEngine';

describe('confidence-routed workflow', () => {
  it('routes the very-high-confidence clean case directly to a supervisor', () => {
    const decision = decideRoute(demoParcels[0]);
    expect(decision.route).toBe('DIRECT_SUPERVISOR');
    expect(decision.status).toBe('SUPERVISOR_REVIEW');
    expect(decision.requiresSurveyor).toBe(false);
  });

  it('routes a not-observable medium-confidence case to targeted survey', () => {
    const p = demoParcels.find(p=>p.id==='PROP-102')!;
    expect(decideRoute(p).route).toBe('TARGETED_VERIFY');
  });

  it('routes a major footprint conflict to deep verification', () => {
    const p = demoParcels.find(p=>p.id==='PROP-103')!;
    const decision = decideRoute(p);
    expect(decision.route).toBe('DEEP_VERIFY');
    expect(decision.requiresSurveyor).toBe(true);
    expect(verificationRequirements(p).minPhotos).toBe(2);
  });

  it('does not let AI auto-escalate a complex overlap; surveyor verification comes first', () => {
    const p = demoParcels.find(p=>p.id==='PROP-105')!;
    const decision = decideRoute(p);
    expect(decision.route).toBe('DEEP_VERIFY');
    expect(decision.status).toBe('SURVEY_PENDING');
  });
});

it('allows a supervisor to send an AI-direct house to practical field recheck', () => {
  const direct = { ...demoParcels[0], workflowStatus: 'RECHECK_REQUIRED' as const };
  const requirements = verificationRequirements(direct);
  expect(requirements.maxDistanceMeters).toBeGreaterThan(0);
  expect(requirements.minPhotos).toBeGreaterThanOrEqual(1);
});
