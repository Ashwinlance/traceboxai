import type { ParcelRecord } from '../types/parcel';
import { decideRoute, type VerificationRoute } from './routingEngine';

export type HouseScreeningStatus = 'NO_MAJOR_ISSUE' | 'NEEDS_VERIFICATION' | 'MAJOR_CONFLICT' | 'COMPLEX_CASE';

export interface HouseScreeningResult {
  status: HouseScreeningStatus;
  label: string;
  issue: string;
  route: VerificationRoute;
}

export interface AreaRoutingSummary {
  total: number;
  directSupervisor: number;
  targetedVerify: number;
  deepVerify: number;
  noMajorIssue: number;
  needsVerification: number;
  majorConflict: number;
  complexCase: number;
}

function isComplex(parcel: ParcelRecord) {
  return parcel.features.some((feature) => {
    const text = `${feature.name} ${feature.detected}`.toLowerCase();
    return text.includes('parcel overlap') || text.includes('crosses 3') || text.includes('multi-parcel');
  });
}

function primaryIssue(parcel: ParcelRecord): string {
  const conflict = parcel.features.find((feature) => feature.status === 'CONFLICT');
  if (conflict) return `${conflict.name}: ${conflict.detected}`;
  const unobservable = parcel.features.find((feature) => feature.status === 'NOT_OBSERVABLE');
  if (unobservable) return `${unobservable.name}: ${unobservable.detected}`;
  return 'No major inconsistency detected in the configured screening checks.';
}

export function screenHouse(parcel: ParcelRecord): HouseScreeningResult {
  const decision = decideRoute(parcel);
  if (decision.route === 'DIRECT_SUPERVISOR') {
    return {
      status: 'NO_MAJOR_ISSUE',
      label: 'No major issue',
      issue: primaryIssue(parcel),
      route: decision.route
    };
  }
  if (decision.route === 'TARGETED_VERIFY') {
    return {
      status: 'NEEDS_VERIFICATION',
      label: 'Needs verification',
      issue: primaryIssue(parcel),
      route: decision.route
    };
  }
  if (isComplex(parcel)) {
    return {
      status: 'COMPLEX_CASE',
      label: 'Complex case',
      issue: primaryIssue(parcel),
      route: decision.route
    };
  }
  return {
    status: 'MAJOR_CONFLICT',
    label: 'Major conflict',
    issue: primaryIssue(parcel),
    route: decision.route
  };
}

export function routeAreaParcels(parcels: ParcelRecord[]): { parcels: ParcelRecord[]; summary: AreaRoutingSummary } {
  let directSupervisor = 0;
  let targetedVerify = 0;
  let deepVerify = 0;
  let noMajorIssue = 0;
  let needsVerification = 0;
  let majorConflict = 0;
  let complexCase = 0;

  const routed = parcels.map((parcel) => {
    const decision = decideRoute(parcel);
    const screening = screenHouse(parcel);
    if (decision.route === 'DIRECT_SUPERVISOR') directSupervisor += 1;
    if (decision.route === 'TARGETED_VERIFY') targetedVerify += 1;
    if (decision.route === 'DEEP_VERIFY') deepVerify += 1;
    if (screening.status === 'NO_MAJOR_ISSUE') noMajorIssue += 1;
    if (screening.status === 'NEEDS_VERIFICATION') needsVerification += 1;
    if (screening.status === 'MAJOR_CONFLICT') majorConflict += 1;
    if (screening.status === 'COMPLEX_CASE') complexCase += 1;

    return {
      ...parcel,
      workflowStatus: decision.status,
      routingReason: decision.reason,
      surveyorId: decision.requiresSurveyor ? (parcel.surveyorId ?? 'surveyor-1') : undefined,
      approvedBoundary: undefined,
      approvedFootprint: undefined,
      fieldFootprint: undefined,
      fieldEvidenceId: undefined,
      fieldSubmittedAt: undefined,
      fieldAnalysisCompletedAt: undefined
    };
  });

  return {
    parcels: routed,
    summary: {
      total: routed.length,
      directSupervisor,
      targetedVerify,
      deepVerify,
      noMajorIssue,
      needsVerification,
      majorConflict,
      complexCase
    }
  };
}
