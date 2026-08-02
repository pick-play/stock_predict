export function getKrxTickSize(price: number): number {
  if (!Number.isFinite(price) || price < 0) {
    throw new Error("Price must be a finite non-negative number");
  }

  if (price < 1_000) return 1;
  if (price < 5_000) return 5;
  if (price < 10_000) return 10;
  if (price < 50_000) return 50;
  if (price < 100_000) return 100;
  if (price < 500_000) return 500;

  return 1_000;
}

function roundHalfUp(value: number): number {
  return Math.floor(value + 0.5 + Number.EPSILON);
}

export function roundToKrxTick(price: number): number {
  if (!Number.isFinite(price) || price < 0) {
    throw new Error("Price must be a finite non-negative number");
  }

  let tick = getKrxTickSize(price);
  let rounded = roundHalfUp(price / tick) * tick;

  const adjustedTick = getKrxTickSize(rounded);

  if (adjustedTick !== tick) {
    tick = adjustedTick;
    rounded = roundHalfUp(price / tick) * tick;
  }

  return rounded;
}
