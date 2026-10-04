import { Button, Icon, useColorMode } from '@chakra-ui/react'
import { IoMdMoon, IoMdSunny } from 'react-icons/io'

export default function FixedPlugin() {
  const { colorMode, toggleColorMode } = useColorMode()

  return (
    <Button
      aria-label="Toggle dark mode"
      h="60px"
      w="60px"
      zIndex="99"
      bg="linear-gradient(135deg, #6AB46D 0%, #3E8141 100%)"
      _hover={{ bg: 'linear-gradient(135deg, #6AB46D 0%, #316634 100%)' }}
      position="fixed"
      right="35px"
      bottom="30px"
      border="1px solid"
      borderColor="brand.400"
      borderRadius="50px"
      onClick={toggleColorMode}
      display="flex"
      p="0px"
    >
      <Icon h="24px" w="24px" color="white" as={colorMode === 'light' ? IoMdMoon : IoMdSunny} />
    </Button>
  )
}
