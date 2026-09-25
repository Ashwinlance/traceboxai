import { useEffect } from 'react';
import { divIcon, type LeafletEvent, type Marker as LeafletMarker } from 'leaflet';
import { CircleMarker, MapContainer, Marker, Polygon, Popup, ScaleControl, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import { MapBaseLayers } from './GISMap';
import type { ParcelRecord } from '../../types/parcel';
import type { LatLngTuple, PolygonGeometry } from '../../types/gis';
import { houseLabel } from './GISMap';
import { polygonCentroid, updatePolygonVertex } from '../../services/geometryEditService';

function pathOptions(kind: 'reference'|'ai'|'building'|'corrected') {
  if (kind==='reference') return { color:'#2563eb', weight:3, fillOpacity:0.03 };
  if (kind==='ai') return { color:'#f59e0b', weight:3, dashArray:'5 5', fillOpacity:0.08 };
  if (kind==='corrected') return { color:'#06b6d4', weight:4, dashArray:'8 4', fillOpacity:0.14 };
  return { color:'#7c3aed', weight:3, fillOpacity:0.18 };
}

const vertexIcon = divIcon({
  className: 'surveyor-vertex-marker',
  html: '<span></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9]
});

function FieldViewport({ footprint }: { footprint: PolygonGeometry }) {
  const map = useMap();
  useEffect(() => {
    map.setView(polygonCentroid(footprint), 21, { animate: true });
  }, [map, footprint]);
  return null;
}

function ZoomReporter({ onZoomChange }: { onZoomChange: (zoom: number) => void }) {
  const map = useMapEvents({ zoomend: () => onZoomChange(map.getZoom()) });
  useEffect(() => onZoomChange(map.getZoom()), [map, onZoomChange]);
  return null;
}

export function SurveyorMap({ parcel, position, onZoomChange, workingFootprint, onFootprintChange }: {
  parcel: ParcelRecord;
  position: LatLngTuple;
  onZoomChange: (zoom: number) => void;
  workingFootprint: PolygonGeometry;
  onFootprintChange: (geometry: PolygonGeometry) => void;
}) {
  const footprint = workingFootprint;
  return <div className="field-map-card">
    <div className="field-map-head">
      <strong>High-detail field inspection</strong>
      <span>z21 focus · blue dot = surveyor · drag cyan points to align roof</span>
    </div>
    <MapContainer center={polygonCentroid(footprint)} zoom={21} minZoom={18} maxZoom={22} scrollWheelZoom className="surveyor-map">
      <MapBaseLayers/>
      <ScaleControl imperial={false}/>
      <FieldViewport footprint={footprint}/>
      <ZoomReporter onZoomChange={onZoomChange}/>
      <Polygon positions={parcel.referenceBoundary.coordinates} pathOptions={{ ...pathOptions('reference'), weight: 4 }}/>
      <Polygon positions={parcel.aiBoundary.coordinates} pathOptions={{ ...pathOptions('ai'), weight: 4 }}/>
      <Polygon positions={parcel.buildingFootprint.coordinates} pathOptions={{ ...pathOptions('building'), weight: 4, fillOpacity: 0.12 }}>
        <Popup><strong>{houseLabel(parcel.id)} · {parcel.id}</strong><br/>Original AI/reference-aligned building footprint<br/>{parcel.detectedAreaSqM} m²</Popup>
      </Polygon>
      <Polygon positions={footprint.coordinates} pathOptions={pathOptions('corrected')}>
        <Popup><strong>Surveyor working footprint</strong><br/>Drag cyan numbered points to align the field draft with the visible roof.</Popup>
      </Polygon>
      {footprint.coordinates.map((point, index) => <Marker
        key={`${parcel.id}-vertex-${index}`}
        position={point}
        icon={vertexIcon}
        draggable
        eventHandlers={{
          dragend: (event: LeafletEvent) => {
            const marker = event.target as LeafletMarker;
            const next = marker.getLatLng();
            onFootprintChange(updatePolygonVertex(footprint, index, [next.lat, next.lng]));
          }
        }}
      >
        <Tooltip permanent direction="top" offset={[0,-8]} className="vertex-index-tooltip">{index + 1}</Tooltip>
      </Marker>)}
      <CircleMarker center={position} radius={8} pathOptions={{ color:'#ffffff', weight:3, fillColor:'#2563eb', fillOpacity:1 }}>
        <Popup><strong>Surveyor location</strong><br/>GPS / demo field position</Popup>
      </CircleMarker>
    </MapContainer>
  </div>;
}
