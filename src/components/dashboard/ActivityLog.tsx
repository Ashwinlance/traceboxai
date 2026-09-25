import { useParcels } from '../../store/parcelContext';

export function ActivityLog() {
  const { audits } = useParcels();
  return <section className="card"><div className="section-head"><div><small>Audit trail</small><h3>Recent workflow activity</h3></div></div><div className="timeline">{audits.slice(0,6).map(a=><div key={a.id}><i/><div><strong>{a.parcelId} · {a.action.replaceAll('_',' ')}</strong><span>{a.detail}</span><small>{new Date(a.at).toLocaleString()}</small></div></div>)}</div></section>
}
