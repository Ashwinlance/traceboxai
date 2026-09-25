import { useMemo, useState } from 'react';
import { useParcels } from '../../store/parcelContext';
import { Badge } from '../common/Badge';
import { houseLabel } from '../gis/GISMap';
import { screenHouse } from '../../services/areaAnalysisService';

function screeningTone(status: ReturnType<typeof screenHouse>['status']) {
  if (status === 'NO_MAJOR_ISSUE') return 'green' as const;
  if (status === 'NEEDS_VERIFICATION') return 'amber' as const;
  return 'red' as const;
}

export function Sidebar() {
  const { parcels, selectedParcelId, selectParcel, areaAnalysisComplete, dataSource } = useParcels();
  const [filter, setFilter] = useState<'ALL'|'PROBLEMS'>('ALL');
  const problemCount = useMemo(() => parcels.filter((p) => screenHouse(p).status !== 'NO_MAJOR_ISSUE').length, [parcels]);
  const hasMappedGeometry = areaAnalysisComplete || dataSource === 'OSM_BUILDING_REFERENCE';
  const mappedCount = hasMappedGeometry ? parcels.length : 0;
  const visibleParcels = !hasMappedGeometry
    ? []
    : filter === 'PROBLEMS' && areaAnalysisComplete
      ? parcels.filter((p) => screenHouse(p).status !== 'NO_MAJOR_ISSUE')
      : parcels;

  return <aside className="sidebar">
    <div className="sidebar-title"><span>Area houses</span><small>{mappedCount} mapped</small></div>
    <div className="sidebar-filter">
      <button className={filter==='ALL'?'active':''} onClick={()=>setFilter('ALL')}>All {mappedCount}</button>
      <button className={filter==='PROBLEMS'?'active':''} onClick={()=>setFilter('PROBLEMS')} disabled={!areaAnalysisComplete}>Problems {areaAnalysisComplete?problemCount:'—'}</button>
    </div>
    <div className="parcel-list">{!hasMappedGeometry && <div className="sidebar-empty">Run area analysis to map houses.</div>}{visibleParcels.map((p) => {
      const result = screenHouse(p);
      return <button key={p.id} className={`parcel-row ${selectedParcelId===p.id?'selected':''}`} onClick={() => selectParcel(p.id)}>
        <div><strong>{houseLabel(p.id)} <small>{p.id}</small></strong><span>{p.address}</span></div><Badge tone={areaAnalysisComplete?screeningTone(result.status):'slate'}>{areaAnalysisComplete?result.label:'UNSCREENED'}</Badge>
      </button>;
    })}</div>
  </aside>;
}
