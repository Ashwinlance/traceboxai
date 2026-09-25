import { Fragment, useEffect, useState } from 'react';
import { LayersControl, MapContainer, Polygon, Popup, ScaleControl, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useParcels } from '../../store/parcelContext';
import type { ParcelRecord } from '../../types/parcel';
import { screenHouse, type HouseScreeningStatus } from '../../services/areaAnalysisService';

const center: [number, number] = [13.0417,80.2367];

export function houseLabel(parcelId: string) {
  const numeric = Number(parcelId.replace(/\D/g, '')) - 100;
  return `H-${String(Math.max(1, numeric)).padStart(3, '0')}`;
}

function detailPathOptions(kind: 'reference'|'ai'|'building'|'corrected'|'approved') {
  if (kind==='reference') return { color:'#2563eb', weight:3, fillOpacity:0.03 };
  if (kind==='ai') return { color:'#f59e0b', weight:3, dashArray:'5 5', fillOpacity:0.08 };
  if (kind==='approved') return { color:'#16a34a', weight:4, fillOpacity:0.16 };
  if (kind==='corrected') return { color:'#06b6d4', weight:4, dashArray:'8 4', fillOpacity:0.14 };
  return { color:'#7c3aed', weight:3, fillOpacity:0.18 };
}

function screeningColor(status: HouseScreeningStatus) {
  if (status === 'NO_MAJOR_ISSUE') return '#16a34a';
  if (status === 'NEEDS_VERIFICATION') return '#eab308';
  if (status === 'MAJOR_CONFLICT') return '#f97316';
  return '#dc2626';
}

function AllHousesViewport({ parcels }: { parcels: ParcelRecord[] }) {
  const map = useMap();
  useEffect(() => {
    const points = parcels.flatMap((parcel) => parcel.buildingFootprint.coordinates);
    if (points.length) map.fitBounds(points, { padding: [42, 42], maxZoom: 18, animate: true });
  }, [map, parcels]);
  return null;
}

function SelectedParcelViewport({ parcel, correctedFootprint }: { parcel: ParcelRecord; correctedFootprint?: { coordinates: [number, number][] } }) {
  const map = useMap();
  useEffect(() => {
    const points = [
      ...parcel.referenceBoundary.coordinates,
      ...(parcel.approvedBoundary ?? parcel.aiBoundary).coordinates,
      ...parcel.buildingFootprint.coordinates,
      ...(parcel.approvedFootprint?.coordinates ?? []),
      ...(correctedFootprint?.coordinates ?? [])
    ];
    map.fitBounds(points, { padding: [36, 36], maxZoom: 21, animate: true });
  }, [map, parcel, correctedFootprint]);
  return null;
}


function AllHouseLayer({ parcels, selectedParcelId, areaAnalysisComplete, onSelect }: {
  parcels: ParcelRecord[];
  selectedParcelId: string;
  areaAnalysisComplete: boolean;
  onSelect: (id: string) => void;
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });
  const showPermanentLabels = zoom >= 19;

  return <>{parcels.map((parcel) => {
    const screening = screenHouse(parcel);
    const selected = parcel.id === selectedParcelId;
    const color = areaAnalysisComplete ? screeningColor(screening.status) : '#64748b';
    return <Polygon
      key={parcel.id}
      positions={parcel.buildingFootprint.coordinates}
      pathOptions={{
        color,
        weight: selected ? 4.5 : zoom >= 19 ? 2.2 : 1.4,
        fillColor: color,
        fillOpacity: selected ? 0.34 : zoom >= 19 ? 0.19 : 0.11
      }}
      eventHandlers={{ click: () => onSelect(parcel.id) }}
    >
      <Tooltip permanent={showPermanentLabels || selected} direction="center" className="house-id-tooltip">{houseLabel(parcel.id)}</Tooltip>
      <Popup>
        <strong>{houseLabel(parcel.id)} · {parcel.id}</strong><br/>
        {areaAnalysisComplete
          ? <>{screening.label}<br/>{screening.issue}<br/>Confidence {parcel.confidence.total}%</>
          : <>Waiting for area AI screening</>}
      </Popup>
    </Polygon>;
  })}</>;
}

export function MapBaseLayers() {
  return <LayersControl position="topright">
    <LayersControl.BaseLayer checked name="Satellite imagery">
      <TileLayer
        attribution="Tiles &copy; Esri"
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        maxNativeZoom={19}
        maxZoom={22}
      />
    </LayersControl.BaseLayer>
    <LayersControl.BaseLayer name="Street map">
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxNativeZoom={19}
        maxZoom={22}
      />
    </LayersControl.BaseLayer>
    <LayersControl.BaseLayer name="Terrain / topographic context">
      <TileLayer
        attribution='Map data &copy; OpenStreetMap contributors, SRTM | Map style &copy; OpenTopoMap'
        url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
        maxNativeZoom={17}
        maxZoom={22}
      />
    </LayersControl.BaseLayer>
  </LayersControl>;
}

export function GISMap({ compact = false, showAll = true }: { compact?: boolean; showAll?: boolean }) {
  const { parcels, selectedParcel, selectParcel, areaAnalysisComplete, dataSource, evidences } = useParcels();
  const selectedEvidence = evidences.find((item) => item.parcelId === selectedParcel.id);
  const mappedParcels = areaAnalysisComplete || dataSource === 'OSM_BUILDING_REFERENCE' ? parcels : [];

  return <div className={`map-card ${compact?'compact-map-card':''}`}>
    <div className="map-legend">
      {showAll ? <>
        <span><i className="legend green"/>No major issue</span>
        <span><i className="legend yellow"/>Needs verification</span>
        <span><i className="legend orange"/>Major conflict</span>
        <span><i className="legend red"/>Complex case</span>
      </> : <>
        <span><i className="legend blue"/>Existing GIS parcel</span>
        <span><i className="legend amber"/>AI candidate boundary</span>
        <span><i className="legend purple"/>AI building footprint</span>
        {selectedEvidence?.correctedFootprint && <span><i className="legend cyan"/>Surveyor correction</span>}
        <span><i className="legend green"/>Supervisor approved</span>
      </>}
    </div>
    <div className="map-demo-note">
      {showAll
        ? areaAnalysisComplete
          ? dataSource === 'OSM_BUILDING_REFERENCE'
            ? `Area screening complete: ${parcels.length} live-aligned building footprints are screened. Geometry is sourced from OpenStreetMap reference data for visual alignment; screening remains a prototype simulation.`
            : `Dense area screening complete: all ${parcels.length} synthetic house detections are mapped. Zoom to 19+ for permanent H-ID labels; click any footprint to inspect it.`
          : dataSource === 'OSM_BUILDING_REFERENCE'
            ? 'Live building reference footprints are loaded. Run area AI mapping to apply the confidence/problem-routing workflow.'
            : 'No house footprints are shown yet. Run area analysis to load filtered building-reference geometry; the app no longer presents the old synthetic grid as detected houses.'
        : dataSource === 'OSM_BUILDING_REFERENCE'
          ? 'Building geometry is live-aligned reference data. Surveyor corrections and supervisor decisions remain workflow drafts, not legal cadastral boundaries.'
          : 'Satellite/street/terrain are context layers. Demo geometry is synthetic; a production model must derive coordinates from georeferenced imagery/GNSS.'}
    </div>
    <MapContainer center={center} zoom={17} maxZoom={22} scrollWheelZoom className={`map ${compact?'map-compact':''}`}>
      <MapBaseLayers/>
      <ScaleControl imperial={false}/>
      {showAll && mappedParcels.length ? <AllHousesViewport parcels={mappedParcels}/> : !showAll ? <SelectedParcelViewport parcel={selectedParcel} correctedFootprint={selectedEvidence?.correctedFootprint}/> : null} 

      {showAll ? <AllHouseLayer
        parcels={mappedParcels}
        selectedParcelId={selectedParcel.id}
        areaAnalysisComplete={areaAnalysisComplete}
        onSelect={selectParcel}
      /> : <Fragment>
        <Polygon positions={selectedParcel.referenceBoundary.coordinates} pathOptions={detailPathOptions('reference')} />
        <Polygon positions={(selectedParcel.approvedBoundary ?? selectedParcel.aiBoundary).coordinates} pathOptions={detailPathOptions(selectedParcel.workflowStatus==='APPROVED'?'approved':'ai')} />
        <Polygon positions={selectedParcel.buildingFootprint.coordinates} pathOptions={detailPathOptions('building')}>
          <Popup><strong>{houseLabel(selectedParcel.id)} · {selectedParcel.id}</strong><br/>Original AI building footprint<br/>{selectedParcel.detectedAreaSqM} m²</Popup>
        </Polygon>
        {selectedEvidence?.correctedFootprint && <Polygon positions={selectedEvidence.correctedFootprint.coordinates} pathOptions={detailPathOptions('corrected')}>
          <Popup><strong>Surveyor field correction</strong><br/>Submitted footprint revision for Supervisor review.</Popup>
        </Polygon>}
        {selectedParcel.workflowStatus==='APPROVED' && selectedParcel.approvedFootprint && <Polygon positions={selectedParcel.approvedFootprint.coordinates} pathOptions={detailPathOptions('approved')}>
          <Popup><strong>Supervisor-approved field footprint</strong><br/>Approved workflow geometry after human review.</Popup>
        </Polygon>}
      </Fragment>}
    </MapContainer>
  </div>;
}
