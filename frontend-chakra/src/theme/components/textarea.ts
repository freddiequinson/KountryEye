import { mode, type StyleFunctionProps } from "@chakra-ui/theme-tools";
export const textareaStyles = {
  components: {
    Textarea: {
      variants: {
        main: (props: StyleFunctionProps) => ({
          bg: mode("white", "navy.800")(props),
          border: "1px solid",
          color: mode("secondaryGray.900", "white")(props),
          borderColor: mode("secondaryGray.400", "whiteAlpha.200")(props),
          borderRadius: "10px",
          fontSize: "sm",
          fontWeight: "500",
          px: "14px",
          py: "10px",
          transition: "border-color .15s ease, box-shadow .15s ease",
          _placeholder: { color: "secondaryGray.500", fontWeight: "400" },
          _hover: { borderColor: mode("secondaryGray.500", "whiteAlpha.400")(props) },
          _focusVisible: { borderColor: "brand.500", boxShadow: "0 0 0 3px rgba(76, 155, 79, 0.18)" },
        }),
        auth: () => ({
          bg: "white",
          border: "1px solid",
          borderColor: "secondaryGray.400",
          borderRadius: "12px",
          _placeholder: { color: "secondaryGray.600" },
        }),
      },
    },
  },
};
