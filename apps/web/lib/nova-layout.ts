export const NOVA_LAYOUT_VARIANTS = [
  "layoutA",
  "layoutB",
  "layoutC",
  "layoutD",
  "layoutE",
  "layoutF",
  "layoutG",
] as const;

export type NovaLayoutVariant = (typeof NOVA_LAYOUT_VARIANTS)[number];

export const NOVA_DEFAULT_LAYOUT_VARIANT: NovaLayoutVariant = "layoutA";

export function getNovaLayoutVariant(value = process.env.NOVA_WEB_LAYOUT): NovaLayoutVariant {
  if (NOVA_LAYOUT_VARIANTS.includes(value as NovaLayoutVariant)) {
    return value as NovaLayoutVariant;
  }

  return NOVA_DEFAULT_LAYOUT_VARIANT;
}
