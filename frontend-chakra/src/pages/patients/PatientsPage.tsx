import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Box, Button, IconButton, Input, Select, SimpleGrid, Stack, Table, Tbody, Td, Th, Thead, Tr } from '@chakra-ui/react'
import { MdAdd, MdDownload, MdVisibility } from 'react-icons/md'
import api from '@/lib/api'
import { PersonCell } from '@/components/Person'
import { useAuthStore } from '@/stores/auth'
import type { Patient } from '@/types'
import { useToast } from '@/hooks/use-toast'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/card/Card'
import { AppModal, Field, SearchInput, TableMessageRow } from '@/components/ui'

const emptyForm = {
  first_name: '',
  last_name: '',
  phone: '',
  email: '',
  sex: '',
  date_of_birth: '',
  address: '',
  branch_id: 1,
}

export default function PatientsPage() {
  const [search, setSearch] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formData, setFormData] = useState(emptyForm)

  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { user } = useAuthStore()

  // Check if user is frontdesk (hide export buttons)
  const roleName = typeof user?.role === 'string' ? user.role : user?.role?.name
  const isFrontdesk = roleName?.toLowerCase() === 'frontdesk' || roleName?.toLowerCase() === 'front desk'

  const { data: patients = [], isLoading } = useQuery({
    queryKey: ['patients', search],
    queryFn: async () => {
      const params = search ? { search } : {}
      const response = await api.get('/patients', { params })
      return response.data
    },
  })

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => api.post('/patients', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      setIsDialogOpen(false)
      setFormData(emptyForm)
      toast({ title: 'Patient registered successfully' })
    },
    onError: () => {
      toast({ title: 'Failed to register patient', variant: 'destructive' })
    },
  })

  const exportPatients = async (format: 'csv' | 'xlsx') => {
    try {
      const response = await api.get(`/patients/export?format=${format}`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `patients.${format}`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch {
      toast({ title: 'Export failed', variant: 'destructive' })
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createMutation.mutate(formData)
  }

  const set = (key: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFormData({ ...formData, [key]: e.target.value })

  return (
    <>
      <PageHeader
        title="Patients"
        actions={
          <>
            {!isFrontdesk && (
              <>
                <Button variant="light" leftIcon={<MdDownload />} onClick={() => exportPatients('csv')}>
                  Export CSV
                </Button>
                <Button variant="light" leftIcon={<MdDownload />} onClick={() => exportPatients('xlsx')}>
                  Export Excel
                </Button>
              </>
            )}
            <Button variant="brand" leftIcon={<MdAdd />} onClick={() => setIsDialogOpen(true)} data-tour="add-patient">
              New Patient
            </Button>
          </>
        }
      />

      <Card>
        <Box mb="20px" data-tour="search">
          <SearchInput placeholder="Search patients..." value={search} onChange={setSearch} />
        </Box>

        <Box overflowX="auto" data-tour="patient-list">
          <Table variant="lined">
            <Thead>
              <Tr>
                <Th>Patient No.</Th>
                <Th>Name</Th>
                <Th>Phone</Th>
                <Th>Email</Th>
                <Th>Sex</Th>
                <Th>Registered</Th>
                <Th w="100px">Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {isLoading ? (
                <TableMessageRow colSpan={7} loading />
              ) : patients.length === 0 ? (
                <TableMessageRow colSpan={7}>No patients found</TableMessageRow>
              ) : (
                patients.map((patient: Patient) => (
                  <Tr key={patient.id}>
                    <Td fontFamily="mono">{patient.patient_number}</Td>
                    <Td>
                      <PersonCell round name={`${patient.first_name} ${patient.last_name}`} />
                    </Td>
                    <Td>{patient.phone || '-'}</Td>
                    <Td>{patient.email || '-'}</Td>
                    <Td textTransform="capitalize">{patient.sex || '-'}</Td>
                    <Td color="secondaryGray.600">
                      {new Date(patient.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </Td>
                    <Td>
                      <IconButton
                        aria-label="View patient"
                        variant="ghost"
                        size="sm"
                        icon={<MdVisibility />}
                        onClick={() => navigate(`/patients/${patient.id}`)}
                      />
                    </Td>
                  </Tr>
                ))
              )}
            </Tbody>
          </Table>
        </Box>
      </Card>

      <AppModal
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        title="Register New Patient"
        footer={
          <>
            <Button variant="light" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="new-patient-form" variant="brand" isLoading={createMutation.isPending} loadingText="Registering...">
              Register
            </Button>
          </>
        }
      >
        <form id="new-patient-form" onSubmit={handleSubmit}>
          <Stack spacing="16px">
            <SimpleGrid columns={2} spacing="16px">
              <Field label="First Name" isRequired>
                <Input variant="main" value={formData.first_name} onChange={set('first_name')} />
              </Field>
              <Field label="Last Name" isRequired>
                <Input variant="main" value={formData.last_name} onChange={set('last_name')} />
              </Field>
            </SimpleGrid>
            <Field label="Phone">
              <Input variant="main" value={formData.phone} onChange={set('phone')} />
            </Field>
            <Field label="Email">
              <Input variant="main" type="email" value={formData.email} onChange={set('email')} />
            </Field>
            <SimpleGrid columns={2} spacing="16px">
              <Field label="Sex">
                <Select variant="main" placeholder="Select" value={formData.sex} onChange={set('sex')}>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </Select>
              </Field>
              <Field label="Date of Birth">
                <Input variant="main" type="date" value={formData.date_of_birth} onChange={set('date_of_birth')} />
              </Field>
            </SimpleGrid>
            <Field label="Address">
              <Input variant="main" value={formData.address} onChange={set('address')} />
            </Field>
          </Stack>
        </form>
      </AppModal>
    </>
  )
}
