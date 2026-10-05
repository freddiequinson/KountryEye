import { mode, type StyleFunctionProps } from "@chakra-ui/theme-tools";

// Table look used across the app: ruled rows under a quiet header, sentence-case column names,
// a hairline under every row, regular-weight cells.
const linedTable = (props: StyleFunctionProps) => ({
  th: {
    color: mode("secondaryGray.600", "secondaryGray.500")(props),
    fontFamily: "body",
    fontSize: "14px",
    fontWeight: "500",
    letterSpacing: "normal",
    textTransform: "none",
    h: "48px",
    py: "0",
    px: "16px",
    borderBottom: "1px solid",
    borderColor: mode("secondaryGray.100", "whiteAlpha.100")(props),
    whiteSpace: "nowrap",
  },
  td: {
    color: mode("secondaryGray.900", "white")(props),
    fontSize: "14px",
    fontWeight: "400",
    p: "16px",
    borderBottom: "1px solid",
    borderColor: mode("secondaryGray.100", "whiteAlpha.100")(props),
    whiteSpace: "nowrap",
  },
  tbody: {
    tr: {
      transition: "background .12s ease",
      _hover: { bg: mode("secondaryGray.300", "whiteAlpha.50")(props) },
      "&:last-of-type td": { borderBottomWidth: "0" },
    },
  },
});

// Look for Chakra parts the Horizon template doesn't style itself.
export const overrideStyles = {
  components: {
    Heading: {
      baseStyle: { letterSpacing: "-0.02em", fontWeight: "700" },
    },
    Modal: {
      baseStyle: (props: StyleFunctionProps) => ({
        overlay: { bg: "rgba(15, 27, 45, 0.45)", backdropFilter: "blur(4px)" },
        dialog: {
          borderRadius: "20px",
          bg: mode("white", "navy.800")(props),
          boxShadow: "pop",
        },
        header: {
          color: mode("secondaryGray.900", "white")(props),
          fontSize: "lg",
          fontWeight: "700",
          pt: "22px",
          pb: "14px",
        },
        footer: {
          borderTop: "1px solid",
          borderColor: mode("secondaryGray.100", "whiteAlpha.100")(props),
          bg: mode("secondaryGray.300", "whiteAlpha.50")(props),
          borderBottomRadius: "20px",
          py: "14px",
          mt: "16px",
        },
        closeButton: { top: "16px", insetEnd: "16px", borderRadius: "10px" },
      }),
    },
    Drawer: {
      baseStyle: (props: StyleFunctionProps) => ({
        dialog: { bg: mode("white", "navy.800")(props) },
      }),
    },
    Table: {
      variants: {
        // `simple` is what every page uses; `lined` is the same style under its original name.
        simple: linedTable,
        lined: linedTable,
      },
    },
    // Segmented-control look: a tinted track with a raised selected tab.
    Tabs: {
      variants: {
        "soft-rounded": (props: StyleFunctionProps) => ({
          tablist: {
            bg: mode("secondaryGray.200", "whiteAlpha.100")(props),
            p: "4px",
            borderRadius: "14px",
            w: "fit-content",
            maxW: "100%",
            gap: "2px !important",
          },
          tab: {
            borderRadius: "10px",
            fontWeight: "600",
            fontSize: "md",
            px: "16px",
            py: "8px",
            color: mode("secondaryGray.600", "secondaryGray.500")(props),
            transition: "all .15s ease",
            _hover: { color: mode("secondaryGray.900", "white")(props) },
            _selected: {
              bg: mode("white", "navy.700")(props),
              color: mode("brand.700", "white")(props),
              boxShadow: mode("0 1px 2px rgba(15,27,45,0.08), 0 4px 10px -4px rgba(15,27,45,0.12)", "none")(props),
            },
          },
        }),
      },
      defaultProps: { colorScheme: "brand" },
    },
    Menu: {
      baseStyle: (props: StyleFunctionProps) => ({
        list: {
          bg: mode("white", "navy.800")(props),
          border: "1px solid",
          borderColor: mode("secondaryGray.100", "whiteAlpha.100")(props),
          borderRadius: "14px",
          boxShadow: mode("pop", "none")(props),
          p: "6px",
          minW: "200px",
        },
        item: {
          bg: "transparent",
          borderRadius: "8px",
          fontSize: "sm",
          fontWeight: "500",
          py: "8px",
          _hover: { bg: mode("secondaryGray.300", "whiteAlpha.100")(props) },
          _focus: { bg: mode("secondaryGray.300", "whiteAlpha.100")(props) },
        },
      }),
    },
    Popover: {
      baseStyle: (props: StyleFunctionProps) => ({
        content: { bg: mode("white", "navy.800")(props), borderRadius: "14px", boxShadow: "pop" },
      }),
    },
    Tooltip: {
      baseStyle: { borderRadius: "8px", fontSize: "xs", fontWeight: "600", px: "8px", py: "5px" },
    },
    Checkbox: { defaultProps: { colorScheme: "brandScheme" } },
    Radio: { defaultProps: { colorScheme: "brandScheme" } },
    FormLabel: {
      baseStyle: (props: StyleFunctionProps) => ({
        fontSize: "13px",
        fontWeight: "600",
        mb: "6px",
        color: mode("secondaryGray.800", "secondaryGray.400")(props),
      }),
    },
    Skeleton: {
      defaultProps: { startColor: "secondaryGray.200", endColor: "secondaryGray.100" },
    },
  },
};
