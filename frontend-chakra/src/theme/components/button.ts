import { mode, type StyleFunctionProps } from "@chakra-ui/theme-tools";

// Shared press/hover feel for filled buttons.
const lift = {
  _hover: { transform: "translateY(-1px)", _disabled: { transform: "none" } },
  _active: { transform: "translateY(0) scale(0.98)" },
};

export const buttonStyles = {
  components: {
    Button: {
      baseStyle: {
        borderRadius: "10px",
        fontWeight: "600",
        transition: "transform .15s ease, box-shadow .15s ease, background .15s ease, border-color .15s ease",
        boxSizing: "border-box",
        _focusVisible: { boxShadow: "0 0 0 3px rgba(76, 155, 79, 0.35)" },
      },
      sizes: {
        xs: { h: "28px", fontSize: "xs", px: "10px", borderRadius: "8px" },
        sm: { h: "34px", fontSize: "13px", px: "12px", borderRadius: "9px" },
        md: { h: "40px", fontSize: "14px", px: "16px" },
        lg: { h: "48px", fontSize: "15px", px: "22px", borderRadius: "12px" },
      },
      variants: {
        outline: (props: StyleFunctionProps) => ({
          borderColor: mode("secondaryGray.400", "whiteAlpha.300")(props),
          ".banner-actions &": { color: "white", borderColor: "whiteAlpha.400", _hover: { bg: "whiteAlpha.200" } },
        }),
        brand: (props: StyleFunctionProps) => ({
          bg: mode("brand.600", "brand.500")(props),
          color: "white",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18), 0 1px 2px rgba(23,50,25,0.3), 0 6px 14px -6px rgba(62,129,65,0.6)",
          ...lift,
          _hover: {
            ...lift._hover,
            bg: mode("brand.700", "brand.400")(props),
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18), 0 2px 4px rgba(23,50,25,0.3), 0 10px 20px -8px rgba(62,129,65,0.7)",
            _disabled: { bg: mode("brand.600", "brand.500")(props), transform: "none" },
          },
          _active: { ...lift._active, bg: mode("brand.800", "brand.500")(props) },
          // On the green page banner the primary action turns white so it stands off the background.
          ".banner-actions &": { bg: "white", color: "brand.700", boxShadow: "none", _hover: { bg: "whiteAlpha.900" }, _active: { bg: "whiteAlpha.800" } },
        }),
        darkBrand: (props: StyleFunctionProps) => ({
          bg: mode("secondaryGray.900", "white")(props),
          color: mode("white", "secondaryGray.900")(props),
          ...lift,
          _hover: { ...lift._hover, bg: mode("secondaryGray.800", "secondaryGray.200")(props) },
        }),
        lightBrand: (props: StyleFunctionProps) => ({
          bg: mode("brand.50", "whiteAlpha.100")(props),
          color: mode("brand.700", "white")(props),
          _hover: { bg: mode("brand.100", "whiteAlpha.200")(props) },
          _active: { transform: "scale(0.98)" },
        }),
        // Secondary action: white with a hairline border.
        light: (props: StyleFunctionProps) => ({
          bg: mode("white", "whiteAlpha.100")(props),
          color: mode("secondaryGray.900", "white")(props),
          border: "1px solid",
          borderColor: mode("secondaryGray.400", "whiteAlpha.200")(props),
          boxShadow: mode("0 1px 2px rgba(15,27,45,0.05)", "none")(props),
          _hover: {
            bg: mode("secondaryGray.300", "whiteAlpha.200")(props),
            borderColor: mode("secondaryGray.500", "whiteAlpha.300")(props),
          },
          _active: { transform: "scale(0.98)" },
          ".hero-actions &": { bg: "white", color: "secondaryGray.900", borderColor: "transparent", _hover: { bg: "whiteAlpha.900" } },
          ".banner-actions &": { bg: "whiteAlpha.200", color: "white", borderColor: "whiteAlpha.300", boxShadow: "none", _hover: { bg: "whiteAlpha.300", borderColor: "whiteAlpha.400" } },
        }),
        action: (props: StyleFunctionProps) => ({
          borderRadius: "full",
          bg: mode("secondaryGray.300", "brand.400")(props),
          color: mode("brand.600", "white")(props),
          _hover: { bg: mode("secondaryGray.200", "brand.400")(props) },
        }),
        setup: (props: StyleFunctionProps) => ({
          borderRadius: "full",
          bg: mode("transparent", "brand.400")(props),
          border: mode("1px solid", "0px solid")(props),
          borderColor: mode("secondaryGray.400", "transparent")(props),
          color: mode("secondaryGray.900", "white")(props),
          _hover: { bg: mode("secondaryGray.100", "brand.400")(props) },
        }),
      },
    },
  },
};
