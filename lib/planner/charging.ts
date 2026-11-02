import type { VehicleProfile } from '@/lib/types';

/**
 * DC charging curve (piecewise linear):
 *   10–50%: 100% of min(carMaxKw, chargerKw)
 *   50–80%: 70%
 *   80–100%: 30%  (1.8x time penalty if > 80% needed)
 *
 * AC: constant at min(carAcKw, chargerKw)
 */

interface ChargingResult {
  minutes: number;
  kwh: number;
  costInr: number;
}

const INR_PER_KWH = 18; // approx average public rate India 2024

export function dcChargeTime(
  fromSoc: number,   // 0..1
  toSoc: number,     // 0..1
  vehicle: VehicleProfile,
  chargerKw: number,
): ChargingResult {
  if (toSoc <= fromSoc) return { minutes: 0, kwh: 0, costInr: 0 };

  const usableKwh = vehicle.usableKwh;
  const effKw = Math.min(vehicle.maxDcKw, chargerKw);

  let minutes = 0;
  let kwh = 0;

  // 10%–50% at 100%
  const seg1From = Math.max(fromSoc, 0.10);
  const seg1To   = Math.min(toSoc,  0.50);
  if (seg1To > seg1From) {
    const k = effKw * 1.00;
    const h = ((seg1To - seg1From) * usableKwh) / k;
    minutes += h * 60;
    kwh     += (seg1To - seg1From) * usableKwh;
  }

  // 50%–80% at 70%
  const seg2From = Math.max(fromSoc, 0.50);
  const seg2To   = Math.min(toSoc,   0.80);
  if (seg2To > seg2From) {
    const k = effKw * 0.70;
    const h = ((seg2To - seg2From) * usableKwh) / k;
    minutes += h * 60;
    kwh     += (seg2To - seg2From) * usableKwh;
  }

  // 80%–100% at 30% (1.8x penalty for planning)
  const seg3From = Math.max(fromSoc, 0.80);
  const seg3To   = Math.min(toSoc,   1.00);
  if (seg3To > seg3From) {
    const k = effKw * 0.30;
    const h = ((seg3To - seg3From) * usableKwh) / k;
    minutes += h * 60 * 1.8; // planning penalty
    kwh     += (seg3To - seg3From) * usableKwh;
  }

  return { minutes: Math.round(minutes), kwh, costInr: Math.round(kwh * INR_PER_KWH) };
}

export function acChargeTime(
  fromSoc: number,
  toSoc: number,
  vehicle: VehicleProfile,
  chargerKw: number,
): ChargingResult {
  if (toSoc <= fromSoc) return { minutes: 0, kwh: 0, costInr: 0 };

  const usableKwh = vehicle.usableKwh;
  const effKw = Math.min(vehicle.maxAcKw, chargerKw);
  const kwh = (toSoc - fromSoc) * usableKwh;
  const minutes = Math.round((kwh / effKw) * 60);
  return { minutes, kwh, costInr: Math.round(kwh * INR_PER_KWH) };
}

export function chargeTime(
  fromSoc: number,
  toSoc: number,
  vehicle: VehicleProfile,
  chargerKw: number,
  isDC: boolean,
): ChargingResult {
  return isDC
    ? dcChargeTime(fromSoc, toSoc, vehicle, chargerKw)
    : acChargeTime(fromSoc, toSoc, vehicle, chargerKw);
}
