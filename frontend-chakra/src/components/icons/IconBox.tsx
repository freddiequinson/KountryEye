import type { ReactNode } from 'react'
import { Flex, type FlexProps } from '@chakra-ui/react'

export default function IconBox({ icon, ...rest }: FlexProps & { icon: ReactNode }) {
  return (
    <Flex alignItems="center" justifyContent="center" borderRadius="50%" {...rest}>
      {icon}
    </Flex>
  )
}
