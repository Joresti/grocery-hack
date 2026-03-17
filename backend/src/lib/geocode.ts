import { logger } from './logger.js';

export async function geocode(postalCode: string): Promise<{ lat: number; lng: number }> {
  // Hamilton-area fallback for pre-MVP
  logger.info('[GEOCODE MOCK] Using Hamilton default', { postalCode });
  return { lat: 43.2557, lng: -79.8711 };
}
