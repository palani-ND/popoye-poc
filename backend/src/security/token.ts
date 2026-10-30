import { randomBytes } from 'node:crypto';

/**
 * Generate a cryptographically secure, unpredictable payment token.
 * 256 bits of CSPRNG entropy — no PII, no DB IDs, not derived from order IDs.
 */
export function generatePaymentToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Normalize a vehicle number: uppercase, strip spaces. */
export function normalizeVehicleNumber(vehicleNumber: string): string {
  return vehicleNumber.replace(/\s+/g, '').toUpperCase();
}
