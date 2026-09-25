import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { demoParcels, users } from '../data/demoData';
import type { ParcelRecord } from '../types/parcel';
import type { GeometryRevision } from '../types/gis';
import type { UserRole } from '../types/user';
import type { FieldEvidence, SupervisorDecision } from '../types/surveyor';
import type { VerificationRequest } from '../types/verificationRequest';
import { makeAudit, type AuditEntry } from '../services/auditService';
import { routeAreaParcels, type AreaRoutingSummary } from '../services/areaAnalysisService';
import { fetchAlignedBuildingParcels } from '../services/liveBuildingService';
import { summarizeGeometryChange } from '../services/geometryRevisionService';
import { createVerificationRequest, decideVerificationRequest, openVerificationRequest as markVerificationRequestOpened } from '../services/verificationRequestService';

export type GeometryDataSource = 'SYNTHETIC_DEMO' | 'OSM_BUILDING_REFERENCE';

interface ParcelContextValue {
  role: UserRole;
  setRole: (role: UserRole) => void;
  activeUser: { id: string; name: string; role: UserRole };
  dataSource: GeometryDataSource;
  parcels: ParcelRecord[];
  selectedParcelId: string;
  selectParcel: (id: string) => void;
  selectedParcel: ParcelRecord;
  evidences: FieldEvidence[];
  revisions: GeometryRevision[];
  audits: AuditEntry[];
  areaAnalysisComplete: boolean;
  lastAreaSummary: AreaRoutingSummary | null;
  lastSubmittedParcelId: string | null;
  verificationRequests: VerificationRequest[];
  openVerificationRequest: (requestId: string) => void;
  processAreaAnalysis: () => Promise<AreaRoutingSummary>;
  alignToLiveBuildings: () => Promise<number>;
  recordFieldAnalysisComplete: (parcelId: string, completedAt?: string) => void;
  submitSurvey: (input: Omit<FieldEvidence, 'id' | 'submittedAt'>) => VerificationRequest;
  supervisorDecision: (parcelId: string, decision: SupervisorDecision, reason: string) => void;
  resetDemo: () => void;
}

const ParcelContext = createContext<ParcelContextValue | null>(null);

const WORKFLOW_STORAGE_KEY = 'sih26012-workflow-state-v7';
const LATEST_HANDOFF_KEY = 'sih26012-latest-surveyor-handoff-v3';

type PersistedWorkflowState = {
  dataSource: GeometryDataSource;
  parcels: ParcelRecord[];
  selectedParcelId: string;
  evidences: FieldEvidence[];
  revisions: GeometryRevision[];
  audits: AuditEntry[];
  areaAnalysisComplete: boolean;
  lastAreaSummary: AreaRoutingSummary | null;
  lastSubmittedParcelId: string | null;
  verificationRequests: VerificationRequest[];
};

function readPersistedWorkflow(): PersistedWorkflowState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(WORKFLOW_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedWorkflowState>;
    if (!Array.isArray(parsed.parcels) || !parsed.parcels.length) return null;
    return {
      dataSource: parsed.dataSource === 'OSM_BUILDING_REFERENCE' ? 'OSM_BUILDING_REFERENCE' : 'SYNTHETIC_DEMO',
      parcels: parsed.parcels as ParcelRecord[],
      selectedParcelId: typeof parsed.selectedParcelId === 'string' ? parsed.selectedParcelId : parsed.parcels[0].id,
      evidences: Array.isArray(parsed.evidences) ? parsed.evidences as FieldEvidence[] : [],
      revisions: Array.isArray(parsed.revisions) ? parsed.revisions as GeometryRevision[] : [],
      audits: Array.isArray(parsed.audits) ? parsed.audits as AuditEntry[] : [],
      areaAnalysisComplete: Boolean(parsed.areaAnalysisComplete),
      lastAreaSummary: parsed.lastAreaSummary ?? null,
      lastSubmittedParcelId: typeof parsed.lastSubmittedParcelId === 'string' ? parsed.lastSubmittedParcelId : null,
      verificationRequests: Array.isArray(parsed.verificationRequests) ? parsed.verificationRequests as VerificationRequest[] : []
    };
  } catch {
    return null;
  }
}

function freshDemoParcels(): ParcelRecord[] {
  return demoParcels.map((parcel) => ({
    ...parcel,
    workflowStatus: 'AI_DRAFT',
    routingReason: 'Waiting for area-wide AI screening.',
    surveyorId: undefined,
    approvedBoundary: undefined,
    approvedFootprint: undefined,
    fieldFootprint: undefined,
    fieldEvidenceId: undefined,
    fieldSubmittedAt: undefined,
    fieldAnalysisCompletedAt: undefined
  }));
}

export function ParcelProvider({ children }: { children: ReactNode }) {
  const persisted = useMemo(() => readPersistedWorkflow(), []);
  const [role, setRoleState] = useState<UserRole>(() => {
    if (typeof window === 'undefined') return 'ADMIN';
    const saved = window.localStorage.getItem('sih26012-demo-role');
    return saved === 'SURVEYOR' || saved === 'SUPERVISOR' || saved === 'ADMIN' ? saved : 'ADMIN';
  });
  const [dataSource, setDataSource] = useState<GeometryDataSource>(persisted?.dataSource ?? 'SYNTHETIC_DEMO');
  const [parcels, setParcels] = useState<ParcelRecord[]>(persisted?.parcels ?? freshDemoParcels());
  const [selectedParcelId, selectParcel] = useState(persisted?.selectedParcelId ?? 'PROP-103');
  const [evidences, setEvidences] = useState<FieldEvidence[]>(persisted?.evidences ?? []);
  const [revisions, setRevisions] = useState<GeometryRevision[]>(persisted?.revisions ?? []);
  const [audits, setAudits] = useState<AuditEntry[]>(persisted?.audits ?? []);
  const [areaAnalysisComplete, setAreaAnalysisComplete] = useState(persisted?.areaAnalysisComplete ?? false);
  const [lastAreaSummary, setLastAreaSummary] = useState<AreaRoutingSummary | null>(persisted?.lastAreaSummary ?? null);
  const [lastSubmittedParcelId, setLastSubmittedParcelId] = useState<string | null>(persisted?.lastSubmittedParcelId ?? null);
  const [verificationRequests, setVerificationRequests] = useState<VerificationRequest[]>(persisted?.verificationRequests ?? []);

  const activeUser = users.find((user) => user.role === role) ?? users[0];

  const setRole = (nextRole: UserRole) => {
    // Handoff selection must not depend only on React's async state. Read the synchronously
    // persisted handoff id as a fallback so an immediate Surveyor -> Supervisor switch always
    // opens the exact submitted house.
    if (nextRole === 'SUPERVISOR') {
      const newestPendingRequest = [...verificationRequests]
        .filter((request) => request.status === 'NEW' || request.status === 'OPENED')
        .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0];
      const storedHandoff = typeof window !== 'undefined' ? window.localStorage.getItem(LATEST_HANDOFF_KEY) : null;
      const preferred = newestPendingRequest?.houseCaseId ?? lastSubmittedParcelId ?? storedHandoff;
      if (preferred && parcels.some((parcel) => parcel.id === preferred && ['SUPERVISOR_REVIEW','ESCALATED'].includes(parcel.workflowStatus))) {
        selectParcel(preferred);
      }
    }
    setRoleState(nextRole);
  };

  useEffect(() => {
    if (typeof window !== 'undefined') window.localStorage.setItem('sih26012-demo-role', role);
  }, [role]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const state: PersistedWorkflowState = {
      dataSource, parcels, selectedParcelId, evidences, revisions, audits, areaAnalysisComplete, lastAreaSummary, lastSubmittedParcelId, verificationRequests
    };
    try {
      window.localStorage.setItem(WORKFLOW_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // The demo remains usable even if browser storage is unavailable or full.
    }
  }, [dataSource, parcels, selectedParcelId, evidences, revisions, audits, areaAnalysisComplete, lastAreaSummary, lastSubmittedParcelId, verificationRequests]);
  const selectedParcel = parcels.find((p) => p.id === selectedParcelId) ?? parcels[0];

  const processAreaAnalysis = async () => {
    // The normal Run Area Analysis path now uses live mapped building footprints first.
    // We intentionally do not silently classify the synthetic 96-house grid because it can
    // visually overlap roads/open space and look like an imagery detection result.
    let sourceParcels = parcels;
    let source: GeometryDataSource = dataSource;

    if (source === 'SYNTHETIC_DEMO') {
      sourceParcels = await fetchAlignedBuildingParcels(freshDemoParcels());
      source = 'OSM_BUILDING_REFERENCE';
    }

    const result = routeAreaParcels(sourceParcels);
    setParcels(result.parcels);
    setDataSource(source);
    setAreaAnalysisComplete(true);
    setLastAreaSummary(result.summary);
    const nowAudits = result.parcels.map((parcel) => {
      const direct = parcel.workflowStatus === 'SUPERVISOR_REVIEW';
      return makeAudit(
        parcel.id,
        'AI Engine',
        direct ? 'HOUSE_SCREENED_DIRECT_SUPERVISOR' : 'HOUSE_SCREENED_SURVEY_REQUIRED',
        parcel.routingReason
      );
    });
    setAudits(nowAudits);
    setEvidences([]);
    setRevisions([]);
    setLastSubmittedParcelId(null);
    setVerificationRequests([]);
    if (result.parcels[0]) selectParcel(result.parcels[0].id);
    return result.summary;
  };

  const alignToLiveBuildings = async () => {
    const aligned = await fetchAlignedBuildingParcels(freshDemoParcels());
    setParcels(aligned.map((parcel) => ({
      ...parcel,
      workflowStatus: 'AI_DRAFT',
      routingReason: 'Live building footprint loaded. Waiting for area-wide AI screening.',
      surveyorId: undefined,
      approvedBoundary: undefined,
      approvedFootprint: undefined,
      fieldFootprint: undefined,
      fieldEvidenceId: undefined,
      fieldSubmittedAt: undefined,
      fieldAnalysisCompletedAt: undefined
    })));
    setDataSource('OSM_BUILDING_REFERENCE');
    setAreaAnalysisComplete(false);
    setLastAreaSummary(null);
    setEvidences([]);
    setRevisions([]);
    setLastSubmittedParcelId(null);
    setVerificationRequests([]);
    setAudits([makeAudit('AREA','Admin','LIVE_BUILDING_REFERENCE_LOADED',`${aligned.length} live building footprints loaded for visual alignment.`)]);
    if (aligned[0]) selectParcel(aligned[0].id);
    return aligned.length;
  };

  const recordFieldAnalysisComplete = (parcelId: string, completedAt = new Date().toISOString()) => {
    setParcels((current) => current.map((parcel) => parcel.id === parcelId ? {
      ...parcel,
      fieldAnalysisCompletedAt: completedAt
    } : parcel));
    setAudits((current) => [
      makeAudit(parcelId, 'Surveyor', 'FIELD_AI_REANALYSIS_COMPLETED', `Field AI re-analysis completed at ${completedAt}.`),
      ...current
    ]);
  };

  const openVerificationRequest = (requestId: string) => {
    const request = verificationRequests.find((item) => item.id === requestId);
    if (!request) return;
    setVerificationRequests((current) => current.map((item) => item.id === requestId ? markVerificationRequestOpened(item) : item));
    selectParcel(request.houseCaseId);
    setAudits((current) => [
      makeAudit(request.houseCaseId, 'Supervisor', 'VERIFICATION_REQUEST_OPENED', `Supervisor opened ${request.id} from ${request.surveyorName}.`),
      ...current
    ]);
  };

  const submitSurvey = (input: Omit<FieldEvidence, 'id' | 'submittedAt'>): VerificationRequest => {
    const submittedAt = new Date().toISOString();
    // Deep-clone submitted geometry so later Surveyor editing cannot mutate the Supervisor handoff.
    const correctedFootprint = input.correctedFootprint
      ? { coordinates: input.correctedFootprint.coordinates.map(([lat, lng]) => [lat, lng] as [number, number]) }
      : undefined;
    const correctedBoundary = input.correctedBoundary
      ? { coordinates: input.correctedBoundary.coordinates.map(([lat, lng]) => [lat, lng] as [number, number]) }
      : undefined;
    const evidence: FieldEvidence = {
      ...input,
      correctedFootprint,
      correctedBoundary,
      id: `EV-${Date.now()}`,
      submittedAt
    };
    const original = parcels.find((p) => p.id === input.parcelId);
    const surveyorName = users.find((user) => user.id === input.surveyorId)?.name ?? input.surveyorId;
    const geometryChanged = Boolean(correctedFootprint);
    const change = original && correctedFootprint ? summarizeGeometryChange(original.buildingFootprint, correctedFootprint) : null;
    const request = createVerificationRequest({
      houseCaseId: input.parcelId,
      surveyorId: input.surveyorId,
      surveyorName,
      evidenceId: evidence.id,
      submittedAt,
      geometryChanged,
      fieldAiReanalysisPerformed: Boolean(original?.fieldAnalysisCompletedAt),
      fieldAiReanalysisCompletedAt: original?.fieldAnalysisCompletedAt,
      originalAreaSqM: change?.beforeAreaSqM ?? original?.detectedAreaSqM ?? 0,
      fieldAreaSqM: change?.afterAreaSqM ?? original?.detectedAreaSqM ?? 0,
      summary: geometryChanged
        ? `Surveyor corrected the building footprint and submitted field evidence for ${input.parcelId}.`
        : `Surveyor submitted field verification evidence for ${input.parcelId} with no geometry change.`
    });

    // Persist the handoff id immediately (before React state batching) so the Supervisor role
    // can always open the exact house that was just submitted.
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LATEST_HANDOFF_KEY, input.parcelId);
    }

    setEvidences((current) => [evidence, ...current.filter((item) => item.parcelId !== input.parcelId)]);
    setVerificationRequests((current) => [request, ...current]);
    if (original && correctedFootprint) {
      const revision: GeometryRevision = {
        id: `REV-${Date.now()}`,
        parcelId: input.parcelId,
        before: {
          coordinates: original.buildingFootprint.coordinates.map(([lat, lng]) => [lat, lng] as [number, number])
        },
        after: correctedFootprint,
        changedBy: input.surveyorId,
        reason: input.remarks || 'Surveyor aligned the building footprint to field-visible evidence.',
        createdAt: submittedAt
      };
      setRevisions((current) => [revision, ...current.filter((item) => item.parcelId !== input.parcelId)]);
      const change = summarizeGeometryChange(revision.before, revision.after);
      setAudits((current) => [
        makeAudit(
          input.parcelId,
          'Surveyor',
          'FOOTPRINT_CORRECTION_SUBMITTED',
          `AI ${Math.round(change.beforeAreaSqM)} m² → field ${Math.round(change.afterAreaSqM)} m² (${change.areaDeltaPct >= 0 ? '+' : ''}${change.areaDeltaPct.toFixed(1)}%). Max vertex shift ${change.maxVertexShiftMeters.toFixed(1)} m.`
        ),
        makeAudit(input.parcelId,'Surveyor','FIELD_VERIFICATION_SUBMITTED', input.remarks || 'Evidence submitted.'),
        ...current
      ]);
    } else {
      setRevisions((current) => current.filter((item) => item.parcelId !== input.parcelId));
      setAudits((current) => [makeAudit(input.parcelId,'Surveyor','FIELD_VERIFICATION_SUBMITTED', input.remarks || 'Evidence submitted with no footprint correction.'), ...current]);
    }

    setParcels((current) => current.map((p) => p.id === input.parcelId ? {
      ...p,
      workflowStatus: 'SUPERVISOR_REVIEW',
      routingReason: correctedFootprint
        ? 'Field verification complete with a Surveyor footprint revision; supervisor comparison and decision required.'
        : 'Field verification complete with no footprint revision; supervisor decision required.',
      // The AI footprint remains immutable. The latest field geometry is copied onto the case as
      // a durable handoff pointer as well as being stored in FieldEvidence/GeometryRevision.
      fieldFootprint: correctedFootprint,
      fieldEvidenceId: evidence.id,
      fieldSubmittedAt: submittedAt,
      approvedBoundary: undefined,
      approvedFootprint: undefined
    } : p));
    setLastSubmittedParcelId(input.parcelId);
    setAudits((current) => [
      makeAudit(input.parcelId, surveyorName, 'VERIFICATION_REQUEST_CREATED', `${request.id} created and sent to Supervisor review.`),
      ...current
    ]);
    return request;
  };

  const supervisorDecision = (parcelId: string, decision: SupervisorDecision, reason: string) => {
    const latestEvidence = evidences.find((item) => item.parcelId === parcelId);
    setParcels((current) => current.map((p) => {
      if (p.id !== parcelId) return p;
      if (decision === 'APPROVE') return {
        ...p,
        workflowStatus: 'APPROVED',
        approvedBoundary: latestEvidence?.correctedBoundary ?? p.aiBoundary,
        approvedFootprint: p.fieldFootprint ?? latestEvidence?.correctedFootprint ?? p.buildingFootprint
      };
      if (decision === 'REQUEST_CORRECTION') return { ...p, workflowStatus: 'RECHECK_REQUIRED', surveyorId: p.surveyorId ?? 'surveyor-1', fieldAnalysisCompletedAt: undefined };
      return { ...p, workflowStatus: 'ESCALATED' };
    }));
    setVerificationRequests((current) => {
      const pending = current
        .filter((request) => request.houseCaseId === parcelId && (request.status === 'NEW' || request.status === 'OPENED'))
        .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0];
      if (!pending) return current;
      return current.map((request) => request.id === pending.id ? decideVerificationRequest(request, decision) : request);
    });
    setAudits((current) => [makeAudit(parcelId,'Supervisor',decision,reason), ...current]);
  };

  const resetDemo = () => {
    setParcels(freshDemoParcels());
    setDataSource('SYNTHETIC_DEMO');
    setEvidences([]);
    setRevisions([]);
    setAudits([]);
    setAreaAnalysisComplete(false);
    setLastAreaSummary(null);
    setLastSubmittedParcelId(null);
    setVerificationRequests([]);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(WORKFLOW_STORAGE_KEY);
      window.localStorage.removeItem(LATEST_HANDOFF_KEY);
      window.localStorage.removeItem('sih26012-workflow-state-v6');
      window.localStorage.removeItem('sih26012-workflow-state-v5');
      window.localStorage.removeItem('sih26012-workflow-state-v4');
      window.localStorage.removeItem('sih26012-workflow-state-v3');
      window.localStorage.removeItem('sih26012-latest-surveyor-handoff-v2');
      window.localStorage.removeItem('sih26012-latest-surveyor-handoff-v1');
    }
    setRole('ADMIN');
    selectParcel('PROP-103');
  };

  const value = useMemo(() => ({
    role,setRole,activeUser,dataSource,parcels,selectedParcelId,selectParcel,selectedParcel,evidences,revisions,audits,
    areaAnalysisComplete,lastAreaSummary,lastSubmittedParcelId,verificationRequests,openVerificationRequest,processAreaAnalysis,alignToLiveBuildings,recordFieldAnalysisComplete,submitSurvey,supervisorDecision,resetDemo
  }), [role,activeUser,dataSource,parcels,selectedParcelId,selectedParcel,evidences,revisions,audits,areaAnalysisComplete,lastAreaSummary,lastSubmittedParcelId,verificationRequests]);

  return <ParcelContext.Provider value={value}>{children}</ParcelContext.Provider>;
}

export function useParcels() {
  const ctx = useContext(ParcelContext);
  if (!ctx) throw new Error('useParcels must be used inside ParcelProvider');
  return ctx;
}
