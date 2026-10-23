import { mode, type StyleFunctionProps } from "@chakra-ui/theme-tools";
const FONT = `"Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", sans-serif`;
// KountryEye green (#4C9B4F) replaces Horizon's purple brand scale
const brand = {
  50: "#EEF7EE",
  100: "#DCEEDC",
  200: "#B8DDB9",
  300: "#8EC890",
  400: "#6AB46D",
  500: "#4C9B4F",
  600: "#3E8141",
  700: "#316634",
  800: "#244C26",
  900: "#173219",
};

export const globalStyles = {
  colors: {
    brand,
    brandScheme: brand,
    brandTabs: brand,
    secondary: {
      50: "#E7F9FC",
      100: "#C3F1F8",
      200: "#8BE4F2",
      300: "#52D6EB",
      400: "#2CCBE5",
      500: "#0CC0DF",
      600: "#0A9CB5",
      700: "#08788B",
      800: "#055462",
      900: "#033038",
    },
    // Neutral scale. Token names are Horizon's; values are darker so muted text stays readable.
    secondaryGray: {
      100: "#E4E9F0", // borders
      200: "#EDF1F5",
      300: "#F4F6F9", // page background, subtle fills
      400: "#DDE3EC",
      500: "#7A889C",
      600: "#64748B", // muted text
      700: "#475569",
      800: "#334155",
      900: "#0F1B2D", // ink
    },
    red: {
      100: "#FEEFEE",
      500: "#EE5D50",
      600: "#E31A1A",
    },
    blue: {
      50: "#EFF4FB",
      500: "#3965FF",
    },
    orange: {
      100: "#FFF6DA",
      500: "#FFB547",
    },
    green: {
      100: "#E6FAF5",
      500: "#01B574",
    },
    navy: {
      50: "#d0dcfb",
      100: "#aac0fe",
      200: "#a3b9f8",
      300: "#728fea",
      400: "#3652ba",
      500: "#1b3bbb",
      600: "#24388a",
      700: "#1B254B",
      800: "#111c44",
      900: "#0b1437",
    },
    gray: {
      100: "#FAFCFE",
    },
  },
  fonts: {
    heading: FONT,
    body: FONT,
  },
  shadows: {
    card: "0 1px 2px rgba(15, 27, 45, 0.04), 0 12px 32px -16px rgba(15, 27, 45, 0.12)",
    cardHover: "0 2px 4px rgba(15, 27, 45, 0.05), 0 20px 40px -18px rgba(15, 27, 45, 0.22)",
    pop: "0 12px 40px -8px rgba(15, 27, 45, 0.22)",
  },
  styles: {
    global: (props: StyleFunctionProps) => ({
      body: {
        overflowX: "hidden",
        bg: mode("secondaryGray.300", "navy.900")(props),
        color: mode("secondaryGray.900", "white")(props),
        fontFamily: FONT,
        letterSpacing: "0",
        wordSpacing: "0.06em",
        fontFeatureSettings: '"tnum" 1, "cv11" 1',
        WebkitFontSmoothing: "antialiased",
      },
      "::selection": { background: "brand.200" },
      ".thin-scrollbar": {
        scrollbarWidth: "thin",
        scrollbarColor: "rgba(100, 116, 139, 0.3) transparent",
      },
      "@media (prefers-reduced-motion: reduce)": {
        "*": { animationDuration: "0.01ms !important", transitionDuration: "0.01ms !important" },
      },
    }),
  },
};
