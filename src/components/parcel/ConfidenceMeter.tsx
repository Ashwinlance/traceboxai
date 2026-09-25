import type { ConfidenceBreakdown } from '../../types/parcel';
import { Badge } from '../common/Badge';

export function ConfidenceMeter({ confidence }: { confidence: ConfidenceBreakdown }) {
  const tone = confidence.band==='HIGH'?'green':confidence.band==='MEDIUM'?'amber':'red';
  const rows = [
    ['AI detection',confidence.aiDetection,25],['Feature match',confidence.featureMatch,30],['Boundary geometry',confidence.boundaryMatch,25],['Imagery quality',confidence.imageryQuality,10],['Record consistency',confidence.recordConsistency,10]
  ] as const;
  return <section className="card">
    <div className="section-head"><div><small>Explainable confidence</small><h3>{confidence.total}% <Badge tone={tone}>{confidence.band}</Badge></h3></div></div>
    <div className="confidence-bar"><div style={{width:`${confidence.total}%`}}/></div>
    <div className="score-grid">{rows.map(([label,value,max]) => <div key={label}><span>{label}</span><strong>{value}/{max}</strong></div>)}</div>
    <p className="legal-note">Confidence is an AI evidence measure, not a legal ownership or approval decision.</p>
  </section>;
}
