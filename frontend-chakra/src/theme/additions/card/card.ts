import { mode, type StyleFunctionProps } from '@chakra-ui/theme-tools';
const Card = {
  baseStyle: (props: StyleFunctionProps) => ({
    p: '20px',
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    position: 'relative',
    borderRadius: '20px',
    border: '1px solid',
    borderColor: mode('secondaryGray.100', 'whiteAlpha.100')(props),
    minWidth: '0px',
    wordWrap: 'break-word',
    bg: mode('#ffffff', 'navy.800')(props),
    boxShadow: mode('card', 'none')(props),
    backgroundClip: 'border-box',
  }),
};

export const CardComponent = {
  components: {
    Card,
  },
};
