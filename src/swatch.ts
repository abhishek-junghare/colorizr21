import extractColorParts from '~/extract-color-parts';
import formatCSS from '~/format-css';
import { MESSAGES } from '~/modules/constants';
import { invariant } from '~/modules/invariant';
import { clamp } from '~/modules/utils';
import { isHex, isNamedColor, isString } from '~/modules/validators';
import parseCSS from '~/parse-css';

import { ColorTokens, ColorType, LCH } from '~/types';

export type Swatch = {
  [key in ColorTokens]: string;
};

export type SwatchVariant = 'deep' | 'neutral' | 'pastel' | 'subtle' | 'vibrant';

export interface SwatchOptions {
  /**
   * Output color format.
   *
   * Determines the format of the generated colors (e.g., HEX, RGB, OKLCH, etc.).
   *
   * If not specified, the output will match the format of the input color.
   */
  format?: ColorType;
  /**
   * The lightness tuning factor for the swatch.
   * - 1: Linear lightness distribution.
   * - >1: Lighter tones are emphasized.
   * - <1: Darker tones are emphasized.
   * @default 1.5
   */
  lightnessFactor?: number;
  /**
   * The maximum lightness value for the swatch.
   *
   * Defines the upper bound for the lightest color in the palette.
   *
   * A number between 0 and 1.
   * @default 0.97
   */
  maxLightness?: number;
  /**
   * The minimum lightness value for the swatch.
   *
   * Defines the lower bound for the darkest color in the palette.
   *
   * A number between 0 and 1.
   *
   * @default 0.2
   */
  minLightness?: number;
  /**
   * Determines the scale type for the swatch.
   * - 'fixed': Shades are distributed with pre-defined lightness intervals.
   * - 'dynamic': Shades are distributed adaptively based on the input color.
   * @default 'dynamic'
   */
  scale?: 'dynamic' | 'fixed';
  /**
   * The number of steps in the swatch.
   * - 11: Standard scale (50, 100, 200, ..., 900, 950)
   * - 21: Extended scale (0, 50, 100, 150, ..., 900, 950, 1000)
   * @default 11
   */
  swatchSteps?: 11 | 21;
  /**
   * The variant of the swatch.
   * - 'deep': Generates rich and bold tones with significantly reduced lightness.
   * - 'neutral': Generates muted tones by reducing chroma.
   * - 'pastel': Produces soft and airy tones with significant chroma reduction.
   * - 'subtle': Creates extremely desaturated tones, close to grayscale.
   * - 'vibrant': Enhances chroma for bold and striking tones.
   */
  variant?: SwatchVariant;
}

/**
 * Generate a shade of a color based its lightness tuning factor
 */
function shadeColor(input: LCH, lightness: number): LCH {
  const { c, h } = input;

  // Adjust chroma based on lightness to maintain perceptual uniformity
  // Reduce chroma for very light and very dark colors
  const chromaScale = c === 0 ? 1 : 4 * lightness * (1 - lightness);

  // Calculate final chroma
  const chroma = c * chromaScale;
  const adjustedChroma = clamp(chroma, 0, 0.4);

  return { l: lightness, c: adjustedChroma, h };
}

/**
 * Generate a swatch of colors based on the input color
 *
 * This utility is ideal for designers and developers who need dynamic color
 * palettes for UI themes, design systems, or data visualization. Supports
 * multiple modes, scales, and variants for flexibility.
 */
export default function swatch(input: string, options: SwatchOptions = {}): Swatch {
  invariant(isString(input), MESSAGES.inputString);
  const {
    format,
    lightnessFactor = 1.5,
    maxLightness = 0.97,
    minLightness = 0.2,
    scale = 'dynamic',
    swatchSteps = 11,
    variant = 'base',
  } = options;

  invariant(
    maxLightness > minLightness && maxLightness <= 1 && minLightness >= 0,
    'maxLightness must be greater than minLightness and within the range [0, 1].',
  );

  invariant(
    swatchSteps === 11 || swatchSteps === 21,
    'swatchSteps must be either 11 or 21.',
  );

  const lch = parseCSS(input, 'oklch');
  const chromaScale = {
    base: 1,
    deep: 0.8,
    neutral: 0.5,
    pastel: 0.3,
    subtle: 0.2,
    vibrant: 1.25,
  }[variant];

  lch.l = 0.7;
  lch.c *= chromaScale;

  if (variant === 'deep') {
    lch.l *= 0.7;
  }

  const colorFormat = isHex(input) || isNamedColor(input) ? 'hex' : extractColorParts(input).model;

  let palette: Record<number, number> = {};

  if (scale === 'dynamic') {
    for (let index = 0; index < swatchSteps; index++) {
      // Calculate lightness for this step
      const lightness =
        maxLightness - (maxLightness - minLightness) * (index / (swatchSteps - 1)) ** lightnessFactor;
      let tone: number;

      if (swatchSteps === 11) {
        // Standard 11-step scale
        if (index === 0) {
          tone = 50;
        } else if (index === 10) {
          tone = 950;
        } else {
          tone = index * 100;
        }
      } else {
        // Extended 21-step scale
        if (index === 0) {
          tone = 0;
        } else if (index === 1) {
          tone = 50;
        } else if (index === 20) {
          tone = 1000;
        } else {
          tone = (index - 1) * 50 + 50;
        }
      }

      palette[tone] = lightness;
    }
  } else {
    // Fixed scale
    if (swatchSteps === 11) {
      palette = {
        50: 0.97,
        100: 0.92,
        200: 0.85,
        300: 0.78,
        400: 0.69,
        500: 0.57,
        600: 0.46,
        700: 0.35,
        800: 0.24,
        900: 0.18,
        950: 0.1,
      };
    } else {
      palette = {
        0: 0.99,
        50: 0.97,
        100: 0.94,
        150: 0.91,
        200: 0.87,
        250: 0.83,
        300: 0.78,
        350: 0.73,
        400: 0.67,
        450: 0.61,
        500: 0.55,
        550: 0.49,
        600: 0.43,
        650: 0.38,
        700: 0.33,
        750: 0.28,
        800: 0.23,
        850: 0.19,
        900: 0.15,
        950: 0.1,
        1000: 0.05,
      };
    }
  }

  const output = Object.entries(palette).reduce(
    (acc, [key, value]) => {
      acc[Number(key) as ColorTokens] = shadeColor(lch, value);

      return acc;
    },
    {} as Record<ColorTokens, LCH>,
  );

  return Object.entries(output).reduce((acc, [key, value]) => {
    return {
      ...acc,
      [key]: formatCSS(value, { format: format ?? colorFormat }),
    };
  }, {} as Swatch);
}
