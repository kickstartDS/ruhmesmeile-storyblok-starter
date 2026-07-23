import localFont from "next/font/local";

const displayFont = localFont({
  src: [
    {
      path: "../../design-system/dist/static/fonts/Montserrat-Light.woff2",
      weight: "300",
      style: "normal",
    },
    {
      path: "../../design-system/dist/static/fonts/Montserrat-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../design-system/dist/static/fonts/Montserrat-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../design-system/dist/static/fonts/Montserrat-SemiBold.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../../design-system/dist/static/fonts/Montserrat-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  preload: true,
  display: "swap",
  variable: "--ks-brand-font-family-display",
  fallback: [
    "system-ui",
    "-apple-system",
    "BlinkMacSystemFont",
    "'Segoe UI'",
    "'Helvetica Neue'",
    "Helvetica",
    "Arial",
    "sans-serif",
  ],
  adjustFontFallback: false,
});

const copyFont = localFont({
  src: [
    {
      path: "../../design-system/dist/static/fonts/Montserrat-Light.woff2",
      weight: "300",
      style: "normal",
    },
    {
      path: "../../design-system/dist/static/fonts/Montserrat-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../design-system/dist/static/fonts/Montserrat-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../design-system/dist/static/fonts/Montserrat-SemiBold.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../../design-system/dist/static/fonts/Montserrat-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  preload: true,
  display: "swap",
  variable: "--ks-brand-font-family-copy",
  fallback: [
    "system-ui",
    "-apple-system",
    "BlinkMacSystemFont",
    "'Segoe UI'",
    "'Helvetica Neue'",
    "Helvetica",
    "Arial",
    "sans-serif",
  ],
  adjustFontFallback: false,
});

// Interface font: --ks-brand-font-family-interface uses the same Montserrat
// stack as --ks-brand-font-family-copy (see token/branding-token.css), so it
// is loaded identically here to get its own next/font @font-face + CSS variable.
const interfaceFont = localFont({
  src: [
    {
      path: "../../design-system/dist/static/fonts/Montserrat-Light.woff2",
      weight: "300",
      style: "normal",
    },
    {
      path: "../../design-system/dist/static/fonts/Montserrat-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../design-system/dist/static/fonts/Montserrat-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../design-system/dist/static/fonts/Montserrat-SemiBold.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../../design-system/dist/static/fonts/Montserrat-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  preload: true,
  display: "swap",
  variable: "--ks-brand-font-family-interface",
  fallback: [
    "system-ui",
    "-apple-system",
    "BlinkMacSystemFont",
    "'Segoe UI'",
    "'Helvetica Neue'",
    "Helvetica",
    "Arial",
    "sans-serif",
  ],
  adjustFontFallback: false,
});

const displayFontPreview = localFont({
  src: [
    {
      path: "../../design-system/dist/static/fonts/Montserrat-Light.woff2",
      weight: "300",
      style: "normal",
    },
    {
      path: "../../design-system/dist/static/fonts/Montserrat-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../design-system/dist/static/fonts/Montserrat-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../design-system/dist/static/fonts/Montserrat-SemiBold.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../../design-system/dist/static/fonts/Montserrat-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  preload: false,
  display: "auto",
  variable: "--ks-brand-font-family-display",
  fallback: [
    "system-ui",
    "-apple-system",
    "BlinkMacSystemFont",
    "'Segoe UI'",
    "'Helvetica Neue'",
    "Helvetica",
    "Arial",
    "sans-serif",
  ],
  adjustFontFallback: false,
});

const copyFontPreview = localFont({
  src: [
    {
      path: "../../design-system/dist/static/fonts/Montserrat-Light.woff2",
      weight: "300",
      style: "normal",
    },
    {
      path: "../../design-system/dist/static/fonts/Montserrat-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../design-system/dist/static/fonts/Montserrat-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../design-system/dist/static/fonts/Montserrat-SemiBold.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../../design-system/dist/static/fonts/Montserrat-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  preload: false,
  display: "auto",
  variable: "--ks-brand-font-family-copy",
  fallback: [
    "system-ui",
    "-apple-system",
    "BlinkMacSystemFont",
    "'Segoe UI'",
    "'Helvetica Neue'",
    "Helvetica",
    "Arial",
    "sans-serif",
  ],
  adjustFontFallback: false,
});

const interfaceFontPreview = localFont({
  src: [
    {
      path: "../../design-system/dist/static/fonts/Montserrat-Light.woff2",
      weight: "300",
      style: "normal",
    },
    {
      path: "../../design-system/dist/static/fonts/Montserrat-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../design-system/dist/static/fonts/Montserrat-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../design-system/dist/static/fonts/Montserrat-SemiBold.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../../design-system/dist/static/fonts/Montserrat-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  preload: false,
  display: "auto",
  variable: "--ks-brand-font-family-interface",
  fallback: [
    "system-ui",
    "-apple-system",
    "BlinkMacSystemFont",
    "'Segoe UI'",
    "'Helvetica Neue'",
    "Helvetica",
    "Arial",
    "sans-serif",
  ],
  adjustFontFallback: false,
});

export const fontClassNames = `${displayFont.variable} ${copyFont.variable} ${interfaceFont.variable}`;
export const fontClassNamesPreview = `${displayFontPreview.variable} ${copyFontPreview.variable} ${interfaceFontPreview.variable}`;

// Internal font-family strings as resolved by next/font (e.g. "__displayFont_0ac8ec", ...).
// Used to rewrite matching theme CSS values so the browser uses next/font's
// already-declared @font-face instead of looking up the human-readable name.
export const nextFontFamilies = {
  display: displayFont.style.fontFamily,
  copy: copyFont.style.fontFamily,
  interface: interfaceFont.style.fontFamily,
};

// The human-readable name stored in Storyblok theme tokens for the locally-loaded
// font. Used to detect which themes reference this font so we can rewrite the
// CSS value to next/font's synthetic name before body injection.
export const localFontFamilyName = "Montserrat";
