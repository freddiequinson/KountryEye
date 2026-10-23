import { mode, type StyleFunctionProps } from "@chakra-ui/theme-tools";
export const inputStyles = {
  components: {
    Input: {
      baseStyle: {
        field: {
          fontWeight: 400,
          borderRadius: "8px",
        },
      },

      variants: {
        main: (props: StyleFunctionProps) => ({
          field: {
            bg: mode("white", "navy.800")(props),
            border: "1px solid",
            color: mode("secondaryGray.900", "white")(props),
            borderColor: mode("secondaryGray.400", "whiteAlpha.200")(props),
            borderRadius: "10px",
            fontSize: "sm",
            fontWeight: "500",
            h: "42px",
            px: "14px",
            transition: "border-color .15s ease, box-shadow .15s ease",
            _placeholder: { color: "secondaryGray.500", fontWeight: "400" },
            _hover: { borderColor: mode("secondaryGray.500", "whiteAlpha.400")(props) },
            _focusVisible: {
              borderColor: "brand.500",
              boxShadow: "0 0 0 3px rgba(76, 155, 79, 0.18)",
            },
            _disabled: { bg: mode("secondaryGray.300", "whiteAlpha.50")(props), opacity: 0.8 },
            _invalid: { borderColor: "red.500", boxShadow: "0 0 0 3px rgba(238, 93, 80, 0.15)" },
          },
        }),
        auth: (props: StyleFunctionProps) => ({
          field: {
            fontWeight: "500",
            color: mode("navy.700", "white")(props),
            bg: mode("transparent", "transparent")(props),
            border: "1px solid",
            borderColor: mode(
              "secondaryGray.100",
              "rgba(135, 140, 189, 0.3)"
            )(props),
            borderRadius: "12px",
            _placeholder: { color: "secondaryGray.600", fontWeight: "400" },
          },
        }),
        authSecondary: (props: StyleFunctionProps) => ({
          field: {
            bg: "transparent",
            border: "1px solid",
            borderColor: "secondaryGray.100",
            borderRadius: "12px",
            _placeholder: { color: "secondaryGray.600" },
          },
        }),
        search: (props: StyleFunctionProps) => ({
          field: {
            border: "none",
            py: "11px",
            borderRadius: "inherit",
            _placeholder: { color: "secondaryGray.600" },
          },
        }),
      },
    },
    NumberInput: {
      baseStyle: {
        field: {
          fontWeight: 400,
        },
      },

      variants: {
        main: (props: StyleFunctionProps) => ({
          field: {
            bg: mode("white", "navy.800")(props),
            border: "1px solid",
            color: mode("secondaryGray.900", "white")(props),
            borderColor: mode("secondaryGray.400", "whiteAlpha.200")(props),
            borderRadius: "10px",
            fontSize: "sm",
            fontWeight: "500",
            h: "42px",
            px: "14px",
            transition: "border-color .15s ease, box-shadow .15s ease",
            _placeholder: { color: "secondaryGray.500", fontWeight: "400" },
            _hover: { borderColor: mode("secondaryGray.500", "whiteAlpha.400")(props) },
            _focusVisible: {
              borderColor: "brand.500",
              boxShadow: "0 0 0 3px rgba(76, 155, 79, 0.18)",
            },
            _disabled: { bg: mode("secondaryGray.300", "whiteAlpha.50")(props), opacity: 0.8 },
            _invalid: { borderColor: "red.500", boxShadow: "0 0 0 3px rgba(238, 93, 80, 0.15)" },
          },
        }),
        auth: (props: StyleFunctionProps) => ({
          field: {
            bg: "transparent",
            border: "1px solid",

            borderColor: "secondaryGray.100",
            borderRadius: "12px",
            _placeholder: { color: "secondaryGray.600" },
          },
        }),
        authSecondary: (props: StyleFunctionProps) => ({
          field: {
            bg: "transparent",
            border: "1px solid",

            borderColor: "secondaryGray.100",
            borderRadius: "12px",
            _placeholder: { color: "secondaryGray.600" },
          },
        }),
        search: (props: StyleFunctionProps) => ({
          field: {
            border: "none",
            py: "11px",
            borderRadius: "inherit",
            _placeholder: { color: "secondaryGray.600" },
          },
        }),
      },
    },
    Select: {
      baseStyle: {
        field: {
          fontWeight: 400,
        },
      },

      variants: {
        main: (props: StyleFunctionProps) => ({
          field: {
            bg: mode("white", "navy.800")(props),
            border: "1px solid",
            color: mode("secondaryGray.900", "white")(props),
            borderColor: mode("secondaryGray.400", "whiteAlpha.200")(props),
            borderRadius: "10px",
            fontSize: "sm",
            fontWeight: "500",
            h: "42px",
            px: "14px",
            transition: "border-color .15s ease, box-shadow .15s ease",
            _placeholder: { color: "secondaryGray.500", fontWeight: "400" },
            _hover: { borderColor: mode("secondaryGray.500", "whiteAlpha.400")(props) },
            _focusVisible: {
              borderColor: "brand.500",
              boxShadow: "0 0 0 3px rgba(76, 155, 79, 0.18)",
            },
            _disabled: { bg: mode("secondaryGray.300", "whiteAlpha.50")(props), opacity: 0.8 },
            _invalid: { borderColor: "red.500", boxShadow: "0 0 0 3px rgba(238, 93, 80, 0.15)" },
          },
          icon: { color: "secondaryGray.600" },
        }),
        mini: (props: StyleFunctionProps) => ({
          field: {
            bg: mode("transparent", "navy.800")(props),
            border: "0px solid transparent",
            fontSize: "0px",
            p: "10px",
            _placeholder: { color: "secondaryGray.600" },
          },
          icon: {
            color: "secondaryGray.600",
          },
        }),
        subtle: (props: StyleFunctionProps) => ({
          box: {
            width: "unset",
          },
          field: {
            bg: "transparent",
            border: "0px solid",
            color: "secondaryGray.600",
            borderColor: "transparent",
            width: "max-content",
            _placeholder: { color: "secondaryGray.600" },
          },
          icon: {
            color: "secondaryGray.600",
          },
        }),
        transparent: (props: StyleFunctionProps) => ({
          field: {
            bg: "transparent",
            border: "0px solid",
            width: "min-content",
            color: mode("secondaryGray.600", "secondaryGray.600")(props),
            borderColor: "transparent",
            padding: "0px",
            paddingLeft: "8px",
            paddingRight: "20px",
            fontWeight: "700",
            fontSize: "14px",
            _placeholder: { color: "secondaryGray.600" },
          },
          icon: {
            transform: "none !important",
            position: "unset !important",
            width: "unset",
            color: "secondaryGray.600",
            right: "0px",
          },
        }),
        auth: (props: StyleFunctionProps) => ({
          field: {
            bg: "transparent",
            border: "1px solid",

            borderColor: "secondaryGray.100",
            borderRadius: "12px",
            _placeholder: { color: "secondaryGray.600" },
          },
        }),
        authSecondary: (props: StyleFunctionProps) => ({
          field: {
            bg: "transparent",
            border: "1px solid",

            borderColor: "secondaryGray.100",
            borderRadius: "12px",
            _placeholder: { color: "secondaryGray.600" },
          },
        }),
        search: (props: StyleFunctionProps) => ({
          field: {
            border: "none",
            py: "11px",
            borderRadius: "inherit",
            _placeholder: { color: "secondaryGray.600" },
          },
        }),
      },
    },
    // PinInputField: {
    //   variants: {
    //     main: (props: StyleFunctionProps) => ({
    //       field: {
    //         bg: "red !important",
    //         border: "1px solid",
    //         color: mode("secondaryGray.900", "white")(props),
    //         borderColor: mode("secondaryGray.100", "whiteAlpha.100")(props),
    //         borderRadius: "12px",
    //         _placeholder: { color: "secondaryGray.600" },
    //       },
    //     }),
    //   },
    // },
  },
};
