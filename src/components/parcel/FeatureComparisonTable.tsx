import type { FeatureResult } from '../../types/parcel';
import { Badge } from '../common/Badge';

export function FeatureComparisonTable({ features }: { features: FeatureResult[] }) {
  return <section className="card"><div className="section-head"><div><small>Feature-wise comparison</small><h3>Physical evidence vs record</h3></div></div>
    <div className="table-wrap"><table><thead><tr><th>Feature</th><th>Reference</th><th>AI observation</th><th>Status</th><th>AI confidence</th></tr></thead><tbody>
      {features.map((f) => <tr key={f.id}><td><strong>{f.name}</strong>{f.note&&<small>{f.note}</small>}</td><td>{f.expected}</td><td>{f.detected}</td><td><Badge tone={f.status==='MATCH'?'green':f.status==='CONFLICT'?'red':'amber'}>{f.status.replace('_',' ')}</Badge></td><td>{f.aiConfidence}%</td></tr>)}
    </tbody></table></div>
  </section>;
}
