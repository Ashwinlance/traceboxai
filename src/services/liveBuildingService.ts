import type { PolygonGeometry } from '../types/gis';
import type { ParcelRecord } from '../types/parcel';
import { polygonAreaSqM, polygonCentroid, scalePolygon } from './geometryEditService';

const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';

interface OverpassGeometryPoint { lat: number; lon: number }
interface OverpassElement {
  id: number;
  type: string;
  geometry?: OverpassGeometryPoint[];
  tags?: Record<string, string>;
}
interface OverpassResponse { elements?: OverpassElement[] }

function normalizeRing(points: OverpassGeometryPoint[]): PolygonGeometry | null {
  const coords = points.map((point) => [point.lat, point.lon] as [number, number]);
  if (coords.length < 3) return null;
  const first = coords[0];
  const last = coords[coords.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) coords.pop();
  return coords.length >= 3 ? { coordinates: coords } : null;
}

function footprintDimensionsMeters(geometry: PolygonGeometry) {
  const [centerLat] = polygonCentroid(geometry);
  const metersPerDegreeLng = 111_320 * Math.cos(centerLat * Math.PI / 180);
  const lats = geometry.coordinates.map(([lat]) => lat);
  const lngs = geometry.coordinates.map(([, lng]) => lng);
  return {
    width: (Math.max(...lngs) - Math.min(...lngs)) * metersPerDegreeLng,
    height: (Math.max(...lats) - Math.min(...lats)) * 111_320
  };
}

const EXCLUDED_BUILDING_TYPES = new Set([
  'roof', 'shed', 'garage', 'garages', 'carport', 'greenhouse', 'hut',
  'industrial', 'warehouse', 'commercial', 'retail', 'school', 'hospital',
  'church', 'mosque', 'temple', 'train_station', 'service'
]);

/**
 * Reference-footprint quality gate used by the MVP before a mapped OSM polygon is
 * treated as a candidate house. This prevents road/highway geometry, tiny sheds,
 * roof-only structures and extreme sliver polygons from entering the house scan.
 * It is still reference alignment, not imagery AI inference or cadastral truth.
 */
export function isLikelyHouseCandidate(
  footprint: PolygonGeometry,
  tags: Record<string, string> = {}
): boolean {
  if (tags.highway || tags['area:highway']) return false;
  const building = (tags.building ?? '').toLowerCase();
  if (!building || building === 'no' || EXCLUDED_BUILDING_TYPES.has(building)) return false;

  const area = polygonAreaSqM(footprint);
  if (area < 25 || area > 1_500) return false;

  const { width, height } = footprintDimensionsMeters(footprint);
  if (width < 3 || height < 3) return false;
  const ratio = Math.max(width, height) / Math.max(0.1, Math.min(width, height));
  if (ratio > 5.5) return false;

  return true;
}

function updateFeatureAreas(template: ParcelRecord, detectedAreaSqM: number, existingAreaSqM: number) {
  return template.features.map((feature) => {
    if (feature.name.toLowerCase().includes('building') || feature.name.toLowerCase().includes('footprint')) {
      return {
        ...feature,
        expected: `${existingAreaSqM} sq.m`,
        detected: `${detectedAreaSqM} sq.m`
      };
    }
    return feature;
  });
}

function alignTemplate(
  template: ParcelRecord,
  footprint: PolygonGeometry,
  index: number,
  osmId: number,
  tags?: Record<string, string>
): ParcelRecord {
  const detectedAreaSqM = Math.max(1, Math.round(polygonAreaSqM(footprint)));
  const hasConflict = template.features.some((feature) => feature.status === 'CONFLICT');
  const hasUnobservable = template.features.some((feature) => feature.status === 'NOT_OBSERVABLE');
  const existingAreaSqM = hasConflict
    ? Math.max(1, Math.round(detectedAreaSqM * 0.76))
    : hasUnobservable
      ? Math.max(1, Math.round(detectedAreaSqM * 0.98))
      : Math.max(1, Math.round(detectedAreaSqM * (0.99 + (index % 3) * 0.005)));

  const [lat, lng] = polygonCentroid(footprint);
  const street = tags?.['addr:street'];
  const number = tags?.['addr:housenumber'];
  const liveAddress = [number, street].filter(Boolean).join(' ');
  const id = `PROP-${101 + index}`;

  return {
    ...template,
    id,
    address: liveAddress || `Mapped building near ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    detectedAreaSqM,
    existingAreaSqM,
    buildingFootprint: footprint,
    referenceBoundary: scalePolygon(footprint, 1.20),
    aiBoundary: scalePolygon(footprint, hasConflict ? 1.28 : 1.22),
    features: updateFeatureAreas(template, detectedAreaSqM, existingAreaSqM).map((feature, featureIndex) => ({
      ...feature,
      id: `${id}-f${featureIndex + 1}`
    })),
    routingReason: `Reference-aligned building candidate ${osmId} near ${lat.toFixed(5)}, ${lng.toFixed(5)}. House screening is simulated for the MVP; the polygon is not a legal parcel boundary.`
  };
}

export async function fetchAlignedBuildingParcels(
  templates: ParcelRecord[],
  center: [number, number] = [13.0417, 80.2367],
  radiusMeters = 320
): Promise<ParcelRecord[]> {
  const query = `[out:json][timeout:25];way["building"](around:${radiusMeters},${center[0]},${center[1]});out geom;`;
  const url = `${OVERPASS_ENDPOINT}?data=${encodeURIComponent(query)}`;
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Live building reference request failed (${response.status}).`);
  const payload = await response.json() as OverpassResponse;

  const footprints = (payload.elements ?? [])
    .filter((element) => element.type === 'way' && element.geometry && element.geometry.length >= 4)
    .map((element) => ({ element, footprint: normalizeRing(element.geometry ?? []) }))
    .filter((item): item is { element: OverpassElement; footprint: PolygonGeometry } => Boolean(item.footprint))
    .filter(({ element, footprint }) => isLikelyHouseCandidate(footprint, element.tags ?? {}))
    .sort((a, b) => {
      const [aLat, aLng] = polygonCentroid(a.footprint);
      const [bLat, bLng] = polygonCentroid(b.footprint);
      return bLat - aLat || aLng - bLng;
    });

  if (footprints.length < 8) {
    throw new Error('Not enough residential building footprints were returned for this analysis area.');
  }

  return footprints.map(({ element, footprint }, index) => {
    const template = templates[index % templates.length];
    return alignTemplate(template, footprint, index, element.id, element.tags);
  });
}
