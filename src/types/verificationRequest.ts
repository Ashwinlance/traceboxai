export type VerificationRequestStatus = 'NEW' | 'OPENED' | 'APPROVED' | 'CORRECTION_REQUESTED' | 'ESCALATED';

export interface VerificationRequest {
  id: string;
  houseCaseId: string;
  surveyorId: string;
  surveyorName: string;
  evidenceId: string;
  submittedAt: string;
  status: VerificationRequestStatus;
  geometryChanged: boolean;
  fieldAiReanalysisPerformed: boolean;
  fieldAiReanalysisCompletedAt?: string;
  originalAreaSqM: number;
  fieldAreaSqM: number;
  summary: string;
  openedAt?: string;
  decidedAt?: string;
}
