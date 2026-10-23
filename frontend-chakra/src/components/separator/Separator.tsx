import { Flex, type FlexProps } from '@chakra-ui/react'

export const HSeparator = (props: FlexProps) => <Flex h="1px" w="100%" bg="rgba(135, 140, 189, 0.3)" {...props} />

export const VSeparator = (props: FlexProps) => <Flex w="1px" bg="rgba(135, 140, 189, 0.3)" {...props} />
