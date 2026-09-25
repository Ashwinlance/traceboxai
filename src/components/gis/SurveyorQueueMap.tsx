import { useEffect } from 'react';
import { MapContainer, Polygon, ScaleControl, Tooltip, useMap } from 'react-leaflet';
import { MapBaseLayers, houseLabel } from './GISMap';
import type { ParcelRecord } from '../../types/parcel';
import { screenHouse } from '../../services/areaAnalysisService';

function QueueViewport({ parcels }: { parcels: ParcelRecord[] }) {
  const map = useMap();
  useEffect(() => {
    const points = parcels.flatMap((parcel) => parcel.buildingFootprint.coordinates);
    if (points.length) map.fitBounds(points, { padding: [32, 32], maxZoom: 18, animate: true });
  }, [map, parcels]);
  return null;
}

function colorFor(parcel: ParcelRecord) {
  const status = screenHouse(parcel).status;
  if (status === 'NEEDS_VERIFICATION') return '#eab308';
  if (status === 'MAJOR_CONFLICT') return '#f97316';
  if (status === 'COMPLEX_CASE') return '#dc2626';
  return '#16a34a';
}

export function SurveyorQueueMap({ parcels, selectedParcelId, onSelect }: {
  parcels: ParcelRecord[];
  selectedParcelId: string;
  onSelect: (id: string) => void;
}) {
  const center = parcels[0]?.buildingFootprint.coordinates[0] ?? [13.0417, 80.2367];
  return <div className="field-map-card surveyor-overview-card">
    <div className="field-map-head"><strong>All assigned problem houses</strong><span>{parcels.length} field tasks · click a footprint to inspect</span></div>
    <MapContainer center={center} zoom={16} maxZoom={22} scrollWheelZoom className="surveyor-overview-map">
      <MapBaseLayers/>
      <ScaleControl imperial={false}/>
      <QueueViewport parcels={parcels}/>
      {parcels.map((parcel) => {
        const selected = parcel.id === selectedParcelId;
        const color = colorFor(parcel);
        return <Polygon
          key={parcel.id}
          positions={parcel.buildingFootprint.coordinates}
          pathOptions={{ color, weight:selected?4:2, fillColor:color, fillOpacity:selected?0.42:0.20 }}
          eventHandlers={{ click:()=>onSelect(parcel.id) }}
        >
          <Tooltip permanent={selected} direction="center" className="house-id-tooltip">{houseLabel(parcel.id)}</Tooltip>
        </Polygon>;
      })}
    </MapContainer>
  </div>;
}
