import type { LatLngTuple, PolygonGeometry } from '../types/gis';

const METERS_PER_DEGREE_LAT = 111_320;

export function polygonCentroid(geometry: PolygonGeometry): LatLngTuple {
  const points = geometry.coordinates;
  const lat = points.reduce((sum, point) => sum + point[0], 0) / points.length;
  const lng = points.reduce((sum, point) => sum + point[1], 0) / points.length;
  return [lat, lng];
}

export function polygonAreaSqM(geometry: PolygonGeometry): number {
  const points = geometry.coordinates;
  if (points.length < 3) return 0;
  const [centerLat, centerLng] = polygonCentroid(geometry);
  const metersPerDegreeLng = METERS_PER_DEGREE_LAT * Math.cos(centerLat * Math.PI / 180);
  const xy = points.map(([lat, lng]) => [
    (lng - centerLng) * metersPerDegreeLng,
    (lat - centerLat) * METERS_PER_DEGREE_LAT
  ] as const);
  let twiceArea = 0;
  for (let i = 0; i < xy.length; i += 1) {
    const [x1, y1] = xy[i];
    const [x2, y2] = xy[(i + 1) % xy.length];
    twiceArea += x1 * y2 - x2 * y1;
  }
  return Math.abs(twiceArea) / 2;
}

export function nudgePolygonMeters(
  geometry: PolygonGeometry,
  eastMeters: number,
  northMeters: number
): PolygonGeometry {
  const [centerLat] = polygonCentroid(geometry);
  const metersPerDegreeLng = METERS_PER_DEGREE_LAT * Math.cos(centerLat * Math.PI / 180);
  const dLat = northMeters / METERS_PER_DEGREE_LAT;
  const dLng = eastMeters / metersPerDegreeLng;
  return {
    coordinates: geometry.coordinates.map(([lat, lng]) => [lat + dLat, lng + dLng])
  };
}

export function scalePolygon(geometry: PolygonGeometry, factor: number): PolygonGeometry {
  const [centerLat, centerLng] = polygonCentroid(geometry);
  return {
    coordinates: geometry.coordinates.map(([lat, lng]) => [
      centerLat + (lat - centerLat) * factor,
      centerLng + (lng - centerLng) * factor
    ])
  };
}

export function scalePolygonAnisotropic(
  geometry: PolygonGeometry,
  widthFactor: number,
  heightFactor: number
): PolygonGeometry {
  const [centerLat, centerLng] = polygonCentroid(geometry);
  return {
    coordinates: geometry.coordinates.map(([lat, lng]) => [
      centerLat + (lat - centerLat) * heightFactor,
      centerLng + (lng - centerLng) * widthFactor
    ])
  };
}

export function updatePolygonVertex(
  geometry: PolygonGeometry,
  index: number,
  next: LatLngTuple
): PolygonGeometry {
  if (index < 0 || index >= geometry.coordinates.length) return geometry;
  return {
    coordinates: geometry.coordinates.map((point, pointIndex) => pointIndex === index ? next : point)
  };
}
