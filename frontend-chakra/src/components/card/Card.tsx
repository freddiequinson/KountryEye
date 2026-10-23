import { Box, useStyleConfig, type BoxProps } from '@chakra-ui/react'

export default function Card({ variant, children, ...rest }: BoxProps & { variant?: string }) {
  const styles = useStyleConfig('Card', { variant })
  return (
    <Box __css={styles} {...rest}>
      {children}
    </Box>
  )
}
