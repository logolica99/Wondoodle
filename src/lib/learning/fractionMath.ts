/** Deterministic unit-fraction helpers — never defer correctness to the LLM. */

export const MIN_DENOMINATOR = 2;
export const MAX_DENOMINATOR = 8;

export type UnitFraction = {
  numerator: 1;
  denominator: number;
};

export type FractionCompareResult = "left" | "right" | "equal";

export function clampDenominator(n: number): number {
  const d = Math.round(n);
  if (!Number.isFinite(d)) return MIN_DENOMINATOR;
  return Math.min(MAX_DENOMINATOR, Math.max(MIN_DENOMINATOR, d));
}

export function unitFraction(denominator: number): UnitFraction {
  return { numerator: 1, denominator: clampDenominator(denominator) };
}

/** Value of 1/d as a rational for exact comparison. */
export function unitValue(denominator: number): number {
  return 1 / clampDenominator(denominator);
}

export function compareUnitFractions(
  leftDenom: number,
  rightDenom: number
): FractionCompareResult {
  const a = clampDenominator(leftDenom);
  const b = clampDenominator(rightDenom);
  // 1/a > 1/b ⇔ b > a (positive denominators)
  if (a === b) return "equal";
  if (a < b) return "left";
  return "right";
}

export function formatUnitFraction(denominator: number): string {
  return `1/${clampDenominator(denominator)}`;
}

export function labelForChoice(
  choice: FractionCompareResult,
  leftDenom: number,
  rightDenom: number
): string {
  if (choice === "equal") return "They're equal";
  if (choice === "left") return formatUnitFraction(leftDenom);
  return formatUnitFraction(rightDenom);
}

/** Kid-friendly hint that does not reveal which piece is larger. */
export function hintForIncorrectCompare(
  leftDenom: number,
  rightDenom: number
): string {
  const a = clampDenominator(leftDenom);
  const b = clampDenominator(rightDenom);
  if (a === b) {
    return "Both bars are split the same way. Do the highlighted pieces look the same size?";
  }
  return "Look at the highlighted pieces. Which one covers more of its whole bar?";
}
