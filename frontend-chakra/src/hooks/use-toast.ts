import type { ReactNode } from 'react'
import { useToast as useChakraToast } from '@chakra-ui/react'

type ToastInput = {
  title?: ReactNode
  description?: ReactNode
  variant?: 'default' | 'destructive' | 'outline'
}

// Keeps the old shadcn `toast({ title, description, variant })` signature so page code ports as-is.
export function useToast() {
  const chakraToast = useChakraToast()
  const toast = ({ title, description, variant }: ToastInput) =>
    chakraToast({
      title,
      description,
      status: variant === 'destructive' ? 'error' : 'success',
      position: 'top-right',
      isClosable: true,
    })
  return { toast }
}
