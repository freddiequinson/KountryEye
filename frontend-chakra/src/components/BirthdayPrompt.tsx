import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button, Text } from '@chakra-ui/react'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { AppModal } from '@/components/ui'
import { DateField } from '@/components/DateField'

const dismissKey = (id: number) => `birthday_prompt_done_${id}`

// Asks each staff member once for their birthday (for the birthday SMS). "Not now" stops it asking again.
export function BirthdayPrompt() {
  const { user, setUser } = useAuthStore()
  const [dob, setDob] = useState('')
  const [open, setOpen] = useState(false)
  // Wait until the daily greeting pop-up has been closed, so two pop-ups never stack
  useEffect(() => {
    if (!user || user.date_of_birth || user.must_change_password) return
    const check = () => {
      try {
        if (localStorage.getItem(dismissKey(user.id))) return true
        const today = new Date().toISOString().split('T')[0]
        if (localStorage.getItem(`daily_greeting_shown_${user.id}_${today}`)) {
          setOpen(true)
          return true
        }
      } catch {
        return true
      }
      return false
    }
    if (check()) return
    const t = setInterval(() => { if (check()) clearInterval(t) }, 1500)
    return () => clearInterval(t)
  }, [user])
  const close = () => {
    try {
      if (user) localStorage.setItem(dismissKey(user.id), '1')
    } catch {
      /* private mode: just close */
    }
    setOpen(false)
  }
  const save = useMutation({
    mutationFn: () => api.put('/users/me', { date_of_birth: dob }),
    onSuccess: (r) => {
      if (user) setUser({ ...user, date_of_birth: r.data.date_of_birth })
      close()
    },
  })
  if (!user) return null
  return (
    <AppModal
      isOpen={open}
      onClose={close}
      title={`When's your birthday, ${user.first_name}?`}
      description="The clinic sends staff a birthday text. Other staff can't see your date of birth."
      footer={
        <>
          <Button variant="light" onClick={close}>Not now</Button>
          <Button variant="brand" isDisabled={!dob} isLoading={save.isPending} onClick={() => save.mutate()}>Save</Button>
        </>
      }
    >
      <DateField value={dob} onChange={setDob} placeholder="Pick your date of birth" />
      <Text fontSize="sm" color="secondaryGray.600" mt="8px">You can change it later on your profile.</Text>
    </AppModal>
  )
}
