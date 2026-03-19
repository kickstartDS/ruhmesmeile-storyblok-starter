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

export const fontClassNames = `${displayFont.variable} ${copyFont.variable}`;
export const fontClassNamesPreview = `${displayFontPreview.variable} ${copyFontPreview.variable}`;
