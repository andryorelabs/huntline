/** Reads the brand tokens from `docs/brand/tokens.css` and computes WCAG contrast. */

type Theme = "dark" | "light";

const THEME_SELECTORS: Record<Theme, string> = { dark: ":root", light: ".light" };

const HEX_COLOUR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

function stripComments(cssText: string): string {
  return cssText.replaceAll(/\/\*[\s\S]*?\*\//g, "");
}

function findBlockBody(cssText: string, selector: string): string {
  const blocks = cssText.matchAll(/([^{}]+)\{([^{}]*)\}/g);
  for (const [, rawSelector, body] of blocks) {
    if (rawSelector?.trim() === selector && body !== undefined) {
      return body;
    }
  }
  throw new Error(`tokens.css has no "${selector}" block`);
}

function normaliseValue(value: string): string {
  const trimmed = value.trim();
  return HEX_COLOUR.test(trimmed) ? trimmed.toLowerCase() : trimmed;
}

function readDeclarations(body: string): Record<string, string> {
  const declarations: Record<string, string> = {};
  for (const [, name, value] of body.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
    if (name !== undefined && value !== undefined) {
      declarations[name] = normaliseValue(value);
    }
  }
  return declarations;
}

/**
 * Returns the custom properties of the dark theme (the `:root` block) and of the
 * light theme (the `.light` block), keyed by name without the leading `--`.
 * Each theme is read on its own; the light block does not inherit from `:root`.
 * Hex colours are lowercased. Throws when either block is missing.
 */
export function readTokens(cssText: string): Record<Theme, Record<string, string>> {
  const css = stripComments(cssText);
  return {
    dark: readDeclarations(findBlockBody(css, THEME_SELECTORS.dark)),
    light: readDeclarations(findBlockBody(css, THEME_SELECTORS.light)),
  };
}

function expandHex(colour: string): string {
  if (!HEX_COLOUR.test(colour)) {
    throw new Error(`"${colour}" is not a #rgb or #rrggbb colour`);
  }
  const digits = colour.slice(1);
  if (digits.length === 6) {
    return digits;
  }
  return digits.replaceAll(/[0-9a-f]/gi, (digit) => digit + digit);
}

function linearChannel(hexDigits: string, offset: number): number {
  const scaled = Number.parseInt(hexDigits.slice(offset, offset + 2), 16) / 255;
  return scaled <= 0.04045 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(colour: string): number {
  const digits = expandHex(colour);
  return (
    0.2126 * linearChannel(digits, 0) +
    0.7152 * linearChannel(digits, 2) +
    0.0722 * linearChannel(digits, 4)
  );
}

/** WCAG 2 contrast ratio between two hex colours, from 1 to 21. Order does not matter. */
export function contrastRatio(a: string, b: string): number {
  const luminanceA = relativeLuminance(a);
  const luminanceB = relativeLuminance(b);
  const lighter = Math.max(luminanceA, luminanceB);
  const darker = Math.min(luminanceA, luminanceB);
  return (lighter + 0.05) / (darker + 0.05);
}
