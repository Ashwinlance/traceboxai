import type { VerificationRequest, VerificationRequestStatus } from '../types/verificationRequest';

export interface VerificationRequestInput {
  requestId?: string;
  houseCaseId: string;
  surveyorId: string;
  surveyorName: string;
  evidenceId: string;
  submittedAt: string;
  geometryChanged: boolean;
  fieldAiReanalysisPerformed?: boolean;
  fieldAiReanalysisCompletedAt?: string;
  originalAreaSqM: number;
  fieldAreaSqM: number;
  summary: string;
}

export function createVerificationRequest(input: VerificationRequestInput): VerificationRequest {
  return {
    id: input.requestId ?? `VR-${Date.now()}`,
    houseCaseId: input.houseCaseId,
    surveyorId: input.surveyorId,
    surveyorName: input.surveyorName,
    evidenceId: input.evidenceId,
    submittedAt: input.submittedAt,
    status: 'NEW',
    geometryChanged: input.geometryChanged,
    fieldAiReanalysisPerformed: input.fieldAiReanalysisPerformed ?? false,
    fieldAiReanalysisCompletedAt: input.fieldAiReanalysisCompletedAt,
    originalAreaSqM: input.originalAreaSqM,
    fieldAreaSqM: input.fieldAreaSqM,
    summary: input.summary
  };
}

export function openVerificationRequest(request: VerificationRequest, at = new Date().toISOString()): VerificationRequest {
  if (request.status !== 'NEW') return request;
  return { ...request, status: 'OPENED', openedAt: at };
}

export function decideVerificationRequest(
  request: VerificationRequest,
  decision: 'APPROVE' | 'REQUEST_CORRECTION' | 'ESCALATE',
  at = new Date().toISOString()
): VerificationRequest {
  const status: VerificationRequestStatus = decision === 'APPROVE'
    ? 'APPROVED'
    : decision === 'REQUEST_CORRECTION'
      ? 'CORRECTION_REQUESTED'
      : 'ESCALATED';
  return { ...request, status, decidedAt: at };
}
