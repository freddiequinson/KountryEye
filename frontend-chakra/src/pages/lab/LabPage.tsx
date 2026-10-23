import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Badge,
  Box,
  Button,
  Flex,
  IconButton,
  Input,
  Radio,
  RadioGroup,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Textarea,
  Th,
  Thead,
  Tr,
  useColorModeValue,
} from '@chakra-ui/react'
import { MdAdd, MdBuild, MdCheck, MdClose, MdDelete, MdInventory, MdLocalShipping, MdVisibility } from 'react-icons/md'
import api from '@/lib/api'
import { apiErrorMessage } from '@/lib/errors'
import { useToast } from '@/hooks/use-toast'
import { useAuthStore } from '@/stores/auth'
import { getUserRole, hasPermission } from '@/config/nav'
import { ghs } from '@/lib/money'
import PageHeader from '@/components/PageHeader'
import TabCard from '@/components/card/TabCard'
import StatCard from '@/components/card/StatCard'
import { AppModal, ConfirmDialog, EmptyState, Field, SearchInput, TableBox, TableMessageRow } from '@/components/ui'

type Job = {
  id: number
  job_number: string
  status: 'received' | 'in_progress' | 'ready' | 'collected' | 'cancelled'
  patient_name: string
  patient_number?: string
  patient_phone?: string
  pickup_branch?: string
  estimated_ready_date?: string | null
  technician?: string | null
  overdue: boolean
  created_at: string
  ready_at?: string | null
  collected_at?: string | null
  notes?: string | null
  balance?: number
  visit_id?: number | null
  lens?: string | null
  frame?: string | null
  rx?: {
    od: { sphere?: string; cylinder?: string; axis?: string; va?: string }
    os: { sphere?: string; cylinder?: string; axis?: string; va?: string }
    add?: string; pd?: string; segment_height?: string; remarks?: string; doctor_delivery_date?: string | null
  } | null
}

const STATUS: Record<Job['status'], { label: string; color: string }> = {
  received: { label: 'New', color: 'blue' },
  in_progress: { label: 'Being made', color: 'yellow' },
  ready: { label: 'Ready', color: 'green' },
  collected: { label: 'Collected', color: 'gray' },
  cancelled: { label: 'Cancelled', color: 'red' },
}
const day = (d?: string | null) => (d ? new Date(d.length === 10 ? `${d}T00:00:00` : `${d}Z`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) : '—')
const isoIn = (days: number) => new Date(Date.now() + days * 864e5).toISOString().slice(0, 10)

function useJobs(status: string, search: string) {
  return useQuery({
    queryKey: ['lab-jobs', status, search],
    queryFn: async () => (await api.get('/lab/jobs', { params: { status: status || undefined, search: search || undefined } })).data as { items: Job[]; counts: Record<string, number> },
    refetchInterval: 30_000,
  })
}

function useJobAction() {
  const { toast } = useToast()
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, action, body }: { id: number; action: string; body?: any }) => api.post(`/lab/jobs/${id}/${action}`, body ?? {}),
    onSuccess: (_r, v) => {
      client.invalidateQueries({ queryKey: ['lab-jobs'] })
      toast({ title: { start: 'Ready date saved. The patient has been texted.', ready: 'Marked ready. The patient has been texted.', collected: 'Handed over', collect: 'Handed over', cancel: 'Job cancelled' }[v.action] ?? 'Saved' })
    },
    onError: (e) => toast({ title: 'Could not update the job', description: apiErrorMessage(e), variant: 'destructive' }),
  })
}

function RxTable({ rx }: { rx: NonNullable<Job['rx']> }) {
  const border = useColorModeValue('secondaryGray.100', 'whiteAlpha.100')
  const row = (eye: 'od' | 'os', label: string) => (
    <Tr>
      <Td fontWeight="700">{label}</Td>
      <Td>{rx[eye].sphere || '—'}</Td>
      <Td>{rx[eye].cylinder || '—'}</Td>
      <Td>{rx[eye].axis || '—'}</Td>
      <Td>{rx[eye].va || '—'}</Td>
    </Tr>
  )
  return (
    <Box border="1px solid" borderColor={border} borderRadius="14px" overflowX="auto">
      <Table size="sm">
        <Thead><Tr><Th>Eye</Th><Th>Sphere</Th><Th>Cylinder</Th><Th>Axis</Th><Th>VA</Th></Tr></Thead>
        <Tbody>{row('od', 'Right (OD)')}{row('os', 'Left (OS)')}</Tbody>
      </Table>
    </Box>
  )
}

function JobDetail({ job, onClose, canManage, canCollect }: { job: Job | null; onClose: () => void; canManage: boolean; canCollect: boolean }) {
  const action = useJobAction()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [date, setDate] = useState('')
  const [reason, setReason] = useState('')
  if (!job) return null
  const working = job.status === 'received' || job.status === 'in_progress'
  const owing = job.status === 'ready' && (job.balance ?? 0) > 0
  const close = () => { setReason(''); onClose() }
  return (
    <AppModal
      isOpen={!!job}
      onClose={close}
      size="2xl"
      title={<Flex align="center" gap="10px">{job.patient_name}<Badge colorScheme={STATUS[job.status].color}>{STATUS[job.status].label}</Badge>{job.overdue && <Badge colorScheme="red">Overdue</Badge>}</Flex>}
      description={`${job.job_number} · ${job.patient_phone || 'no phone'} · pickup at ${job.pickup_branch || '—'}`}
      footer={
        <>
          {canManage && working && (
            <Button variant="light" colorScheme="red" onClick={() => action.mutate({ id: job.id, action: 'cancel' }, { onSuccess: onClose })}>Cancel job</Button>
          )}
          {canManage && job.status === 'in_progress' && (
            <Button variant="brand" leftIcon={<MdCheck />} isLoading={action.isPending} onClick={() => action.mutate({ id: job.id, action: 'ready' }, { onSuccess: onClose })}>Glasses are ready</Button>
          )}
          {canCollect && owing && job.visit_id && (
            <Button variant="brand" onClick={() => navigate(`/frontdesk/checkout/${job.visit_id}`)}>Take payment</Button>
          )}
          {canCollect && job.status === 'ready' && !owing && (
            <Button variant="brand" leftIcon={<MdCheck />} isLoading={action.isPending} onClick={() => action.mutate({ id: job.id, action: 'collect' }, { onSuccess: close })}>Handed to patient</Button>
          )}
        </>
      }
    >
      <Stack spacing="18px">
        {job.rx && <RxTable rx={job.rx} />}
        <SimpleGrid columns={{ base: 2, md: 4 }} spacing="12px" fontSize="sm">
          <Box><Text color="secondaryGray.600">ADD</Text><Text fontWeight="700">{job.rx?.add || '—'}</Text></Box>
          <Box><Text color="secondaryGray.600">PD</Text><Text fontWeight="700">{job.rx?.pd || '—'}</Text></Box>
          <Box><Text color="secondaryGray.600">Seg. height</Text><Text fontWeight="700">{job.rx?.segment_height || '—'}</Text></Box>
          <Box><Text color="secondaryGray.600">Doctor's date</Text><Text fontWeight="700">{day(job.rx?.doctor_delivery_date)}</Text></Box>
          <Box gridColumn={{ base: 'span 2', md: 'span 2' }}><Text color="secondaryGray.600">Lens</Text><Text fontWeight="700">{job.lens || '—'}</Text></Box>
          <Box gridColumn={{ base: 'span 2', md: 'span 2' }}><Text color="secondaryGray.600">Frame</Text><Text fontWeight="700">{job.frame || '—'}</Text></Box>
        </SimpleGrid>
        {job.rx?.remarks && <Text fontSize="sm"><b>Doctor's remarks:</b> {job.rx.remarks}</Text>}
        {owing && (
          <Box p="16px" borderRadius="14px" bg="orange.50" _dark={{ bg: 'rgba(221,107,32,0.15)' }}>
            <Text fontWeight="700">{ghs(job.balance)} still owed on these glasses</Text>
            <Text fontSize="sm" color="secondaryGray.600">Take payment at checkout before handing them over.</Text>
            {canCollect && getUserRole(user) === 'admin' && (
              <Flex gap="8px" mt="12px" wrap="wrap">
                <Input variant="main" size="sm" flex="1" minW="200px" placeholder="Reason to hand over unpaid (saved in the audit log)" value={reason} onChange={(e) => setReason(e.target.value)} />
                <Button size="sm" variant="light" colorScheme="orange" isDisabled={!reason.trim()} isLoading={action.isPending}
                  onClick={() => action.mutate({ id: job.id, action: 'collect', body: { override_reason: reason.trim() } }, { onSuccess: close })}>
                  Hand over unpaid
                </Button>
              </Flex>
            )}
          </Box>
        )}
        {canManage && working && (
          <Box p="16px" borderRadius="14px" bg="brand.50" _dark={{ bg: 'whiteAlpha.100' }}>
            <Text fontWeight="700" mb="8px">{job.status === 'received' ? 'Start work: when will it be ready?' : `Ready by ${day(job.estimated_ready_date)}. Change the date?`}</Text>
            <Flex gap="8px" wrap="wrap" align="center">
              {[1, 2, 3, 5, 7].map((d) => (
                <Button key={d} size="sm" variant={date === isoIn(d) ? 'brand' : 'light'} onClick={() => setDate(isoIn(d))}>{d === 1 ? 'Tomorrow' : `${d} days`}</Button>
              ))}
              <Input variant="main" type="date" size="sm" maxW="170px" min={isoIn(0)} value={date} onChange={(e) => setDate(e.target.value)} />
              <Button size="sm" variant="brand" leftIcon={<MdBuild />} isDisabled={!date} isLoading={action.isPending}
                onClick={() => action.mutate({ id: job.id, action: 'start', body: { estimated_ready_date: date } }, { onSuccess: () => { setDate(''); onClose() } })}>
                {job.status === 'received' ? 'Start and text patient' : 'Save new date'}
              </Button>
            </Flex>
            <Text fontSize="xs" color="secondaryGray.600" mt="8px">The patient gets an SMS with this date.</Text>
          </Box>
        )}
      </Stack>
    </AppModal>
  )
}

/** Job list; also used on the front desk for glasses waiting to be collected. */
export function LabJobsTable({ status, compact = false }: { status: string; compact?: boolean }) {
  const { user } = useAuthStore()
  const canManage = hasPermission(user, ['lab.manage'])
  const canCollect = hasPermission(user, ['payments.create'])
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState<Job | null>(null)
  const navigate = useNavigate()
  const action = useJobAction()
  const { data, isLoading } = useJobs(status, search)
  const rows = data?.items ?? []
  return (
    <Stack spacing="14px">
      {!compact && <Box maxW="360px"><SearchInput placeholder="Patient, phone or job number" value={search} onChange={setSearch} /></Box>}
      <TableBox>
        <Table>
          <Thead><Tr><Th>Patient</Th><Th>Job</Th><Th>Lens / frame</Th><Th>Ready by</Th><Th>Status</Th><Th /></Tr></Thead>
          <Tbody>
            {isLoading ? <TableMessageRow colSpan={6} loading /> : rows.length === 0 ? (
              <TableMessageRow colSpan={6}>{status === 'ready' ? 'No glasses waiting to be collected.' : 'No jobs here.'}</TableMessageRow>
            ) : rows.map((j) => (
              <Tr key={j.id} bg={j.overdue ? 'red.50' : undefined} _dark={j.overdue ? { bg: 'rgba(229,62,62,0.12)' } : undefined}>
                <Td><Text fontWeight="700">{j.patient_name}</Text><Text fontSize="sm" color="secondaryGray.600">{j.patient_phone || j.patient_number}</Text></Td>
                <Td><Text>{j.job_number}</Text><Text fontSize="sm" color="secondaryGray.600">{j.pickup_branch}</Text></Td>
                <Td maxW="240px"><Text noOfLines={1}>{j.lens || '—'}</Text><Text fontSize="sm" color="secondaryGray.600" noOfLines={1}>{j.frame}</Text></Td>
                <Td whiteSpace="nowrap" color={j.overdue ? 'red.500' : undefined} fontWeight={j.overdue ? '700' : undefined}>{day(j.estimated_ready_date)}{j.overdue && ' · overdue'}</Td>
                <Td>
                  <Badge colorScheme={STATUS[j.status].color}>{STATUS[j.status].label}</Badge>
                  {j.status === 'ready' && (j.balance ?? 0) > 0 && <Text fontSize="sm" color="orange.500" fontWeight="700" mt="4px" whiteSpace="nowrap">Owes {ghs(j.balance)}</Text>}
                </Td>
                <Td textAlign="right" whiteSpace="nowrap">
                  {canCollect && j.status === 'ready' && (j.balance ?? 0) > 0 && (
                    <Button size="sm" variant="light" me="8px" onClick={() => (j.visit_id ? navigate(`/frontdesk/checkout/${j.visit_id}`) : setOpen(j))}>Take payment</Button>
                  )}
                  {canCollect && j.status === 'ready' && !((j.balance ?? 0) > 0) && (
                    <Button size="sm" variant="brand" me="8px" isLoading={action.isPending && action.variables?.id === j.id} onClick={() => action.mutate({ id: j.id, action: 'collect' })}>Collected</Button>
                  )}
                  {canManage && j.status === 'in_progress' && (
                    <Button size="sm" variant="brand" me="8px" isLoading={action.isPending && action.variables?.id === j.id} onClick={() => action.mutate({ id: j.id, action: 'ready' })}>Ready</Button>
                  )}
                  <IconButton aria-label="Open job" size="sm" variant="light" icon={<MdVisibility />} onClick={() => setOpen(j)} />
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </TableBox>
      <JobDetail job={open} onClose={() => setOpen(null)} canManage={canManage} canCollect={canCollect} />
    </Stack>
  )
}

function Queue() {
  const [status, setStatus] = useState('open')
  const { data } = useJobs('', '')
  const c = data?.counts ?? {}
  const chips: [string, string, number | undefined][] = [
    ['open', 'All open', (c.received ?? 0) + (c.in_progress ?? 0) + (c.ready ?? 0)],
    ['received', 'New', c.received],
    ['in_progress', 'Being made', c.in_progress],
    ['ready', 'Ready', c.ready],
    ['collected', 'Collected', c.collected],
  ]
  return (
    <Stack spacing="16px">
      <SimpleGrid columns={{ base: 2, lg: 4 }} spacing="16px">
        <StatCard name="New jobs" value={c.received ?? '…'} icon={MdInventory} />
        <StatCard name="Being made" value={c.in_progress ?? '…'} icon={MdBuild} />
        <StatCard name="Ready for pickup" value={c.ready ?? '…'} icon={MdCheck} />
        <StatCard name="Overdue" value={c.overdue ?? '…'} icon={MdClose} valueColor={c.overdue ? 'red.500' : undefined} />
      </SimpleGrid>
      <Flex gap="8px" wrap="wrap">
        {chips.map(([value, label, n]) => (
          <Button key={value} size="sm" variant={status === value ? 'brand' : 'light'} onClick={() => setStatus(value)}>
            {label}{n !== undefined ? ` (${n})` : ''}
          </Button>
        ))}
      </Flex>
      <LabJobsTable status={status} />
    </Stack>
  )
}

// ---------- deliveries ----------

function NewDelivery({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { toast } = useToast()
  const client = useQueryClient()
  const [dest, setDest] = useState<'branch' | 'warehouse'>('branch')
  const [destId, setDestId] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<{ product_id: string; quantity: string }[]>([{ product_id: '', quantity: '' }])
  const [newLens, setNewLens] = useState({ name: '', unit_price: '' })
  const { data: branches = [] } = useQuery({ queryKey: ['branches-list'], queryFn: async () => (await api.get('/branches')).data })
  const { data: warehouses = [] } = useQuery({ queryKey: ['warehouses-list'], queryFn: async () => (await api.get('/inventory/warehouses')).data, enabled: isOpen })
  const { data: lens } = useQuery({ queryKey: ['lens-products'], queryFn: async () => (await api.get('/lab/lens-products')).data, enabled: isOpen })
  const products = lens?.products ?? []
  const addLens = useMutation({
    mutationFn: () => api.post('/lab/lens-products', { name: newLens.name, unit_price: parseFloat(newLens.unit_price) || 0 }),
    onSuccess: (r) => {
      client.invalidateQueries({ queryKey: ['lens-products'] })
      setLines((ls) => [...ls.filter((l) => l.product_id), { product_id: String(r.data.id), quantity: '' }])
      setNewLens({ name: '', unit_price: '' })
      toast({ title: 'Lens added' })
    },
    onError: (e) => toast({ title: 'Could not add lens', description: apiErrorMessage(e), variant: 'destructive' }),
  })
  const items = lines.filter((l) => l.product_id && parseInt(l.quantity) > 0).map((l) => ({ product_id: Number(l.product_id), quantity: parseInt(l.quantity) }))
  const create = useMutation({
    mutationFn: () => api.post('/lab/deliveries', { destination_type: dest, branch_id: dest === 'branch' ? Number(destId) : null, warehouse_id: dest === 'warehouse' ? Number(destId) : null, items, notes: notes || null }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['lab-deliveries'] })
      toast({ title: 'Delivery recorded', description: 'Stock goes up once the receiving side confirms it.' })
      setLines([{ product_id: '', quantity: '' }])
      setNotes('')
      onClose()
    },
    onError: (e) => toast({ title: 'Could not record delivery', description: apiErrorMessage(e), variant: 'destructive' }),
  })
  return (
    <AppModal isOpen={isOpen} onClose={onClose} size="2xl" title="New lens delivery" description="For lenses made for stock, not for a patient's order."
      footer={<><Button variant="light" onClick={onClose}>Cancel</Button><Button variant="brand" isDisabled={!destId || !items.length} isLoading={create.isPending} onClick={() => create.mutate()}>Record delivery</Button></>}>
      <Stack spacing="18px">
        <Field label="Deliver to">
          <RadioGroup value={dest} onChange={(v) => { setDest(v as 'branch' | 'warehouse'); setDestId('') }}>
            <Flex gap="20px"><Radio value="branch">A branch</Radio><Radio value="warehouse">The warehouse</Radio></Flex>
          </RadioGroup>
        </Field>
        <Select variant="main" placeholder={dest === 'branch' ? 'Choose branch' : 'Choose warehouse'} value={destId} onChange={(e) => setDestId(e.target.value)}>
          {(dest === 'branch' ? branches : warehouses).map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </Select>
        <Box>
          <Text fontWeight="700" mb="8px">Lenses</Text>
          <Stack spacing="8px">
            {lines.map((l, i) => (
              <Flex key={i} gap="8px">
                <Select variant="main" placeholder="Choose lens" value={l.product_id} onChange={(e) => setLines(lines.map((x, k) => (k === i ? { ...x, product_id: e.target.value } : x)))}>
                  {products.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
                <Input variant="main" type="number" min={1} placeholder="Qty" w="110px" value={l.quantity} onChange={(e) => setLines(lines.map((x, k) => (k === i ? { ...x, quantity: e.target.value } : x)))} />
                <IconButton aria-label="Remove" variant="ghost" icon={<MdDelete />} isDisabled={lines.length === 1} onClick={() => setLines(lines.filter((_, k) => k !== i))} />
              </Flex>
            ))}
            <Button size="sm" variant="light" alignSelf="start" leftIcon={<MdAdd />} onClick={() => setLines([...lines, { product_id: '', quantity: '' }])}>Add line</Button>
          </Stack>
        </Box>
        <Box p="14px" borderRadius="14px" bg="secondaryGray.300" _dark={{ bg: 'whiteAlpha.100' }}>
          <Text fontWeight="700" mb="8px" fontSize="sm">Lens not in the list?</Text>
          <Flex gap="8px" wrap="wrap">
            <Input variant="main" size="sm" flex="1" minW="200px" placeholder="e.g. Poly 1.59 Blue-cut SV" value={newLens.name} onChange={(e) => setNewLens({ ...newLens, name: e.target.value })} />
            <Input variant="main" size="sm" w="140px" type="number" min={0} placeholder="Price (GH₵)" value={newLens.unit_price} onChange={(e) => setNewLens({ ...newLens, unit_price: e.target.value })} />
            <Button size="sm" variant="brand" isDisabled={newLens.name.trim().length < 2} isLoading={addLens.isPending} onClick={() => addLens.mutate()}>Add lens</Button>
          </Flex>
        </Box>
        <Field label="Notes"><Textarea variant="main" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      </Stack>
    </AppModal>
  )
}

function Deliveries() {
  const { user } = useAuthStore()
  const { toast } = useToast()
  const client = useQueryClient()
  const canCreate = hasPermission(user, ['lab.deliveries'])
  const [open, setOpen] = useState(false)
  const [rejecting, setRejecting] = useState<any>(null)
  const [reason, setReason] = useState('')
  const { data: rows = [], isLoading } = useQuery({ queryKey: ['lab-deliveries'], queryFn: async () => (await api.get('/lab/deliveries')).data })
  const done = () => client.invalidateQueries({ queryKey: ['lab-deliveries'] })
  const confirm = useMutation({
    mutationFn: (id: number) => api.post(`/lab/deliveries/${id}/confirm`),
    onSuccess: () => { done(); toast({ title: 'Received. Stock updated.' }) },
    onError: (e) => toast({ title: 'Could not confirm', description: apiErrorMessage(e), variant: 'destructive' }),
  })
  const reject = useMutation({
    mutationFn: () => api.post(`/lab/deliveries/${rejecting.id}/reject`, { reason }),
    onSuccess: () => { done(); setRejecting(null); setReason(''); toast({ title: 'Delivery rejected' }) },
    onError: (e) => toast({ title: 'Could not reject', description: apiErrorMessage(e), variant: 'destructive' }),
  })
  const pending = useMemo(() => rows.filter((r: any) => r.can_confirm).length, [rows])
  return (
    <Stack spacing="16px">
      <Flex justify="space-between" align="center" gap="12px" wrap="wrap">
        <Text color="secondaryGray.600">{pending ? `${pending} waiting for you to check in.` : 'Lens deliveries from the lab. Stock goes up when the receiving side confirms.'}</Text>
        {canCreate && <Button variant="brand" leftIcon={<MdLocalShipping />} onClick={() => setOpen(true)}>New delivery</Button>}
      </Flex>
      {!isLoading && rows.length === 0 ? (
        <EmptyState icon={MdLocalShipping} title="No deliveries yet" />
      ) : (
        <TableBox>
          <Table>
            <Thead><Tr><Th>Delivery</Th><Th>To</Th><Th>Lenses</Th><Th>Status</Th><Th /></Tr></Thead>
            <Tbody>
              {isLoading ? <TableMessageRow colSpan={5} loading /> : rows.map((d: any) => (
                <Tr key={d.id}>
                  <Td><Text fontWeight="700">{d.delivery_number}</Text><Text fontSize="sm" color="secondaryGray.600">{d.technician} · {new Date(`${d.created_at}Z`).toLocaleDateString()}</Text></Td>
                  <Td>{d.destination}</Td>
                  <Td maxW="320px">{d.items.map((i: any) => <Text key={i.product_id} fontSize="sm">{i.quantity} × {i.product}</Text>)}</Td>
                  <Td>
                    <Badge colorScheme={{ pending: 'yellow', confirmed: 'green', rejected: 'red' }[d.status as string]}>{d.status === 'pending' ? 'Waiting' : d.status}</Badge>
                    {d.reject_reason && <Text fontSize="xs" color="red.500">{d.reject_reason}</Text>}
                    {d.confirmed_by && d.status === 'confirmed' && <Text fontSize="xs" color="secondaryGray.600">by {d.confirmed_by}</Text>}
                  </Td>
                  <Td textAlign="right" whiteSpace="nowrap">
                    {d.can_confirm && (
                      <>
                        <Button size="sm" variant="brand" me="8px" isLoading={confirm.isPending && confirm.variables === d.id} onClick={() => confirm.mutate(d.id)}>Received</Button>
                        <Button size="sm" variant="light" onClick={() => setRejecting(d)}>Reject</Button>
                      </>
                    )}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableBox>
      )}
      <NewDelivery isOpen={open} onClose={() => setOpen(false)} />
      <ConfirmDialog isOpen={!!rejecting} onClose={() => setRejecting(null)} onConfirm={() => reject.mutate()} title={`Reject ${rejecting?.delivery_number}?`} confirmLabel="Reject" isLoading={reject.isPending}>
        <Text mb="8px">Stock won't change. Tell the lab why:</Text>
        <Input variant="main" placeholder="e.g. 2 lenses scratched, count was 8 not 10" value={reason} onChange={(e) => setReason(e.target.value)} />
      </ConfirmDialog>
    </Stack>
  )
}

export default function LabPage() {
  const { user } = useAuthStore()
  const [params] = useSearchParams()
  const canJobs = hasPermission(user, ['lab.view', 'lab.manage'])
  const canDeliveries = hasPermission(user, ['lab.deliveries', 'inventory.receive', 'inventory.manage'])
  const tabs = [
    canJobs && { label: 'Glasses jobs', icon: MdBuild, content: <Queue /> },
    canDeliveries && { label: 'Lens deliveries', icon: MdLocalShipping, content: <Deliveries /> },
  ].filter(Boolean) as { label: string; icon: any; content: React.ReactNode }[]
  const start = params.get('tab') === 'deliveries' ? Math.max(tabs.findIndex((t) => t.label === 'Lens deliveries'), 0) : 0
  return (
    <>
      <PageHeader title="Lab" description="Glasses being made, ready for pickup, and lens deliveries." />
      <TabCard tabs={tabs} defaultIndex={start} />
    </>
  )
}
