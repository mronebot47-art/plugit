export function calculateChargingTimeMin(
  startSocPct: number,
  targetSocPct: number,
  batteryCapacityKwh: number,
  chargerKw: number,
  vehicleMaxKw: number
): number {
  if (targetSocPct <= startSocPct) return 0;

  const effectiveMaxKw = Math.min(chargerKw, vehicleMaxKw);
  let totalMinutes = 0;

  // Charge in 1% steps with battery charge curve tapering above 80%
  for (let s = startSocPct; s < targetSocPct; s++) {
    const energyPerPctKwh = batteryCapacityKwh / 100;
    let taperFactor = 1.0;
    if (s >= 80) {
      // Linear taper from 1.0 down to 0.25 between 80% and 100%
      taperFactor = Math.max(0.25, 1.0 - ((s - 80) / 20) * 0.75);
    }
    const kw = Math.max(7.2, effectiveMaxKw * taperFactor);
    const hours = energyPerPctKwh / kw;
    totalMinutes += hours * 60;
  }

  return Math.round(totalMinutes);
}
