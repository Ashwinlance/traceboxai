import type { ParcelRecord, ConfidenceBreakdown } from '../types/parcel';
import type { AppUser } from '../types/user';

const EARTH_METERS_PER_DEGREE_LAT = 111_320;

/**
 * Build an axis-aligned demo rectangle from real-world metre dimensions.
 * These coordinates are deterministic synthetic demo geometry, not legal cadastral records.
 * Replace the demo AI engine with imagery-derived segmentation before claiming real detection accuracy.
 */
function rectangleByMeters(
  centerLat: number,
  centerLng: number,
  widthM: number,
  heightM: number,
  offsetEastM = 0,
  offsetNorthM = 0
): { coordinates: [number, number][] } {
  const metersPerDegreeLng = EARTH_METERS_PER_DEGREE_LAT * Math.cos(centerLat * Math.PI / 180);
  const lat = centerLat + offsetNorthM / EARTH_METERS_PER_DEGREE_LAT;
  const lng = centerLng + offsetEastM / metersPerDegreeLng;
  const halfLat = (heightM / 2) / EARTH_METERS_PER_DEGREE_LAT;
  const halfLng = (widthM / 2) / metersPerDegreeLng;

  return {
    coordinates: [
      [lat + halfLat, lng - halfLng],
      [lat + halfLat, lng + halfLng],
      [lat - halfLat, lng + halfLng],
      [lat - halfLat, lng - halfLng]
    ]
  };
}

function band(total: number): ConfidenceBreakdown['band'] {
  if (total < 40) return 'LOW';
  if (total < 75) return 'MEDIUM';
  return 'HIGH';
}

function confidenceFromTotal(total: number): ConfidenceBreakdown {
  const aiDetection = Math.round(total * 0.25);
  const featureMatch = Math.round(total * 0.30);
  const boundaryMatch = Math.round(total * 0.25);
  const imageryQuality = Math.round(total * 0.10);
  const recordConsistency = total - aiDetection - featureMatch - boundaryMatch - imageryQuality;
  return { aiDetection, featureMatch, boundaryMatch, imageryQuality, recordConsistency, total, band: band(total) };
}

export const users: AppUser[] = [
  { id: 'admin-1', name: 'A. Meera', role: 'ADMIN' },
  { id: 'surveyor-1', name: 'K. Arjun', role: 'SURVEYOR' },
  { id: 'supervisor-1', name: 'R. Kavitha', role: 'SUPERVISOR' }
];

function cleanParcel(
  id: string,
  ward: string,
  address: string,
  lat: number,
  lng: number,
  widthM: number,
  heightM: number,
  confidence: number
): ParcelRecord {
  const detectedAreaSqM = Math.round(widthM * heightM);
  const existingAreaSqM = Math.max(1, detectedAreaSqM - 2 + (Number(id.slice(-1)) % 3));
  return {
    id,
    ward,
    address,
    existingAreaSqM,
    detectedAreaSqM,
    referenceBoundary: rectangleByMeters(lat, lng, widthM + 8, heightM + 7),
    aiBoundary: rectangleByMeters(lat, lng, widthM + 8.2, heightM + 7.1, 0.2, 0.1),
    buildingFootprint: rectangleByMeters(lat, lng, widthM, heightM),
    features: [
      { id: `${id}-f1`, name: 'Building footprint', expected: `${existingAreaSqM} sq.m`, detected: `${detectedAreaSqM} sq.m`, status: 'MATCH', aiConfidence: Math.min(99, confidence + 2) },
      { id: `${id}-f2`, name: 'Boundary alignment', expected: 'Aligned with reference', detected: 'Aligned', status: 'MATCH', aiConfidence: Math.min(99, confidence) },
      { id: `${id}-f3`, name: 'Roof type', expected: 'Concrete', detected: 'Concrete', status: 'MATCH', aiConfidence: Math.max(82, confidence - 2) }
    ],
    confidence: confidenceFromTotal(confidence),
    workflowStatus: 'AI_DRAFT',
    routingReason: 'Waiting for area-wide AI screening.',
    priority: 'LOW'
  };
}

function targetedParcel(
  id: string,
  ward: string,
  address: string,
  lat: number,
  lng: number,
  widthM: number,
  heightM: number,
  confidence: number,
  issueName: string,
  issueDetected: string
): ParcelRecord {
  const detectedAreaSqM = Math.round(widthM * heightM);
  return {
    ...cleanParcel(id, ward, address, lat, lng, widthM, heightM, confidence),
    existingAreaSqM: detectedAreaSqM - 3,
    features: [
      { id: `${id}-f1`, name: 'Building footprint', expected: `${detectedAreaSqM - 3} sq.m`, detected: `${detectedAreaSqM} sq.m`, status: 'MATCH', aiConfidence: 88 },
      { id: `${id}-f2`, name: issueName, expected: 'Observable / consistent', detected: issueDetected, status: 'NOT_OBSERVABLE', aiConfidence: 38, note: 'Targeted field verification required' },
      { id: `${id}-f3`, name: 'Roof type', expected: 'Concrete', detected: 'Concrete', status: 'MATCH', aiConfidence: 86 }
    ],
    confidence: confidenceFromTotal(confidence),
    priority: 'MEDIUM'
  };
}

function deepConflictParcel(
  id: string,
  ward: string,
  address: string,
  lat: number,
  lng: number,
  widthM: number,
  heightM: number,
  confidence: number,
  issueName: string,
  issueDetected: string,
  offsetEastM = 2.2
): ParcelRecord {
  const detectedAreaSqM = Math.round(widthM * heightM);
  const existingAreaSqM = Math.max(1, Math.round(detectedAreaSqM * 0.75));
  const referenceWidth = widthM + 7;
  const referenceHeight = heightM + 7;
  return {
    id,
    ward,
    address,
    existingAreaSqM,
    detectedAreaSqM,
    referenceBoundary: rectangleByMeters(lat, lng, referenceWidth, referenceHeight),
    aiBoundary: rectangleByMeters(lat, lng, referenceWidth + 3, referenceHeight + 2, offsetEastM, 0.8),
    buildingFootprint: rectangleByMeters(lat, lng, widthM, heightM, 1, 0.4),
    features: [
      { id: `${id}-f1`, name: issueName, expected: `${existingAreaSqM} sq.m / reference consistent`, detected: issueDetected, status: 'CONFLICT', aiConfidence: 94, note: 'Material difference requires field verification' },
      { id: `${id}-f2`, name: 'Boundary alignment', expected: 'Within reference geometry', detected: 'Material deviation', status: 'CONFLICT', aiConfidence: 91 },
      { id: `${id}-f3`, name: 'Roof type', expected: 'Concrete', detected: 'Concrete', status: 'MATCH', aiConfidence: 90 }
    ],
    confidence: confidenceFromTotal(confidence),
    workflowStatus: 'AI_DRAFT',
    routingReason: 'Waiting for area-wide AI screening.',
    priority: 'HIGH'
  };
}

const coreParcels: ParcelRecord[] = [
  cleanParcel('PROP-101', 'Ward 14', 'North Avenue, Block A', 13.04310, 80.23640, 12, 12, 91),
  targetedParcel('PROP-102', 'Ward 14', 'Lake View Street', 13.04220, 80.23760, 11, 11, 64, 'Roof colour', 'Occluded by tree canopy'),
  {
    id: 'PROP-103', ward: 'Ward 15', address: 'Market Road Extension', existingAreaSqM: 120, detectedAreaSqM: 165,
    referenceBoundary: rectangleByMeters(13.04125, 80.23615, 22, 18),
    aiBoundary: rectangleByMeters(13.04125, 80.23615, 24, 19, 2, 1),
    buildingFootprint: rectangleByMeters(13.04125, 80.23615, 15, 11, 1.2, 0.5),
    features: [
      { id:'PROP-103-f1', name:'Building area', expected:'120 sq.m', detected:'165 sq.m', status:'CONFLICT', aiConfidence:96, note:'Possible structural extension' },
      { id:'PROP-103-f2', name:'Water tank', expected:'None', detected:'1', status:'CONFLICT', aiConfidence:92 },
      { id:'PROP-103-f3', name:'Roof type', expected:'Concrete', detected:'Concrete', status:'MATCH', aiConfidence:94 }
    ],
    confidence: { aiDetection:20, featureMatch:4, boundaryMatch:5, imageryQuality:8, recordConsistency:1, total:38, band:'LOW' },
    workflowStatus:'AI_DRAFT', routingReason:'Waiting for area-wide AI screening.', priority:'HIGH'
  },
  {
    id: 'PROP-104', ward: 'Ward 15', address: 'West Garden Lane', existingAreaSqM: 156, detectedAreaSqM: 158,
    referenceBoundary: rectangleByMeters(13.04025, 80.23745, 22, 18),
    aiBoundary: rectangleByMeters(13.04025, 80.23745, 22, 18, -2.4, 0),
    buildingFootprint: rectangleByMeters(13.04025, 80.23745, 15.8, 10),
    features: [
      { id:'PROP-104-f1', name:'West boundary', expected:'Fence aligned', detected:'Shifted approx. 2.4m', status:'CONFLICT', aiConfidence:88 },
      { id:'PROP-104-f2', name:'Roof type', expected:'Tiles', detected:'Tiles', status:'MATCH', aiConfidence:89 }
    ],
    confidence: { aiDetection:18, featureMatch:16, boundaryMatch:9, imageryQuality:8, recordConsistency:7, total:58, band:'MEDIUM' },
    workflowStatus:'AI_DRAFT', routingReason:'Waiting for area-wide AI screening.', priority:'MEDIUM'
  },
  {
    id: 'PROP-105', ward: 'Ward 16', address: 'Old Bazaar Alley', existingAreaSqM: 210, detectedAreaSqM: 238,
    referenceBoundary: rectangleByMeters(13.03920, 80.23615, 27, 22),
    aiBoundary: rectangleByMeters(13.03920, 80.23615, 31, 24, 3.5, -1),
    buildingFootprint: rectangleByMeters(13.03920, 80.23615, 17, 14, 1.5, 0),
    features: [
      { id:'PROP-105-f1', name:'Parcel overlap', expected:'No overlap', detected:'Crosses 3 historical parcel records', status:'CONFLICT', aiConfidence:93 },
      { id:'PROP-105-f2', name:'Alley boundary', expected:'Mapped alley', detected:'Boundary uncertain', status:'NOT_OBSERVABLE', aiConfidence:39 }
    ],
    confidence: { aiDetection:14, featureMatch:2, boundaryMatch:1, imageryQuality:3, recordConsistency:2, total:22, band:'LOW' },
    workflowStatus:'AI_DRAFT', routingReason:'Waiting for area-wide AI screening.', priority:'HIGH'
  }
];

const NEIGHBORHOOD_ROWS = 13;
const NEIGHBORHOOD_COLS = 7;

function generatedAddress(row: number) {
  if (row <= 2) return 'North Avenue';
  if (row <= 5) return 'Lake View Cross';
  if (row <= 8) return 'Market Road';
  if (row <= 10) return 'Garden Cross';
  return 'Bazaar Link Road';
}

/**
 * Dense deterministic neighborhood used to demonstrate an area-wide screening pass.
 * The footprints intentionally cover the whole demo extent so the UI can prove the
 * workflow "screen every detected house first, then isolate exceptions". They remain
 * synthetic geometries until a segmentation model is connected to orthomosaic imagery.
 */
const generatedNeighborhoodParcels: ParcelRecord[] = Array.from({ length: NEIGHBORHOOD_ROWS * NEIGHBORHOOD_COLS }, (_, index) => {
  const idNumber = 106 + index;
  const id = `PROP-${idNumber}`;
  const row = Math.floor(index / NEIGHBORHOOD_COLS);
  const col = index % NEIGHBORHOOD_COLS;
  const lat = 13.04338 - row * 0.00035 + (col % 2) * 0.000025;
  const lng = 80.23555 + col * 0.00034 + (row % 2) * 0.00003;
  const widthM = 9 + (index % 5);
  const heightM = 9 + ((index * 3) % 6);
  const ward = row < 4 ? 'Ward 14' : row < 9 ? 'Ward 15' : 'Ward 16';
  const address = generatedAddress(row);

  if (idNumber % 23 === 0) {
    return deepConflictParcel(
      id, ward, address, lat, lng, widthM + 2, heightM + 1, 42 + (index % 7),
      'Building footprint', 'Detected footprint materially differs from the reference geometry',
      1.8 + (index % 3) * 0.4
    );
  }

  if (idNumber % 11 === 0) {
    return targetedParcel(
      id, ward, address, lat, lng, widthM, heightM, 61 + (index % 13),
      'Boundary observability', 'One physical edge is obscured by roof overlap / tree cover'
    );
  }

  return cleanParcel(id, ward, address, lat, lng, widthM, heightM, 91 + (index % 7));
});

/**
 * 96 deterministic demo houses represent a dense area-wide screening dataset.
 * They let the MVP prove the workflow "map every detected house -> find problems -> verify only exceptions".
 * They are NOT claimed to be real detections from the basemap imagery.
 */
export const demoParcels: ParcelRecord[] = [...coreParcels, ...generatedNeighborhoodParcels];
