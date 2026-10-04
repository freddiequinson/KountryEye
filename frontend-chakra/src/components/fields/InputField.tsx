import type { ReactNode } from 'react'
import { Flex, FormLabel, Input, Text, useColorModeValue, type InputProps } from '@chakra-ui/react'

type Props = InputProps & { id: string; label: ReactNode; extra?: ReactNode }

export default function InputField({ id, label, extra, mb, ...rest }: Props) {
  const textColorPrimary = useColorModeValue('secondaryGray.900', 'white')

  return (
    <Flex direction="column" mb={mb ?? '30px'}>
      <FormLabel display="flex" ms="10px" htmlFor={id} fontSize="sm" color={textColorPrimary} fontWeight="bold" _hover={{ cursor: 'pointer' }}>
        {label}
        <Text fontSize="sm" fontWeight="400" ms="2px">
          {extra}
        </Text>
      </FormLabel>
      <Input
        {...rest}
        id={id}
        fontWeight="500"
        variant="main"
        _placeholder={{ fontWeight: '400', color: 'secondaryGray.600' }}
        h="44px"
        maxH="44px"
      />
    </Flex>
  )
}
