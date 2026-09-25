import type { PolygonGeometry } from './gis';

export interface FieldEvidence {
  id: string;
  parcelId: string;
  surveyorId: string;
  reachedAssignedArea: boolean;
  distanceMeters: number;
  durationMinutes: number;
  photoNames: string[];
  gpsTimestamp: string;
  remarks: string;
  correctedBoundary?: PolygonGeometry;
  correctedFootprint?: PolygonGeometry;
  submittedAt: string;
}

export type SupervisorDecision = 'APPROVE' | 'REQUEST_CORRECTION' | 'ESCALATE';

export interface SupervisorReview {
  id: string;
  parcelId: string;
  reviewerId: string;
  decision: SupervisorDecision;
  reason: string;
  category?: 'BOUNDARY_DISPUTE' | 'RECORD_MISMATCH' | 'MULTIPLE_OVERLAP' | 'MAJOR_FOOTPRINT_DIFF' | 'INSUFFICIENT_EVIDENCE';
  reviewedAt: string;
}
