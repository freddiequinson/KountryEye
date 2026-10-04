import { useState } from 'react'
import { Icon, Input, InputGroup, InputRightElement, type InputProps } from '@chakra-ui/react'
import { MdOutlineRemoveRedEye } from 'react-icons/md'
import { RiEyeCloseLine } from 'react-icons/ri'

export default function PasswordInput(props: InputProps) {
  const [show, setShow] = useState(false)

  return (
    <InputGroup size="md">
      <Input fontSize="sm" size="lg" variant="auth" {...props} type={show ? 'text' : 'password'} />
      <InputRightElement display="flex" alignItems="center" mt="4px">
        <Icon
          as={show ? RiEyeCloseLine : MdOutlineRemoveRedEye}
          color="gray.400"
          _hover={{ cursor: 'pointer' }}
          aria-label={show ? 'Hide password' : 'Show password'}
          onClick={() => setShow(!show)}
        />
      </InputRightElement>
    </InputGroup>
  )
}
