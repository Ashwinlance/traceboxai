import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, CheckCircle2, Clock3, RotateCcw, ShieldAlert, UserCheck, Cpu, GitCompareArrows, History } from 'lucide-react';
import { useParcels } from '../../store/parcelContext';
import { Badge } from '../common/Badge';
import { GISMap } from '../gis/GISMap';
import { decideRoute } from '../../services/routingEngine';
import { screenHouse } from '../../services/areaAnalysisService';
import { houseLabel } from '../gis/GISMap';
import { SurveyorChangeMap } from './SurveyorChangeMap';
import { summarizeGeometryChange } from '../../services/geometryRevisionService';

export function ReviewQueue() {
  const { parcels, selectedParcel, selectedParcelId, selectParcel, supervisorDecision, evidences, revisions, audits, lastSubmittedParcelId, verificationRequests, openVerificationRequest } = useParcels();
  const pendingRequests = useMemo(() => verificationRequests
    .filter((request) => request.status === 'NEW' || request.status === 'OPENED')
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)), [verificationRequests]);
  const newRequestCount = verificationRequests.filter((request) => request.status === 'NEW').length;
  const pendingRequestByParcel = useMemo(() => {
    const map = new Map<string, typeof pendingRequests[number]>();
    for (const request of pendingRequests) if (!map.has(request.houseCaseId)) map.set(request.houseCaseId, request);
    return map;
  }, [pendingRequests]);
  const queue = parcels
    .filter(p=>['SUPERVISOR_REVIEW','ESCALATED'].includes(p.workflowStatus))
    .sort((a,b) => {
      const aRequest = pendingRequestByParcel.get(a.id);
      const bRequest = pendingRequestByParcel.get(b.id);
      if (aRequest || bRequest) {
        if (!aRequest) return 1;
        if (!bRequest) return -1;
        return bRequest.submittedAt.localeCompare(aRequest.submittedAt);
      }
      const aField = a.fieldSubmittedAt ? Date.parse(a.fieldSubmittedAt) : 0;
      const bField = b.fieldSubmittedAt ? Date.parse(b.fieldSubmittedAt) : 0;
      if (aField !== bField) return bField - aField;
      return a.id.localeCompare(b.id);
    });

  const initialHandoffSelectionDone = useRef(false);
  useEffect(() => {
    if (!queue.length) return;
    if (!initialHandoffSelectionDone.current) {
      const latestEvidence = [...evidences].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0];
      const preferredId = pendingRequests[0]?.houseCaseId ?? lastSubmittedParcelId ?? latestEvidence?.parcelId;
      if (preferredId && queue.some((p) => p.id === preferredId)) {
        selectParcel(preferredId);
        initialHandoffSelectionDone.current = true;
        return;
      }
      initialHandoffSelectionDone.current = true;
    }
    if (!queue.some((p) => p.id === selectedParcelId)) selectParcel(queue[0].id);
  }, [queue, selectedParcelId, selectParcel, evidences, lastSubmittedParcelId, pendingRequests]);

  const active = queue.find((p) => p.id === selectedParcelId) ?? queue.find((p) => p.id === pendingRequests[0]?.houseCaseId) ?? queue.find((p) => p.id === lastSubmittedParcelId) ?? queue[0] ?? selectedParcel;
  const [reason,setReason] = useState('AI result, reference geometry and available field evidence reviewed.');
  const activeRequest = verificationRequests
    .filter((request) => request.houseCaseId === active.id)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0];
  const evidence = activeRequest?.evidenceId
    ? evidences.find((item) => item.id === activeRequest.evidenceId) ?? evidences.find((item) => item.parcelId === active.id)
    : evidences.find((item) => item.parcelId === active.id);
  const revision = revisions.find((item) => item.parcelId === active.id);
  const fieldFootprint = active.fieldFootprint ?? evidence?.correctedFootprint ?? revision?.after;
  const hasFieldHandoff = Boolean(activeRequest || evidence || revision || active.fieldSubmittedAt);
  const change = fieldFootprint ? summarizeGeometryChange(active.buildingFootprint, fieldFootprint) : null;
  const caseAudits = audits.filter((item) => item.parcelId === active.id).slice(0, 8);
  const route = decideRoute(active);
  const directAi = !hasFieldHandoff && route.route === 'DIRECT_SUPERVISOR';
  const conflicts = useMemo(() => active.features.filter((feature) => feature.status === 'CONFLICT'), [active]);

  const act=(d:'APPROVE'|'REQUEST_CORRECTION'|'ESCALATE')=>supervisorDecision(active.id,d,reason);

  if (!queue.length) {
    return <div className="role-page"><div className="role-page-header"><div><small>Supervisor review</small><h1>No pending decisions</h1><p>Supervisor approval remains the final workflow gate before any approved GIS state.</p></div></div><div className="card empty-state">No cases currently require a supervisor decision.</div></div>;
  }

  return <div className="role-page">
    <div className="role-page-header"><div><small>Supervisor review</small><h1>Final human decision queue</h1><p>Very-high-confidence AI drafts arrive directly. Surveyor submissions create explicit verification requests so the exact house, evidence and geometry revision can be reviewed without relying on hidden screen state.</p></div></div>

    <section className="verification-inbox">
      <div className="verification-inbox-head">
        <div><Bell size={18}/><div><small>Surveyor request inbox</small><h2>{newRequestCount} new · {pendingRequests.length} pending</h2><p>Each request points to one authoritative house case and the exact evidence submission that created it.</p></div></div>
        <Badge tone={newRequestCount ? 'red' : pendingRequests.length ? 'amber' : 'green'}>{newRequestCount ? `${newRequestCount} NEW` : pendingRequests.length ? `${pendingRequests.length} OPEN` : 'CLEAR'}</Badge>
      </div>
      {pendingRequests.length ? <div className="verification-request-list">{pendingRequests.map((request) => {
        const parcel = parcels.find((item) => item.id === request.houseCaseId);
        return <button key={request.id} className={`verification-request-card ${active.id===request.houseCaseId?'active':''}`} onClick={()=>openVerificationRequest(request.id)}>
          <div className="request-icon"><UserCheck size={17}/></div>
          <div className="request-copy"><strong>{request.surveyorName} submitted {houseLabel(request.houseCaseId)} · {request.houseCaseId}</strong><span>{request.id} · {request.geometryChanged?'Geometry changed':'Evidence only'} · Field AI {request.fieldAiReanalysisPerformed?'complete':'not run'} · {parcel?.address ?? 'Mapped property'}</span><small><Clock3 size={12}/>{new Date(request.submittedAt).toLocaleString()}</small></div>
          <Badge tone={request.status==='NEW'?'red':'blue'}>{request.status}</Badge>
        </button>;
      })}</div> : <div className="verification-inbox-empty">No pending Surveyor requests. AI-direct cases can still remain in the decision queue.</div>}
    </section>

    {activeRequest && <div className="success-note latest-handoff-banner"><strong>Opened request:</strong> {activeRequest.id} · {activeRequest.surveyorName} → {houseLabel(activeRequest.houseCaseId)} · {activeRequest.houseCaseId} · status {activeRequest.status}.</div>}
    <div className="supervisor-layout">
      <aside className="task-queue"><h3>Decision queue</h3>{queue.map(p=>{
        const fieldEvidence = Boolean(p.fieldSubmittedAt) || evidences.some((item) => item.parcelId === p.id) || revisions.some((item) => item.parcelId === p.id);
        const request = pendingRequestByParcel.get(p.id);
        return <button className={active.id===p.id?'selected':''} onClick={()=>request ? openVerificationRequest(request.id) : selectParcel(p.id)} key={p.id}><div><strong>{houseLabel(p.id)} · {p.id}</strong><span>{screenHouse(p).issue}</span><span>{request?`${request.id} · ${request.status}`:fieldEvidence?'Surveyor verified':'AI direct review'}</span></div><Badge tone={p.workflowStatus==='ESCALATED'?'red':request?.status==='NEW'?'red':fieldEvidence?'purple':'green'}>{p.confidence.total}%</Badge></button>
      })}</aside>
      <main className="supervisor-workspace">
        <section className="review-card">
          <div className="section-head"><div><small>Decision source</small><h2>{houseLabel(active.id)} <span className="muted-id">{active.id}</span></h2><p>{active.address} · {active.ward}</p></div><Badge tone={directAi?'green':hasFieldHandoff?'purple':'red'}>{directAi?'AI DIRECT':hasFieldHandoff?'FIELD VERIFIED':'ESCALATED'}</Badge></div>
          <div className="supervisor-problem"><strong>Area-screening finding</strong><span>{screenHouse(active).issue}</span></div>
          <div className="supervisor-source-banner">
            {directAi?<Cpu size={20}/>:<UserCheck size={20}/>}<div><strong>{directAi?'Very-high-confidence case bypassed field survey':hasFieldHandoff?'Surveyor handoff received':'Human review required'}</strong><span>{directAi?'The AI did not approve this property. It only routed the draft directly to you for a decision.':hasFieldHandoff?'The field submission is attached to this exact house. Compare the original AI footprint with the Surveyor result before deciding.':'Review the available case evidence before deciding.'}</span></div>
          </div>
          {activeRequest && <div className="request-detail-strip"><span>Request <strong>{activeRequest.id}</strong></span><span>From <strong>{activeRequest.surveyorName}</strong></span><span>Status <strong>{activeRequest.status}</strong></span><span>Field AI <strong>{activeRequest.fieldAiReanalysisPerformed?'COMPLETED':'NOT RUN'}</strong></span><span>Submitted <strong>{new Date(activeRequest.submittedAt).toLocaleString()}</strong></span></div>}
        </section>

        {hasFieldHandoff ? <section className="review-card surveyor-primary-comparison">
          <div className="section-head"><div><small>Primary supervisor comparison</small><h2><GitCompareArrows size={18}/> AI original vs Surveyor submission</h2><p>This is the field handoff for {houseLabel(active.id)} · {active.id}. Purple is the immutable AI footprint; cyan is the Surveyor correction when geometry was changed.</p></div><Badge tone={fieldFootprint?'purple':'green'}>{fieldFootprint?'FIELD REVISION RECEIVED':'FIELD VERIFIED · NO GEOMETRY CHANGE'}</Badge></div>
          <SurveyorChangeMap parcel={active} fieldFootprint={fieldFootprint}/>
          {!fieldFootprint && <div className="success-note">The Surveyor submitted field evidence without changing the AI footprint.</div>}
        </section> : <GISMap compact showAll={false}/>}

        {hasFieldHandoff && <section className="review-card surveyor-change-card">
          <div className="section-head"><div><small>Field handoff trace</small><h2><GitCompareArrows size={18}/> What did the Surveyor change?</h2><p>The original AI footprint is preserved. Any field correction is stored as a separate revision for Supervisor comparison.</p></div><Badge tone={change?.changed?'purple':'green'}>{change?.changed?'GEOMETRY CHANGED':'NO GEOMETRY CHANGE'}</Badge></div>
          <div className="change-metrics">
            <div><span>Original AI area</span><strong>{Math.round(change?.beforeAreaSqM ?? active.detectedAreaSqM)} m²</strong></div>
            <div><span>Surveyor field area</span><strong>{Math.round(change?.afterAreaSqM ?? active.detectedAreaSqM)} m²</strong></div>
            <div><span>Area difference</span><strong>{change ? `${change.areaDeltaSqM >= 0 ? '+' : ''}${Math.round(change.areaDeltaSqM)} m² (${change.areaDeltaPct >= 0 ? '+' : ''}${change.areaDeltaPct.toFixed(1)}%)` : '0 m²'}</strong></div>
            <div><span>Max vertex movement</span><strong>{change ? `${change.maxVertexShiftMeters.toFixed(1)} m` : '0.0 m'}</strong></div>
            <div><span>Changed vertices</span><strong>{change?.changedVertices ?? 0}</strong></div>
            <div><span>Field AI re-analysis</span><strong>{activeRequest?.fieldAiReanalysisPerformed?'COMPLETED':'NOT RUN'}</strong></div>
            <div><span>Submitted by</span><strong>{evidence?.surveyorId ?? active.surveyorId ?? 'Surveyor'}</strong></div>
          </div>
          {fieldFootprint && <div className="success-note">The before/after geometry map is shown above as the primary Supervisor inspection view.</div>}
          <div className="field-handoff-summary">
            <div><strong>Surveyor remarks</strong><p>{evidence?.remarks ?? revision?.reason ?? 'Field handoff received.'}</p></div>
            <div className="handoff-meta"><span>Submitted {new Date(evidence?.submittedAt ?? active.fieldSubmittedAt ?? revision?.createdAt ?? Date.now()).toLocaleString()}</span><span>{evidence?.photoNames.length ?? 0} evidence photo{(evidence?.photoNames.length ?? 0)===1?'':'s'}</span>{evidence && <span>GPS distance {evidence.distanceMeters} m</span>}{revision && <span>Revision {revision.id}</span>}</div>
          </div>
        </section>}

        {hasFieldHandoff && <section className="review-card audit-trace-card">
          <div className="section-head"><div><small>Audit trail</small><h2><History size={18}/> Case history</h2><p>Trace the case from AI screening through field verification before making the final decision.</p></div></div>
          <div className="case-audit-list">{caseAudits.length ? caseAudits.map((entry) => <div key={entry.id}><span>{new Date(entry.at).toLocaleTimeString()}</span><strong>{entry.actor} · {entry.action.replaceAll('_',' ')}</strong><p>{entry.detail}</p></div>) : <p>No audit entries recorded for this case.</p>}</div>
        </section>}

        <section className="review-card">
          <div className="compare-panels triple">
            <div><small>Reference vs AI</small><strong>{active.existingAreaSqM} → {active.detectedAreaSqM} m²</strong><span>{conflicts.length} conflict{conflicts.length===1?'':'s'} · confidence {active.confidence.total}%</span></div>
            <div><small>Field evidence</small><strong>{evidence?`${evidence.distanceMeters} m from target`:hasFieldHandoff?'Field handoff received':'Not required by routing'}</strong><span>{evidence?`${evidence.photoNames.length} photos · ${evidence.durationMinutes} min${fieldFootprint?' · footprint corrected':''}`:hasFieldHandoff?'Surveyor submission attached':'Very-high-confidence AI direct case'}</span></div>
            <div><small>Current workflow</small><strong>{active.workflowStatus.replaceAll('_',' ')}</strong><span>{active.routingReason}</span></div>
          </div>
          {evidence && <div className="field-evidence-summary"><strong>Surveyor remarks</strong><p>{evidence.remarks}</p><span>GPS timestamp: {new Date(evidence.gpsTimestamp).toLocaleString()}</span></div>}
          <label className="remarks"><span>Supervisor decision reason</span><textarea value={reason} onChange={e=>setReason(e.target.value)} rows={4}/></label>
          <div className="decision-row">
            <button className="approve" onClick={()=>act('APPROVE')}><CheckCircle2 size={16}/>Approve GIS update</button>
            <button className="correction" onClick={()=>act('REQUEST_CORRECTION')}><RotateCcw size={16}/>Send to surveyor</button>
            <button className="escalate" onClick={()=>act('ESCALATE')}><ShieldAlert size={16}/>Escalate complex case</button>
          </div>
          <p className="legal-note">Approval records the project workflow decision only. This prototype does not determine legal ownership or adjudicate disputes.</p>
        </section>
      </main>
    </div>
  </div>;
}
