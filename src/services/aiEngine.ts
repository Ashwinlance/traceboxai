import type { ParcelRecord } from '../types/parcel';
import { decideRoute } from './routingEngine';

export interface AiProcessingResult {
  parcelId: string;
  status: 'COMPLETED';
  detectedFeatures: number;
  message: string;
  processedAt: string;
}

export interface AreaAiProcessingResult {
  status: 'COMPLETED';
  detectedHouses: number;
  processedAt: string;
  message: string;
}

export async function simulateAiProcessing(parcel: ParcelRecord): Promise<AiProcessingResult> {
  await new Promise((resolve) => setTimeout(resolve, 450));
  const route = decideRoute(parcel);
  return {
    parcelId: parcel.id,
    status: 'COMPLETED',
    detectedFeatures: parcel.features.length + 2,
    message: `${parcel.id} re-analysis completed. ${route.route.replaceAll('_', ' ')} remains the required human workflow.`,
    processedAt: new Date().toISOString()
  };
}

export async function simulateAreaAiProcessing(parcels: ParcelRecord[]): Promise<AreaAiProcessingResult> {
  await new Promise((resolve) => setTimeout(resolve, 850));
  return {
    status: 'COMPLETED',
    detectedHouses: parcels.length,
    processedAt: new Date().toISOString(),
    message: `Area screening processed ${parcels.length} mapped house candidates and checked each one against its reference record.`
  };
}
