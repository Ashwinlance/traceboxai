import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Camera, Crosshair, LocateFixed, RotateCcw, ScanLine, Send, TimerReset } from 'lucide-react';
import { useParcels } from '../../store/parcelContext';
import { Badge } from '../common/Badge';
import { SurveyorMap } from '../gis/SurveyorMap';
import { SurveyorQueueMap } from '../gis/SurveyorQueueMap';
import { decideRoute, verificationRequirements } from '../../services/routingEngine';
import { simulateAiProcessing } from '../../services/aiEngine';
import type { LatLngTuple, PolygonGeometry } from '../../types/gis';
import type { ParcelRecord } from '../../types/parcel';
import { screenHouse } from '../../services/areaAnalysisService';
import { houseLabel } from '../gis/GISMap';
import { nudgePolygonMeters, polygonAreaSqM, polygonCentroid, scalePolygonAnisotropic } from '../../services/geometryEditService';

const EARTH_RADIUS_M = 6_371_000;

function centroid(parcel: ParcelRecord): LatLngTuple {
  return polygonCentroid(parcel.buildingFootprint);
}

function demoSurveyorPosition(parcel: ParcelRecord): LatLngTuple {
  const [lat, lng] = centroid(parcel);
  const metersPerDegreeLng = 111_320 * Math.cos(lat * Math.PI / 180);
  return [lat - 3 / 111_320, lng + 4 / metersPerDegreeLng];
}

function distanceMeters(a: LatLngTuple, b: LatLngTuple): number {
  const lat1 = a[0] * Math.PI / 180;
  const lat2 = b[0] * Math.PI / 180;
  const dLat = (b[0] - a[0]) * Math.PI / 180;
  const dLng = (b[1] - a[1]) * Math.PI / 180;
  const h = Math.sin(dLat/2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng/2) ** 2;
  return Math.round(EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1-h)));
}

export function MobileSurveyorView() {
  const {
    parcels, selectedParcelId, selectParcel, selectedParcel, recordFieldAnalysisComplete, submitSurvey,
    activeUser, areaAnalysisComplete, processAreaAnalysis, dataSource
  } = useParcels();
  const assigned = parcels.filter((p) => p.workflowStatus === 'SURVEY_PENDING' || p.workflowStatus === 'RECHECK_REQUIRED');

  useEffect(() => {
    if (assigned.length && !assigned.some((p) => p.id === selectedParcelId)) selectParcel(assigned[0].id);
  }, [assigned, selectedParcelId, selectParcel]);

  const active = assigned.find((p) => p.id === selectedParcelId) ?? assigned[0] ?? selectedParcel;
  const route = decideRoute(active);
  const requirements = verificationRequirements(active);
  const screening = screenHouse(active);
  const fieldRouteLabel = active.workflowStatus === 'RECHECK_REQUIRED' && route.route === 'DIRECT_SUPERVISOR' ? 'SUPERVISOR RECHECK' : route.route.replaceAll('_',' ');

  const [position,setPosition] = useState<LatLngTuple>(() => demoSurveyorPosition(active));
  const [gpsAccuracy,setGpsAccuracy] = useState<number | null>(5);
  const [gpsMode,setGpsMode] = useState<'DEMO'|'DEVICE'>('DEMO');
  const [zoom,setZoom] = useState(21);
  const [duration,setDuration] = useState(12);
  const [remarks,setRemarks] = useState('Physical structure checked at the assigned property; field evidence captured.');
  const [photos,setPhotos] = useState<string[]>(['field-roof.jpg','boundary-reference.jpg']);
  const [message,setMessage] = useState('');
  const [submissionNotice,setSubmissionNotice] = useState('');
  const [analysisMessage,setAnalysisMessage] = useState('');
  const analysisComplete = Boolean(active.fieldAnalysisCompletedAt);
  const [analysisRunning,setAnalysisRunning] = useState(false);
  const [workingFootprint,setWorkingFootprint] = useState<PolygonGeometry>(active.buildingFootprint);
  const [footprintEdited,setFootprintEdited] = useState(false);

  useEffect(() => {
    setPosition(demoSurveyorPosition(active));
    setGpsAccuracy(5);
    setGpsMode('DEMO');
    setZoom(21);
    setAnalysisMessage('');
    setMessage('');
    setWorkingFootprint(active.buildingFootprint);
    setFootprintEdited(false);
    setPhotos(route.route === 'DEEP_VERIFY' ? ['field-roof.jpg','boundary-reference.jpg'] : ['field-roof.jpg']);
  }, [active.id, route.route, active.buildingFootprint]);

  const propertyCenter = useMemo(() => centroid(active), [active]);
  const distance = useMemo(() => distanceMeters(position, propertyCenter), [position, propertyCenter]);
  const zoomReady = zoom >= 20;
  const locationReady = distance <= requirements.maxDistanceMeters;
  const analysisReady = zoomReady && locationReady;
  const evidenceReady = photos.length >= requirements.minPhotos && remarks.trim().length >= 8;
  const canSubmit = locationReady && evidenceReady;
  const correctedArea = Math.max(1, Math.round(polygonAreaSqM(workingFootprint)));
  const areaDeltaPct = Math.round(((correctedArea - active.detectedAreaSqM) / Math.max(1, active.detectedAreaSqM)) * 100);
  const largeGeometryChange = Math.abs(areaDeltaPct) > 30;

  const prepareAssignments = async () => {
    setMessage('Preparing current-area house assignments…');
    try {
      const summary = await processAreaAnalysis();
      setMessage(`${summary.targetedVerify + summary.deepVerify} problem houses assigned to ${activeUser.name}.`);
    } catch (error) {
      setMessage(error instanceof Error ? `${error.message} No synthetic roadside houses were substituted.` : 'Area assignment preparation failed.');
    }
  };

  const useDeviceLocation = () => {
    setMessage('');
    if (!navigator.geolocation) {
      setMessage('Browser geolocation is unavailable. Demo field location remains active.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (result) => {
        setPosition([result.coords.latitude, result.coords.longitude]);
        setGpsAccuracy(Math.round(result.coords.accuracy));
        setGpsMode('DEVICE');
        setAnalysisMessage(analysisComplete
          ? 'Device GPS updated. The completed field AI re-analysis remains attached to this house; location readiness is checked again before submission.'
          : 'Device GPS captured. Move to the assigned parcel before running field AI re-analysis.');
      },
      () => setMessage('Location permission was denied or unavailable. You can continue with the demo field position.'),
      { enableHighAccuracy:true, timeout:10_000, maximumAge:5_000 }
    );
  };

  const useDemoLocation = () => {
    setPosition(demoSurveyorPosition(active));
    setGpsAccuracy(5);
    setGpsMode('DEMO');
    setAnalysisMessage(analysisComplete
      ? 'Demo field position restored. The completed field AI re-analysis remains attached to this house.'
      : 'Demo field position restored near the assigned property.');
  };

  const runFieldAnalysis = async () => {
    setAnalysisRunning(true);
    setAnalysisMessage('');
    const result = await simulateAiProcessing(active);
    setAnalysisRunning(false);
    recordFieldAnalysisComplete(active.id, result.processedAt);
    setAnalysisMessage(`${result.message} Completion is saved on this house and will remain valid through footprint editing and role changes; supervisor approval is still required.`);
  };

  const moveFootprint = (east: number, north: number) => {
    setWorkingFootprint((current) => nudgePolygonMeters(current, east, north));
    setFootprintEdited(true);
    if (analysisComplete) setAnalysisMessage('Field AI re-analysis is complete. Surveyor geometry correction is attached separately for supervisor review.');
  };

  const resizeFootprint = (widthFactor: number, heightFactor: number) => {
    setWorkingFootprint((current) => scalePolygonAnisotropic(current, widthFactor, heightFactor));
    setFootprintEdited(true);
    if (analysisComplete) setAnalysisMessage('Field AI re-analysis is complete. Surveyor geometry correction is attached separately for supervisor review.');
  };

  const resetFootprint = () => {
    setWorkingFootprint(active.buildingFootprint);
    setFootprintEdited(false);
    if (analysisComplete) setAnalysisMessage('Field AI re-analysis remains valid. Footprint reset to the original AI outline.');
  };

  const missingRequirements = [
    !locationReady ? `move within ${requirements.maxDistanceMeters} m of the assigned house` : '',
    photos.length < requirements.minPhotos ? `add ${requirements.minPhotos - photos.length} more required photo${requirements.minPhotos - photos.length === 1 ? '' : 's'}` : '',
    remarks.trim().length < 8 ? 'enter field remarks' : ''
  ].filter(Boolean);

  const submit = () => {
    if (!canSubmit) {
      setMessage(`Cannot submit yet: ${missingRequirements.join('; ')}.`);
      return;
    }
    const submittedHouse = houseLabel(active.id);
    const submittedParcelId = active.id;
    const request = submitSurvey({
      parcelId:submittedParcelId,
      surveyorId:activeUser.id,
      reachedAssignedArea:locationReady,
      distanceMeters:distance,
      durationMinutes:duration,
      photoNames:photos,
      gpsTimestamp:new Date().toISOString(),
      remarks: footprintEdited ? `${remarks} Footprint geometry was manually aligned to the visible roof for supervisor review.` : remarks,
      correctedBoundary:requirements.requiresBoundaryReview ? active.aiBoundary : undefined,
      correctedFootprint:footprintEdited ? workingFootprint : undefined
    });
    setSubmissionNotice(`${request.id} created: ${submittedHouse} · ${submittedParcelId} sent to Supervisor. Status: NEW.`);
  };

  if (!assigned.length) {
    return <div className="role-page">
      <div className="role-page-header"><div><small>Surveyor mobile portal</small><h1>Surveyor session ready</h1><p>{activeUser.name} ({activeUser.id}) is signed into the demo Surveyor role. Surveyors receive only AI-flagged houses.</p></div><Badge tone="blue">SIGNED IN</Badge></div>
      {!areaAnalysisComplete
        ? <div className="card empty-state surveyor-start-card"><strong>No area screening has been routed yet.</strong><p>Prepare the demo assignments so the Surveyor portal receives every problem house, not just one property.</p><button className="primary" onClick={prepareAssignments}>Prepare surveyor assignments</button>{message&&<div className="success-note">{message}</div>}</div>
        : <div className="card empty-state">Area screening is complete and no houses currently require field verification.</div>}
    </div>;
  }

  return <div className="role-page surveyor-page-wide">
    <div className="role-page-header"><div><small>Surveyor mobile portal</small><h1>All flagged houses → select one → verify</h1><p>{activeUser.name} ({activeUser.id}) · {assigned.length} assigned problem houses · source: {dataSource==='OSM_BUILDING_REFERENCE'?'live aligned building reference':'synthetic demo geometry'}.</p></div><Badge tone="blue">SURVEYOR SIGNED IN</Badge></div>
    {submissionNotice&&<div className="success-note survey-submit-success">✓ {submissionNotice}</div>}

    <SurveyorQueueMap parcels={assigned} selectedParcelId={active.id} onSelect={selectParcel}/>

    <div className="surveyor-layout">
      <aside className="task-queue"><h3>Assigned verification tasks ({assigned.length})</h3>{assigned.map((p) => {
        const decision = decideRoute(p);
        return <button className={active.id===p.id?'selected':''} onClick={()=>selectParcel(p.id)} key={p.id}><div><strong>{houseLabel(p.id)} · {p.id}</strong><span>{p.address}</span><span>{screenHouse(p).issue}</span></div><Badge tone={decision.route==='DEEP_VERIFY'?'red':'amber'}>{p.confidence.total}%</Badge></button>
      })}</aside>
      <main className="field-workspace">
        <section className="phone-card field-summary">
          <div className="phone-top"><div><small>Selected AI-flagged house</small><h2>{houseLabel(active.id)} <span className="muted-id">{active.id}</span></h2><p>{active.address}</p></div><Badge tone={route.route==='DEEP_VERIFY'?'red':'amber'}>{requirements.label}</Badge></div>
          <div className="route-summary-grid">
            <div><span>AI confidence</span><strong>{active.confidence.total}%</strong></div>
            <div><span>Field route</span><strong>{fieldRouteLabel}</strong></div>
            <div><span>Distance</span><strong>{distance} m</strong></div>
            <div><span>Map zoom</span><strong>{zoom.toFixed(0)}</strong></div>
          </div>
          <div className="field-problem-banner"><strong>Problem found by area screening</strong><span>{screening.issue}</span></div>
          <p className="route-explanation">{route.reason}</p>
        </section>

        <SurveyorMap
          parcel={active}
          position={position}
          onZoomChange={setZoom}
          workingFootprint={workingFootprint}
          onFootprintChange={(geometry) => {
            setWorkingFootprint(geometry);
            setFootprintEdited(true);
            if (analysisComplete) setAnalysisMessage('Field AI re-analysis remains complete. Precision vertex correction is attached separately for Supervisor review.');
          }}
        />

        <section className="phone-card geometry-correction-card">
          <div className="section-head"><div><small>Geometry correction</small><h3>Align the footprint to the visible roof</h3><p><strong>Precision mode:</strong> drag the numbered cyan points directly on the map to match each visible roof corner. Use the controls below only for small whole-footprint adjustments. Purple remains the original AI/reference outline.</p></div><Badge tone={footprintEdited?'purple':'slate'}>{footprintEdited?'EDITED':'AI ORIGINAL'}</Badge></div>
          <div className="geometry-editor">
            <div className="nudge-pad">
              <button onClick={()=>moveFootprint(0,0.25)} title="Move north 0.25 m"><ArrowUp size={16}/></button>
              <button onClick={()=>moveFootprint(-0.25,0)} title="Move west 0.25 m"><ArrowLeft size={16}/></button>
              <button onClick={()=>resetFootprint()} title="Reset AI footprint"><RotateCcw size={16}/></button>
              <button onClick={()=>moveFootprint(0.25,0)} title="Move east 0.25 m"><ArrowRight size={16}/></button>
              <button onClick={()=>moveFootprint(0,-0.25)} title="Move south 0.25 m"><ArrowDown size={16}/></button>
            </div>
            <div className="size-controls">
              <button className="secondary" onClick={()=>resizeFootprint(1.01,1)}>Width +1%</button>
              <button className="secondary" onClick={()=>resizeFootprint(0.99,1)}>Width −1%</button>
              <button className="secondary" onClick={()=>resizeFootprint(1,1.01)}>Height +1%</button>
              <button className="secondary" onClick={()=>resizeFootprint(1,0.99)}>Height −1%</button>
            </div>
            <div className="geometry-readout"><span>AI area</span><strong>{active.detectedAreaSqM} m²</strong><span>Working field area</span><strong>{correctedArea} m²</strong><span className={largeGeometryChange?'area-warning':''}>Area change</span><strong className={largeGeometryChange?'area-warning':''}>{areaDeltaPct>0?'+':''}{areaDeltaPct}%</strong></div>
          </div>
          <div className="precision-help">Drag each numbered cyan point onto the matching visible roof corner. If the working area changes by more than ±30%, reset and edit the individual vertices instead of repeatedly resizing the whole footprint.</div>
          <p className="legal-note">This correction is a field draft for supervisor review. It does not create or decide a legal parcel boundary.</p>
        </section>

        <section className="phone-card">
          <div className="inspection-readiness">
            <div><strong>Field analysis readiness</strong><span>{analysisReady?'READY':'NOT READY'}</span></div>
            <ul>
              <li className={locationReady?'ok':'warn'}><Crosshair size={14}/>Location: {distance} m from target · required ≤ {requirements.maxDistanceMeters} m</li>
              <li className={zoomReady?'ok':'warn'}><ScanLine size={14}/>Inspection zoom: {zoom} · required ≥ 20</li>
              <li><Camera size={14}/>Imagery resolution still depends on the selected source layer; zoom alone does not create new image detail.</li>
            </ul>
          </div>

          <div className="gps-actions">
            <button className="secondary" onClick={useDeviceLocation}><LocateFixed size={16}/>Use my GPS</button>
            <button className="secondary" onClick={useDemoLocation}><Crosshair size={16}/>Use demo field position</button>
            <span>{gpsMode==='DEVICE'?'Device GPS':'Demo GPS'}{gpsAccuracy!==null?` · ±${gpsAccuracy} m`:''}</span>
          </div>

          <button className="primary full" disabled={!analysisReady || analysisRunning} onClick={runFieldAnalysis}><ScanLine size={16}/>{analysisRunning?'Running field AI re-analysis…':'Run field AI re-analysis'}</button>
          {analysisMessage && <div className="analysis-note">{analysisMessage}</div>}
          {!analysisComplete && <div className="analysis-note optional-ai-note">Field AI re-analysis is recommended for an additional comparison signal, but it is not required to submit verified GPS, photos and field remarks to the Supervisor.</div>}

          <div className="field-grid">
            <label><span><TimerReset size={15}/>Verification duration (min)</span><input type="number" min="1" value={duration} onChange={e=>setDuration(Number(e.target.value))}/><small>{duration<3?'Unusually short — supervisor review signal':'Duration recorded as evidence metadata'}</small></label>
            <label><span><Camera size={15}/>Required photos</span><input value={`${photos.length} / ${requirements.minPhotos} minimum`} readOnly/><small>{requirements.requiresBoundaryReview?'Detailed boundary review required':'Targeted evidence is sufficient when complete'}</small></label>
          </div>

          <div className="evidence-box"><div><Camera size={18}/><strong>Evidence files</strong></div><div className="photo-chips">{photos.map(p=><span key={p}>{p}</span>)}</div><button className="secondary" onClick={()=>setPhotos(current=>[...current,`field-${current.length+1}.jpg`])}>Add demo photo</button></div>
          <label className="remarks"><span>Field remarks</span><textarea value={remarks} onChange={e=>setRemarks(e.target.value)} rows={4}/></label>

          <div className="submission-checks">
            <span className={analysisComplete?'ok':'optional'}>{analysisComplete?'✓':'○'} Field AI re-analysis {analysisComplete?'completed':'optional · not run'}</span>
            <span className={locationReady?'ok':'warn'}>{locationReady?'✓':'•'} Location requirement</span>
            <span className={evidenceReady?'ok':'warn'}>{evidenceReady?'✓':'•'} Evidence requirement</span>
            {footprintEdited&&<span className="ok">✓ Footprint correction attached</span>}
          </div>
          {message&&<div className="success-note">{message}</div>}
        </section>

        <section className={`phone-card submit-gate-card ${canSubmit?'ready':''}`}>
          <div>
            <small>Final field action</small>
            <h3>Submit {houseLabel(active.id)} to Supervisor</h3>
            <p>{canSubmit
              ? 'Required GPS and field evidence are complete. This house can now be sent to the Supervisor review queue.'
              : 'Complete the remaining required GPS/evidence checks below to unlock submission.'}</p>
            <div className="submission-checks">
              <span className={analysisComplete?'ok':'optional'}>{analysisComplete?'✓':'○'} Field AI re-analysis {analysisComplete?'complete':'optional · not run'}</span>
              <span className={locationReady?'ok':'warn'}>{locationReady?'✓':'•'} Location {locationReady?'verified':`must be within ${requirements.maxDistanceMeters} m`}</span>
              <span className={photos.length >= requirements.minPhotos?'ok':'warn'}>{photos.length >= requirements.minPhotos?'✓':'•'} Photos {photos.length} / {requirements.minPhotos}</span>
              <span className={remarks.trim().length >= 8?'ok':'warn'}>{remarks.trim().length >= 8?'✓':'•'} Field remarks</span>
              {footprintEdited&&<span className="ok">✓ Surveyor footprint correction attached</span>}
            </div>
          </div>
          <button className={`primary ${canSubmit?'':'submit-locked'}`} aria-disabled={!canSubmit} onClick={submit}><Send size={16}/>{canSubmit?'Submit to Supervisor':'Check requirements'}</button>
        </section>
      </main>
    </div>
  </div>;
}
