import { describe, expect, it } from 'vitest';
import { createVerificationRequest, decideVerificationRequest, openVerificationRequest } from '../src/services/verificationRequestService';

describe('verification request bridge', () => {
  it('creates a NEW request that references one house case and exact evidence', () => {
    const request = createVerificationRequest({
      requestId: 'VR-TEST-1',
      houseCaseId: 'PROP-103',
      surveyorId: 'surveyor-1',
      surveyorName: 'K. Arjun',
      evidenceId: 'EV-TEST-1',
      submittedAt: '2026-09-25T12:00:00.000Z',
      geometryChanged: true,
      originalAreaSqM: 120,
      fieldAreaSqM: 134,
      summary: 'Field geometry corrected.'
    });

    expect(request.status).toBe('NEW');
    expect(request.houseCaseId).toBe('PROP-103');
    expect(request.evidenceId).toBe('EV-TEST-1');
    expect(request.geometryChanged).toBe(true);
    expect(request.fieldAiReanalysisPerformed).toBe(false);
  });

  it('tracks Supervisor opening and decision without changing the house reference', () => {
    const base = createVerificationRequest({
      requestId: 'VR-TEST-2',
      houseCaseId: 'PROP-104',
      surveyorId: 'surveyor-1',
      surveyorName: 'K. Arjun',
      evidenceId: 'EV-TEST-2',
      submittedAt: '2026-09-25T12:00:00.000Z',
      geometryChanged: false,
      fieldAiReanalysisPerformed: true,
      fieldAiReanalysisCompletedAt: '2026-09-25T11:59:00.000Z',
      originalAreaSqM: 100,
      fieldAreaSqM: 100,
      summary: 'Evidence only.'
    });
    const opened = openVerificationRequest(base, '2026-09-25T12:01:00.000Z');
    const decided = decideVerificationRequest(opened, 'REQUEST_CORRECTION', '2026-09-25T12:02:00.000Z');

    expect(opened.status).toBe('OPENED');
    expect(decided.status).toBe('CORRECTION_REQUESTED');
    expect(decided.houseCaseId).toBe('PROP-104');
    expect(decided.fieldAiReanalysisPerformed).toBe(true);
  });
});
