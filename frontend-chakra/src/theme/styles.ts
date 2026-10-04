import { mode, type StyleFunctionProps } from "@chakra-ui/theme-tools";
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
    secondaryGray: {
      100: "#E0E5F2",
      200: "#E1E9F8",
      300: "#F4F7FE",
      400: "#E9EDF7",
      500: "#8F9BBA",
      600: "#A3AED0",
      700: "#707EAE",
      800: "#707EAE",
      900: "#1B2559",
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
  styles: {
    global: (props: StyleFunctionProps) => ({
      body: {
        overflowX: "hidden",
        bg: mode("secondaryGray.300", "navy.900")(props),
        fontFamily: "DM Sans",
        letterSpacing: "-0.5px",
      },
      input: {
        color: "gray.700",
      },
      html: {
        fontFamily: "DM Sans",
      },
      ".thin-scrollbar": {
        scrollbarWidth: "thin",
        scrollbarColor: "rgba(135, 140, 189, 0.3) transparent",
      },
    }),
  },
};
