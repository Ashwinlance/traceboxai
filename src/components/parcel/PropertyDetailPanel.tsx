import { AlertTriangle, Ruler, Route, UserCheck, Home } from 'lucide-react';
import { useParcels } from '../../store/parcelContext';
import { Badge } from '../common/Badge';
import { ConfidenceMeter } from './ConfidenceMeter';
import { FeatureComparisonTable } from './FeatureComparisonTable';
import { approximateBoundaryIoU } from '../../services/comparisonEngine';
import { decideRoute } from '../../services/routingEngine';
import { screenHouse } from '../../services/areaAnalysisService';
import { houseLabel } from '../gis/GISMap';

export function PropertyDetailPanel() {
  const { selectedParcel:p, evidences, areaAnalysisComplete } = useParcels();
  const iou = approximateBoundaryIoU(p.referenceBoundary,p.aiBoundary);
  const route = decideRoute(p);
  const screening = screenHouse(p);
  const evidence = evidences.find((item) => item.parcelId === p.id);
  const routeLabel = evidence && p.workflowStatus === 'SUPERVISOR_REVIEW' ? 'FIELD VERIFIED → SUPERVISOR' : route.route.replaceAll('_',' ');
  const routeReason = evidence && p.workflowStatus === 'SUPERVISOR_REVIEW' ? 'Surveyor evidence is complete. The supervisor now decides whether to approve, recheck or escalate.' : route.reason;
  const screeningTone = screening.status === 'NO_MAJOR_ISSUE' ? 'green' : screening.status === 'NEEDS_VERIFICATION' ? 'amber' : 'red';

  return <div className="detail-stack">
    <section className="card property-hero"><div><small>Selected house</small><h2>{houseLabel(p.id)} <span className="muted-id">{p.id}</span></h2><p>{p.address} · {p.ward}</p></div><Badge tone={areaAnalysisComplete?screeningTone:'slate'}>{areaAnalysisComplete?screening.label:'UNSCREENED'}</Badge></section>

    {areaAnalysisComplete ? <section className={`card screening-result screening-${screening.status.toLowerCase()}`}>
      <Home size={20}/><div><small>Area-screening result</small><h3>{screening.label}</h3><p>{screening.issue}</p></div>
    </section> : <section className="card screening-result"><Home size={20}/><div><small>Area-screening result</small><h3>Waiting for area scan</h3><p>Run “Run area AI mapping” to classify every house and create the exception workflow.</p></div></section>}

    <div className="mini-grid">
      <div className="metric"><Ruler size={18}/><span>Record area</span><strong>{p.existingAreaSqM} m²</strong></div>
      <div className="metric"><Ruler size={18}/><span>AI footprint area</span><strong>{p.detectedAreaSqM} m²</strong></div>
      <div className="metric"><Route size={18}/><span>Approx. boundary IoU</span><strong>{iou}%</strong></div>
    </div>

    {areaAnalysisComplete && <section className="card route-card"><AlertTriangle size={20}/><div><small>Confidence-based workflow route</small><h3>{routeLabel}</h3><p>{routeReason}</p></div></section>}
    {areaAnalysisComplete && route.route==='DIRECT_SUPERVISOR' && !evidence && <section className="card direct-review-card"><UserCheck size={20}/><div><strong>No field survey required by routing</strong><p>This very-high-confidence clean draft goes directly to a supervisor, who can still approve, send it to a surveyor, or escalate.</p></div></section>}
    <ConfidenceMeter confidence={p.confidence}/>
    <FeatureComparisonTable features={p.features}/>
  </div>;
}
