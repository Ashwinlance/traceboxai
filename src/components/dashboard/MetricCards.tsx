import { useParcels } from '../../store/parcelContext';
import { screenHouse } from '../../services/areaAnalysisService';

export function MetricCards() {
  const { parcels, areaAnalysisComplete } = useParcels();
  const screened = areaAnalysisComplete ? parcels : [];
  const noIssue = screened.filter((p) => screenHouse(p).status === 'NO_MAJOR_ISSUE').length;
  const flagged = screened.filter((p) => screenHouse(p).status !== 'NO_MAJOR_ISSUE').length;
  const metrics = [
    ['AI-mapped houses',screened.length],
    ['No major issue',noIssue],
    ['Problems flagged',flagged],
    ['Field verification',parcels.filter(p=>p.workflowStatus==='SURVEY_PENDING' || p.workflowStatus==='RECHECK_REQUIRED').length],
    ['Supervisor queue',parcels.filter(p=>p.workflowStatus==='SUPERVISOR_REVIEW').length],
    ['Approved',parcels.filter(p=>p.workflowStatus==='APPROVED').length]
  ];
  return <div className="metrics">{metrics.map(([label,value])=><div className="metric-card" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>;
}
