import type { PolygonGeometry } from '../types/gis';
import type { ParcelRecord } from '../types/parcel';
import { polygonAreaSqM, polygonCentroid, scalePolygon } from './geometryEditService';

const OVERPASS_ENDPOINTS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter'
];

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

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs = 16_000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

async function fetchOverpassPayload(query: string): Promise<OverpassResponse> {
  const attempts: string[] = [];

  // On Vercel this same-origin serverless route avoids browser CORS/rate-limit friction.
  // Under Vite dev it may 404; that is expected and we continue to public mirrors.
  try {
    const response = await fetchWithTimeout('/api/overpass', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain', Accept: 'application/json' },
      body: query
    });
    const contentType = response.headers.get('content-type') ?? '';
    if (response.ok && contentType.includes('application/json')) {
      return await response.json() as OverpassResponse;
    }
    attempts.push(`app proxy ${response.status}`);
  } catch (error) {
    attempts.push(`app proxy ${error instanceof Error ? error.message : 'failed'}`);
  }

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const body = new URLSearchParams({ data: query });
      const response = await fetchWithTimeout(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          Accept: 'application/json'
        },
        body
      });
      if (!response.ok) {
        attempts.push(`${new URL(endpoint).host} ${response.status}`);
        continue;
      }
      return await response.json() as OverpassResponse;
    } catch (error) {
      attempts.push(`${new URL(endpoint).host} ${error instanceof Error ? error.message : 'failed'}`);
    }
  }

  throw new Error(`Live building reference is temporarily unavailable. Tried ${OVERPASS_ENDPOINTS.length + 1} sources. Retry in a moment or use another network. (${attempts.join(' · ')})`);
}

export async function fetchAlignedBuildingParcels(
  templates: ParcelRecord[],
  center: [number, number] = [13.0417, 80.2367],
  radiusMeters = 320
): Promise<ParcelRecord[]> {
  const query = `[out:json][timeout:25];way["building"](around:${radiusMeters},${center[0]},${center[1]});out geom;`;
  const payload = await fetchOverpassPayload(query);

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
    throw new Error('The live reference returned too few likely-house footprints for this analysis area. Zoom/area selection or reference coverage may be insufficient.');
  }

  return footprints.map(({ element, footprint }, index) => {
    const template = templates[index % templates.length];
    return alignTemplate(template, footprint, index, element.id, element.tags);
  });
}
