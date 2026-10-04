import { mode, type StyleFunctionProps } from "@chakra-ui/theme-tools";
export const badgeStyles = {
  components: {
    Badge: {
      baseStyle: {
        borderRadius: "full",
        lineHeight: "1",
        py: "5px",
        px: "10px",
        fontSize: "11px",
        fontWeight: "700",
        letterSpacing: "0.02em",
        textTransform: "capitalize",
      },
      variants: {
        brand: (props: StyleFunctionProps) => ({
          bg: mode("brand.600", "brand.400")(props),
          color: "white",
        }),
      },
    },
  },
};
