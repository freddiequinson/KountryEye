import { mode, type StyleFunctionProps } from "@chakra-ui/theme-tools";

// Horizon look for Chakra parts the template doesn't style itself.
export const overrideStyles = {
  components: {
    Modal: {
      baseStyle: (props: StyleFunctionProps) => ({
        dialog: {
          borderRadius: "20px",
          bg: mode("white", "navy.800")(props),
        },
        header: { color: mode("secondaryGray.900", "white")(props) },
      }),
    },
    Drawer: {
      baseStyle: (props: StyleFunctionProps) => ({
        dialog: { bg: mode("white", "navy.800")(props) },
      }),
    },
    Table: {
      variants: {
        simple: (props: StyleFunctionProps) => ({
          th: {
            color: "secondaryGray.600",
            fontSize: "xs",
            fontWeight: "700",
            letterSpacing: "wider",
            borderColor: mode("gray.200", "whiteAlpha.100")(props),
          },
          td: {
            color: mode("secondaryGray.900", "white")(props),
            borderColor: mode("gray.100", "whiteAlpha.100")(props),
            fontSize: "sm",
          },
        }),
      },
    },
    Tabs: {
      variants: {
        "soft-rounded": {
          tab: { borderRadius: "12px", fontWeight: "500" },
        },
      },
      defaultProps: { colorScheme: "brand" },
    },
    Menu: {
      baseStyle: (props: StyleFunctionProps) => ({
        list: {
          bg: mode("white", "navy.800")(props),
          border: "none",
          borderRadius: "16px",
          boxShadow: mode("14px 17px 40px 4px rgba(112, 144, 176, 0.18)", "unset")(props),
          p: "8px",
        },
        item: {
          bg: "transparent",
          borderRadius: "10px",
          _hover: { bg: mode("secondaryGray.300", "whiteAlpha.100")(props) },
          _focus: { bg: mode("secondaryGray.300", "whiteAlpha.100")(props) },
        },
      }),
    },
    Popover: {
      baseStyle: (props: StyleFunctionProps) => ({
        content: { bg: mode("white", "navy.800")(props), borderRadius: "16px" },
      }),
    },
    Checkbox: { defaultProps: { colorScheme: "brandScheme" } },
    Radio: { defaultProps: { colorScheme: "brandScheme" } },
    FormLabel: {
      baseStyle: { fontSize: "sm", fontWeight: "500", mb: "6px" },
    },
  },
};
