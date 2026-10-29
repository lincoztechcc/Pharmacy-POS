import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Currency-safe rounding to 2 decimal places using EPSILON to eliminate
 * IEEE 754 floating-point drift (e.g. 0.1 + 0.2 = 0.30000000000000004 -> 0.3)
 */
export function roundCurrency(value: number | string | null | undefined): number {
  const num = typeof value === "string" ? parseFloat(value) : Number(value || 0);
  if (Number.isNaN(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

