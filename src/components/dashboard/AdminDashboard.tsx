import { useMemo, useState } from 'react';
import { UploadCloud, Cpu, ShieldAlert, SearchCheck, Home, AlertTriangle, CheckCircle2, MapPinned } from 'lucide-react';
import { MetricCards } from './MetricCards';
import { GISMap, houseLabel } from '../gis/GISMap';
import { PropertyDetailPanel } from '../parcel/PropertyDetailPanel';
import { ActivityLog } from './ActivityLog';
import { useParcels } from '../../store/parcelContext';
import { screenHouse } from '../../services/areaAnalysisService';
import { Badge } from '../common/Badge';

export function AdminDashboard() {
  const { parcels, processAreaAnalysis, areaAnalysisComplete, lastAreaSummary, selectParcel, selectedParcelId, alignToLiveBuildings, dataSource } = useParcels();
  const [uploadName,setUploadName] = useState('ward-15-orthomosaic.tif');
  const [processing,setProcessing] = useState(false);
  const [message,setMessage] = useState('');
  const [errorMessage,setErrorMessage] = useState('');
  const [alignmentLoading,setAlignmentLoading] = useState(false);
  const [alignmentMessage,setAlignmentMessage] = useState('');

  const problemHouses = useMemo(() => areaAnalysisComplete ? parcels.filter((parcel) => screenHouse(parcel).status !== 'NO_MAJOR_ISSUE') : [], [parcels, areaAnalysisComplete]);

  const run = async() => {
    setProcessing(true);
    setMessage('');
    setErrorMessage('');
    try {
      const routing = await processAreaAnalysis();
      setMessage(`Area analysis mapped ${routing.total} reference-aligned house candidates. ${routing.noMajorIssue} no-major-issue · ${routing.needsVerification} targeted verification · ${routing.majorConflict} major conflict · ${routing.complexCase} complex.`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Building-footprint alignment failed.';
      setErrorMessage(`${detail} Area analysis was not completed, because the app will not label the old synthetic roadside rectangles as detected houses.`);
    } finally {
      setProcessing(false);
    }
  };

  const alignLive = async() => {
    setAlignmentLoading(true);
    setAlignmentMessage('');
    setErrorMessage('');
    try {
      const count = await alignToLiveBuildings();
      setAlignmentMessage(`${count} likely-house building footprints loaded from the live map reference. Tiny sheds, road geometry, roof-only structures and extreme sliver polygons are filtered out. Run area analysis next.`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Live building alignment failed.';
      setErrorMessage(`${detail} No synthetic house count has been substituted. Retry when the live reference service is available.`);
    } finally {
      setAlignmentLoading(false);
    }
  };

  return <div className="admin-page">
    <div className="page-title"><div><small>Admin operations</small><h1>Map every house → find the problems</h1><p>Run area analysis to load house-shaped building footprints for the current demo area, then screen each mapped house for record/geometry exceptions.</p></div><div className="legal-pill"><ShieldAlert size={15}/>AI creates evidence drafts · supervisor remains the final decision gate</div></div>
    <MetricCards/>

    <section className="routing-overview">
      <div><CheckCircle2 size={19}/><strong>No major issue</strong><span>Very-high confidence + no configured conflict</span><b>Direct → Supervisor</b></div>
      <div><SearchCheck size={19}/><strong>Uncertain / partially observable</strong><span>AI found something that needs checking</span><b>Targeted → Surveyor</b></div>
      <div><AlertTriangle size={19}/><strong>Conflict / complex geometry</strong><span>Material difference or multi-parcel issue</span><b>Deep → Surveyor</b></div>
    </section>

    <section className="upload-strip"><div><UploadCloud size={20}/><div><strong>Full-area imagery screening</strong><span>Orthomosaic / high-resolution drone imagery</span></div></div><input value={uploadName} onChange={e=>setUploadName(e.target.value)}/><div className="admin-action-stack"><button className="secondary" onClick={alignLive} disabled={alignmentLoading || processing}><MapPinned size={16}/>{alignmentLoading?'Loading house footprints…':'Preview mapped houses'}</button><button className="primary" onClick={run} disabled={processing || alignmentLoading}><Cpu size={16}/>{processing?'Detecting & screening houses…':'Run area analysis'}</button></div></section>
    <div className={`geometry-source-banner ${dataSource==='OSM_BUILDING_REFERENCE'?'live':''}`}><strong>Geometry source: {dataSource==='OSM_BUILDING_REFERENCE'?'Filtered live building reference':'Waiting for area detection'}</strong><span>{dataSource==='OSM_BUILDING_REFERENCE'?'Only likely-house building polygons are used for visual alignment. The confidence/problem logic remains an MVP simulation; these are not legal parcel boundaries.':'No fixed 96-house result is shown before analysis. Run area analysis to load the current reference-aligned building count.'}</span></div>
    {alignmentMessage&&<div className="analysis-note wide">{alignmentMessage}</div>}
    {errorMessage&&<div className="error-note wide">{errorMessage}</div>}
    {message&&<div className="success-note wide">{message}</div>}

    {areaAnalysisComplete && lastAreaSummary && <section className="area-scan-summary">
      <div className="area-scan-title"><div><Home size={20}/><div><strong>{lastAreaSummary.total} houses mapped</strong><span>The count comes from the current filtered building-reference result, not a fixed demo total.</span></div></div><b>AREA SCAN COMPLETE</b></div>
      <div className="area-scan-counts">
        <div><strong>{lastAreaSummary.noMajorIssue}</strong><span>No major issue</span></div>
        <div><strong>{lastAreaSummary.needsVerification}</strong><span>Needs verification</span></div>
        <div><strong>{lastAreaSummary.majorConflict}</strong><span>Major conflict</span></div>
        <div><strong>{lastAreaSummary.complexCase}</strong><span>Complex case</span></div>
      </div>
    </section>}

    <div className="admin-grid"><GISMap/><PropertyDetailPanel/></div>

    {areaAnalysisComplete && <section className="problem-house-section card">
      <div className="section-head"><div><small>Exception queue</small><h3>Problem houses found by area screening</h3><p>Surveyors receive these houses only. Clean high-confidence houses bypass field work and wait for supervisor review.</p></div><Badge tone="red">{problemHouses.length} FLAGGED</Badge></div>
      <div className="problem-house-grid">
        {problemHouses.map((parcel) => {
          const result = screenHouse(parcel);
          const tone = result.status === 'NEEDS_VERIFICATION' ? 'amber' : 'red';
          return <button key={parcel.id} className={selectedParcelId===parcel.id?'active':''} onClick={()=>selectParcel(parcel.id)}>
            <div className="problem-house-id"><strong>{houseLabel(parcel.id)}</strong><small>{parcel.id}</small></div>
            <div><span>{result.issue}</span><small>{parcel.address}</small></div>
            <Badge tone={tone}>{result.label}</Badge>
          </button>;
        })}
      </div>
    </section>}

    <ActivityLog/>
  </div>;
}
