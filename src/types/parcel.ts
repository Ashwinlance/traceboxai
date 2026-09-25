import type { PolygonGeometry } from './gis';

export type FeatureStatus = 'MATCH' | 'CONFLICT' | 'NOT_OBSERVABLE';
export type ConfidenceBand = 'LOW' | 'MEDIUM' | 'HIGH';
export type WorkflowStatus =
  | 'AI_DRAFT'
  | 'SURVEY_PENDING'
  | 'SURVEY_SUBMITTED'
  | 'SUPERVISOR_REVIEW'
  | 'APPROVED'
  | 'RECHECK_REQUIRED'
  | 'ESCALATED';

export interface FeatureResult {
  id: string;
  name: string;
  expected: string;
  detected: string;
  status: FeatureStatus;
  aiConfidence: number;
  note?: string;
}

export interface ConfidenceBreakdown {
  aiDetection: number;
  featureMatch: number;
  boundaryMatch: number;
  imageryQuality: number;
  recordConsistency: number;
  total: number;
  band: ConfidenceBand;
}

export interface ParcelRecord {
  id: string;
  ward: string;
  address: string;
  existingAreaSqM: number;
  detectedAreaSqM: number;
  referenceBoundary: PolygonGeometry;
  aiBoundary: PolygonGeometry;
  buildingFootprint: PolygonGeometry;
  features: FeatureResult[];
  confidence: ConfidenceBreakdown;
  workflowStatus: WorkflowStatus;
  routingReason: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  surveyorId?: string;
  approvedBoundary?: PolygonGeometry;
  approvedFootprint?: PolygonGeometry;
  /** Latest Surveyor-submitted field footprint. Kept separate from the immutable AI footprint. */
  fieldFootprint?: PolygonGeometry;
  /** Field evidence id that produced fieldFootprint. */
  fieldEvidenceId?: string;
  /** Timestamp of the latest Surveyor handoff. */
  fieldSubmittedAt?: string;
  /** Persisted completion marker for the latest field AI re-analysis. */
  fieldAnalysisCompletedAt?: string;
}
