import { useEffect } from 'react';
import { MapContainer, Polygon, ScaleControl, TileLayer, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { ParcelRecord } from '../../types/parcel';
import type { PolygonGeometry } from '../../types/gis';

function FitComparison({ parcel, fieldFootprint }: { parcel: ParcelRecord; fieldFootprint?: PolygonGeometry }) {
  const map = useMap();
  useEffect(() => {
    const points = [
      ...parcel.referenceBoundary.coordinates,
      ...parcel.aiBoundary.coordinates,
      ...parcel.buildingFootprint.coordinates,
      ...(fieldFootprint?.coordinates ?? [])
    ];
    if (points.length) map.fitBounds(points, { padding: [44, 44], maxZoom: 21, animate: true });
  }, [map, parcel, fieldFootprint]);
  return null;
}

export function SurveyorChangeMap({ parcel, fieldFootprint }: { parcel: ParcelRecord; fieldFootprint?: PolygonGeometry }) {
  return <div className="supervisor-change-map-wrap">
    <div className="change-map-head">
      <div><strong>Surveyor geometry change trace</strong><span>Compare the immutable AI footprint with the Surveyor field correction.</span></div>
      <div className="change-map-legend">
        <span><i className="trace-blue"/>Existing GIS parcel</span>
        <span><i className="trace-orange"/>AI candidate boundary</span>
        <span><i className="trace-purple"/>Original AI footprint</span>
        {fieldFootprint && <span><i className="trace-cyan"/>Surveyor correction</span>}
      </div>
    </div>
    <MapContainer center={parcel.buildingFootprint.coordinates[0]} zoom={20} minZoom={17} maxZoom={22} scrollWheelZoom className="supervisor-change-map">
      <TileLayer attribution="Tiles &copy; Esri" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxNativeZoom={19} maxZoom={22}/>
      <ScaleControl imperial={false}/>
      <FitComparison parcel={parcel} fieldFootprint={fieldFootprint}/>
      <Polygon positions={parcel.referenceBoundary.coordinates} pathOptions={{ color:'#2563eb', weight:3, fillOpacity:0.02 }}/>
      <Polygon positions={parcel.aiBoundary.coordinates} pathOptions={{ color:'#f59e0b', weight:3, dashArray:'6 5', fillOpacity:0.04 }}/>
      <Polygon positions={parcel.buildingFootprint.coordinates} pathOptions={{ color:'#7c3aed', weight:4, fillOpacity:0.12 }}>
        <Tooltip sticky>Original AI footprint</Tooltip>
      </Polygon>
      {fieldFootprint && <Polygon positions={fieldFootprint.coordinates} pathOptions={{ color:'#06b6d4', weight:5, dashArray:'8 4', fillOpacity:0.20 }}>
        <Tooltip sticky>Surveyor corrected footprint</Tooltip>
      </Polygon>}
    </MapContainer>
  </div>;
}
