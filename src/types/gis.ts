export type LatLngTuple = [number, number];

export interface PolygonGeometry {
  coordinates: LatLngTuple[];
}

export interface GeometryRevision {
  id: string;
  parcelId: string;
  before: PolygonGeometry;
  after: PolygonGeometry;
  changedBy: string;
  reason: string;
  createdAt: string;
}
