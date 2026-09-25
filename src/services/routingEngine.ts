import type { ParcelRecord, WorkflowStatus } from '../types/parcel';

export type VerificationRoute = 'DIRECT_SUPERVISOR' | 'TARGETED_VERIFY' | 'DEEP_VERIFY';

export interface RoutingDecision {
  status: WorkflowStatus;
  route: VerificationRoute;
  reason: string;
  requiresSurveyor: boolean;
}

export const DIRECT_SUPERVISOR_MIN_CONFIDENCE = 90;
export const DEEP_VERIFY_MAX_CONFIDENCE = 49;

function hasMajorConflict(parcel: ParcelRecord): boolean {
  return parcel.features.some((feature) => {
    if (feature.status !== 'CONFLICT') return false;
    const name = feature.name.toLowerCase();
    return (
      name.includes('boundary') ||
      name.includes('building area') ||
      name.includes('footprint') ||
      name.includes('parcel overlap') ||
      name.includes('record')
    );
  });
}

/**
 * Confidence controls how much field verification is required.
 * AI never finalizes a cadastral/legal record. Very-high-confidence cases
 * bypass field survey and move directly to a supervisor decision.
 */
export function decideRoute(parcel: ParcelRecord): RoutingDecision {
  const hasConflict = parcel.features.some((f) => f.status === 'CONFLICT');
  const hasUnobservable = parcel.features.some((f) => f.status === 'NOT_OBSERVABLE');
  const majorConflict = hasMajorConflict(parcel);

  if (
    parcel.confidence.total >= DIRECT_SUPERVISOR_MIN_CONFIDENCE &&
    !hasConflict &&
    !hasUnobservable
  ) {
    return {
      status: 'SUPERVISOR_REVIEW',
      route: 'DIRECT_SUPERVISOR',
      reason: 'Very-high-confidence AI draft with no conflicts is ready for direct supervisor review.',
      requiresSurveyor: false
    };
  }

  if (
    parcel.confidence.total <= DEEP_VERIFY_MAX_CONFIDENCE ||
    majorConflict
  ) {
    return {
      status: 'SURVEY_PENDING',
      route: 'DEEP_VERIFY',
      reason: 'Low confidence or a material geometry/record conflict requires detailed field verification before supervisor review.',
      requiresSurveyor: true
    };
  }

  return {
    status: 'SURVEY_PENDING',
    route: 'TARGETED_VERIFY',
    reason: hasUnobservable
      ? 'Unobservable or uncertain evidence requires targeted field verification before supervisor review.'
      : 'Confidence is below the direct-review threshold, so targeted field verification is required.',
    requiresSurveyor: true
  };
}

export function verificationRequirements(parcel: ParcelRecord) {
  const route = decideRoute(parcel).route;
  // A supervisor can always override an AI-direct case and request field verification.
  // In that case use a practical targeted-verification requirement instead of the
  // zero-distance/no-evidence direct-review rule.
  if (parcel.workflowStatus === 'RECHECK_REQUIRED' && route === 'DIRECT_SUPERVISOR') {
    return {
      minPhotos: 1,
      maxDistanceMeters: 35,
      requiresRemarks: true,
      requiresBoundaryReview: false,
      label: 'Supervisor-requested verification'
    } as const;
  }
  if (route === 'DEEP_VERIFY') {
    return {
      minPhotos: 2,
      maxDistanceMeters: 25,
      requiresRemarks: true,
      requiresBoundaryReview: true,
      label: 'Deep verification'
    } as const;
  }
  if (route === 'TARGETED_VERIFY') {
    return {
      minPhotos: 1,
      maxDistanceMeters: 35,
      requiresRemarks: true,
      requiresBoundaryReview: false,
      label: 'Targeted verification'
    } as const;
  }
  return {
    minPhotos: 0,
    maxDistanceMeters: 0,
    requiresRemarks: false,
    requiresBoundaryReview: false,
    label: 'Direct supervisor review'
  } as const;
}
