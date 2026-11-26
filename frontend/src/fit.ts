// Sizes the value text to the display card (docs/frontend-design.md).

/** The value's font sizes in px, largest first. */
export const VALUE_SIZES = [40, 36, 32, 28, 26] as const

const SMALLEST = 26

/**
 * The largest size at which the text fits, asked of `fits`, which measures
 * the text at a given size. When even the smallest doesn't fit, it returns
 * the smallest, and the text scrolls. Measuring, rather than estimating from
 * the number of characters, keeps arithmetic out of the frontend (rule 1)
 * and holds for whichever font has loaded.
 */
export function fittingSize(fits: (px: number) => boolean): number {
  return VALUE_SIZES.find(fits) ?? SMALLEST
}
