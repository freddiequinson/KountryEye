import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Checkbox,
  Flex,
  IconButton,
  Input,
  InputGroup,
  InputLeftAddon,
  Radio,
  RadioGroup,
  Select,
  SimpleGrid,
  Stack,
  Switch,
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
import { MdAccountBalanceWallet, MdCampaign, MdDelete, MdGroups, MdHistory, MdMoneyOff, MdSend, MdWarningAmber } from 'react-icons/md'
import api from '@/lib/api'
import { apiErrorMessage } from '@/lib/errors'
import { ghs } from '@/lib/money'
import { smsInfo, SMS_CATEGORY, SMS_STATUS } from '@/lib/sms'
import { useToast } from '@/hooks/use-toast'
import { useAuthStore } from '@/stores/auth'
import { hasPermission } from '@/config/nav'
import PageHeader from '@/components/PageHeader'
import TabCard from '@/components/card/TabCard'
import Card from '@/components/card/Card'
import { FormSection } from '@/components/FormSection'
import { AppModal, ConfirmDialog, EmptyState, Field, Pagination, SearchInput, TableBox, TableMessageRow } from '@/components/ui'

type Credit = { balance: number; overdraft_limit: number; shop_rate: number; can_send: boolean; low: boolean; messages_left: number | null }

const fmtDate = (s?: string | null) => (s ? new Date(`${s}${s.endsWith('Z') ? '' : 'Z'}`).toLocaleString() : '—')

function useCredit() {
  return useQuery({ queryKey: ['sms-credit'], queryFn: async () => (await api.get('/sms/credit')).data as Credit, refetchInterval: 60_000 })
}

// ---------- shared bits ----------

function CreditStrip() {
  const { data } = useCredit()
  if (!data) return null
  const status = !data.can_send ? 'error' : data.low ? 'warning' : 'info'
  return (
    <Alert status={status} borderRadius="16px" mb="20px">
      <AlertIcon as={!data.can_send ? MdMoneyOff : data.low ? MdWarningAmber : MdAccountBalanceWallet} />
      <Text>
        SMS credit: <b>{ghs(data.balance)}</b>
        {data.messages_left !== null && <> · about {Math.max(data.messages_left, 0).toLocaleString()} messages left</>}
        {!data.can_send && ' · Sending is paused until the superadmin tops up.'}
        {data.can_send && data.low && ' · Running low. Ask the superadmin to top up.'}
      </Text>
    </Alert>
  )
}

function MessageBox({ value, onChange, placeholder, rate }: { value: string; onChange: (v: string) => void; placeholder?: string; rate?: number }) {
  const info = smsInfo(value)
  const over = info.segments > 1
  return (
    <Box>
      <Textarea variant="main" rows={4} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} maxLength={918} />
      <Flex justify="space-between" mt="6px" fontSize="sm" color={over ? 'orange.500' : 'secondaryGray.600'}>
        <Text>
          {info.characters} characters · {info.segments} SMS{info.segments > 1 ? ' each' : ''}
          {info.unicode && ' · emoji/special characters cut the limit to 70'}
        </Text>
        {rate ? <Text>{ghs(rate * info.segments)} per person</Text> : null}
      </Flex>
    </Box>
  )
}

function StatusBadge({ status }: { status: string }) {
  const s = SMS_STATUS[status] ?? { label: status, color: 'gray' }
  return <Badge colorScheme={s.color}>{s.label}</Badge>
}

// ---------- Send one ----------

function SendTab() {
  const { toast } = useToast()
  const client = useQueryClient()
  const [search, setSearch] = useState('')
  const [patient, setPatient] = useState<any>(null)
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const credit = useCredit().data
  const { data: results = [] } = useQuery({
    queryKey: ['sms-patient-search', search],
    queryFn: async () => (await api.get('/patients/search', { params: { q: search } })).data,
    enabled: search.length >= 2 && !patient,
  })
  const send = useMutation({
    mutationFn: () => api.post('/sms/send', { message, patient_id: patient?.id ?? null, phone: patient ? null : phone }),
    onSuccess: () => {
      toast({ title: 'Message sent' })
      setMessage('')
      client.invalidateQueries({ queryKey: ['sms-messages'] })
      client.invalidateQueries({ queryKey: ['sms-credit'] })
    },
    onError: (e) => toast({ title: 'Could not send', description: apiErrorMessage(e), variant: 'destructive' }),
  })

  return (
    <Stack spacing="0" maxW="900px">
      <FormSection title="To" description="Pick a patient, or type any Ghana number.">
        <Box gridColumn={{ md: 'span 2' }}>
          {patient ? (
            <Flex align="center" justify="space-between" p="12px 16px" borderRadius="14px" bg="brand.50" _dark={{ bg: 'whiteAlpha.100' }}>
              <Box>
                <Text fontWeight="700">{patient.first_name} {patient.last_name}</Text>
                <Text fontSize="sm" color="secondaryGray.600">{patient.phone || 'No phone number'} · {patient.patient_number}</Text>
              </Box>
              <Button size="sm" variant="light" onClick={() => setPatient(null)}>Change</Button>
            </Flex>
          ) : (
            <Stack spacing="12px">
              <SearchInput placeholder="Search patient by name or phone" value={search} onChange={setSearch} />
              {results.slice(0, 6).map((p: any) => (
                <Flex key={p.id} as="button" type="button" justify="space-between" p="10px 14px" borderRadius="12px" border="1px solid" borderColor="secondaryGray.100" _dark={{ borderColor: 'whiteAlpha.100' }} _hover={{ bg: 'secondaryGray.300', _dark: { bg: 'whiteAlpha.100' } }} onClick={() => { setPatient(p); setSearch('') }}>
                  <Text fontWeight="600">{p.first_name} {p.last_name}</Text>
                  <Text fontSize="sm" color="secondaryGray.600">{p.phone}</Text>
                </Flex>
              ))}
              <Field label="Or a phone number">
                <Input variant="main" placeholder="024 123 4567" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </Field>
            </Stack>
          )}
        </Box>
      </FormSection>
      <FormSection title="Message" description="Plain and short works best. One SMS is 160 characters." columns={1}>
        <MessageBox value={message} onChange={setMessage} rate={credit?.shop_rate} />
        <Button variant="brand" alignSelf="start" leftIcon={<MdSend />} isLoading={send.isPending} isDisabled={!message.trim() || (!patient && !phone.trim())} onClick={() => send.mutate()}>
          Send
        </Button>
      </FormSection>
    </Stack>
  )
}

// ---------- Campaigns ----------

type Audience = { type: 'filters' | 'group' | 'numbers'; [k: string]: any }

function AudienceEditor({ audience, setAudience }: { audience: Audience; setAudience: (a: Audience) => void }) {
  const { data: branches = [] } = useQuery({ queryKey: ['branches-list'], queryFn: async () => (await api.get('/branches')).data })
  const { data: groups = [] } = useQuery({ queryKey: ['sms-groups'], queryFn: async () => (await api.get('/sms/groups')).data })
  const { data: insurers = [] } = useQuery({ queryKey: ['insurance-list'], queryFn: async () => (await api.get('/insurance/list')).data })
  const set = (k: string, v: any) => setAudience({ ...audience, [k]: v })

  return (
    <Stack spacing="16px">
      <RadioGroup value={audience.type} onChange={(v) => setAudience({ type: v as Audience['type'] })}>
        <Flex gap="20px" wrap="wrap">
          <Radio value="filters">Patients matching filters</Radio>
          <Radio value="group">A saved group</Radio>
          <Radio value="numbers">Paste numbers</Radio>
        </Flex>
      </RadioGroup>
      {audience.type === 'filters' && (
        <SimpleGrid columns={{ base: 1, md: 3 }} spacing="12px">
          <Field label="Branch">
            <Select variant="main" value={audience.branch_id ?? ''} onChange={(e) => set('branch_id', e.target.value || undefined)}>
              <option value="">All branches</option>
              {branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
          <Field label="Sex">
            <Select variant="main" value={audience.sex ?? ''} onChange={(e) => set('sex', e.target.value || undefined)}>
              <option value="">Anyone</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
            </Select>
          </Field>
          <Field label="Insurance">
            <Select variant="main" value={audience.insurance ?? ''} onChange={(e) => set('insurance', e.target.value || undefined)}>
              <option value="">Doesn't matter</option>
              <option value="any">Has used insurance</option>
              <option value="none">Never used insurance</option>
              {insurers.map((i: any) => <option key={i.id} value={i.name}>{i.name}</option>)}
            </Select>
          </Field>
          <Field label="Age from">
            <Input variant="main" type="number" min={0} value={audience.min_age ?? ''} onChange={(e) => set('min_age', e.target.value || undefined)} />
          </Field>
          <Field label="Age to">
            <Input variant="main" type="number" min={0} value={audience.max_age ?? ''} onChange={(e) => set('max_age', e.target.value || undefined)} />
          </Field>
          <Field label="Owes money">
            <Flex h="44px" align="center">
              <Switch isChecked={!!audience.has_balance} onChange={(e) => set('has_balance', e.target.checked || undefined)} />
            </Flex>
          </Field>
          <Field label="Last visit after">
            <Input variant="main" type="date" value={audience.last_visit_after ?? ''} onChange={(e) => set('last_visit_after', e.target.value || undefined)} />
          </Field>
          <Field label="Last visit before">
            <Input variant="main" type="date" value={audience.last_visit_before ?? ''} onChange={(e) => set('last_visit_before', e.target.value || undefined)} />
          </Field>
        </SimpleGrid>
      )}
      {audience.type === 'group' && (
        <Field label="Group">
          <Select variant="main" placeholder="Choose a group" value={audience.group_id ?? ''} onChange={(e) => set('group_id', e.target.value)}>
            {groups.map((g: any) => <option key={g.id} value={g.id}>{g.name} ({g.members})</option>)}
          </Select>
        </Field>
      )}
      {audience.type === 'numbers' && (
        <Field label="Phone numbers" helper="One per line, or separated by commas. Copy a column straight from Excel.">
          <Textarea variant="main" rows={5} value={audience.numbers ?? ''} onChange={(e) => set('numbers', e.target.value)} />
        </Field>
      )}
    </Stack>
  )
}

function usePreview(message: string, audience: Audience | null, enabled: boolean) {
  const [debounced, setDebounced] = useState({ message, audience })
  useEffect(() => {
    const t = setTimeout(() => setDebounced({ message, audience }), 400)
    return () => clearTimeout(t)
  }, [message, audience])
  return useQuery({
    queryKey: ['sms-preview', debounced],
    queryFn: async () => (await api.post('/sms/preview', debounced)).data,
    enabled,
    placeholderData: (prev: any) => prev,
  })
}

function PreviewPanel({ preview }: { preview: any }) {
  const border = useColorModeValue('secondaryGray.100', 'whiteAlpha.100')
  if (!preview) return null
  return (
    <SimpleGrid columns={{ base: 2, md: 4 }} spacing="12px" p="16px" borderRadius="16px" border="1px solid" borderColor={border}>
      <Box>
        <Text fontSize="sm" color="secondaryGray.600">Recipients</Text>
        <Text fontSize="xl" fontWeight="700">{preview.recipients.toLocaleString()}</Text>
        {(preview.skipped_opt_out > 0 || preview.skipped_no_phone > 0) && (
          <Text fontSize="xs" color="secondaryGray.600">
            {preview.skipped_opt_out > 0 && `${preview.skipped_opt_out} opted out`}
            {preview.skipped_opt_out > 0 && preview.skipped_no_phone > 0 && ' · '}
            {preview.skipped_no_phone > 0 && `${preview.skipped_no_phone} no number`}
          </Text>
        )}
      </Box>
      <Box>
        <Text fontSize="sm" color="secondaryGray.600">SMS each</Text>
        <Text fontSize="xl" fontWeight="700">{preview.segments}</Text>
      </Box>
      <Box>
        <Text fontSize="sm" color="secondaryGray.600">Cost</Text>
        <Text fontSize="xl" fontWeight="700">{ghs(preview.cost)}</Text>
      </Box>
      <Box>
        <Text fontSize="sm" color="secondaryGray.600">Credit after</Text>
        <Text fontSize="xl" fontWeight="700" color={preview.within_credit ? undefined : 'red.500'}>{ghs(preview.credit_after)}</Text>
      </Box>
      {preview.sample?.length > 0 && (
        <Text gridColumn={{ base: 'span 2', md: 'span 4' }} fontSize="sm" color="secondaryGray.600">
          Including {preview.sample.join(', ')}{preview.recipients > preview.sample.length ? '…' : ''}
        </Text>
      )}
    </SimpleGrid>
  )
}

function NewCampaign({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { toast } = useToast()
  const client = useQueryClient()
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [audience, setAudience] = useState<Audience>({ type: 'filters' })
  const [later, setLater] = useState(false)
  const [when, setWhen] = useState('')
  const ready = !!message.trim() && (audience.type !== 'group' || !!audience.group_id) && (audience.type !== 'numbers' || !!audience.numbers?.trim())
  const preview = usePreview(message, audience, isOpen && ready).data
  const create = useMutation({
    mutationFn: () => api.post('/sms/campaigns', { name, message, audience, scheduled_at: later && when ? new Date(when).toISOString() : null }),
    onSuccess: (r) => {
      toast({ title: r.data.status === 'scheduled' ? 'Campaign scheduled' : `Sending to ${r.data.recipients} people` })
      client.invalidateQueries({ queryKey: ['sms-campaigns'] })
      client.invalidateQueries({ queryKey: ['sms-credit'] })
      setName('')
      setMessage('')
      setAudience({ type: 'filters' })
      setLater(false)
      onClose()
    },
    onError: (e) => toast({ title: 'Could not create campaign', description: apiErrorMessage(e), variant: 'destructive' }),
  })

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      size="4xl"
      title="New campaign"
      description="Patients who opted out of promotions are left out automatically."
      footer={
        <>
          <Button variant="light" onClick={onClose}>Cancel</Button>
          <Button
            variant="brand"
            leftIcon={<MdSend />}
            isLoading={create.isPending}
            isDisabled={!name.trim() || !ready || !preview?.recipients || !preview?.within_credit || (later && !when)}
            onClick={() => create.mutate()}
          >
            {later ? 'Schedule' : `Send to ${preview?.recipients ?? 0}`}
          </Button>
        </>
      }
    >
      <Stack spacing="20px">
        <Field label="Campaign name" isRequired helper="Only you see this.">
          <Input variant="main" placeholder="December frames promo" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Box>
          <Text fontWeight="700" mb="10px">Who</Text>
          <AudienceEditor audience={audience} setAudience={setAudience} />
        </Box>
        <Field label="Message" helper="{first_name} is replaced with each patient's first name.">
          <MessageBox value={message} onChange={setMessage} placeholder="Kountry Eyecare: 20% off all frames this week. Visit us at Osu." rate={preview?.shop_rate} />
        </Field>
        <Flex align="center" gap="12px" wrap="wrap">
          <Switch isChecked={later} onChange={(e) => setLater(e.target.checked)} />
          <Text>Send later</Text>
          {later && <Input variant="main" type="datetime-local" maxW="260px" value={when} onChange={(e) => setWhen(e.target.value)} />}
        </Flex>
        {ready && <PreviewPanel preview={preview} />}
      </Stack>
    </AppModal>
  )
}

function CampaignsTab() {
  const { toast } = useToast()
  const client = useQueryClient()
  const [open, setOpen] = useState(false)
  const { data: rows = [], isLoading } = useQuery({ queryKey: ['sms-campaigns'], queryFn: async () => (await api.get('/sms/campaigns')).data })
  const cancel = useMutation({
    mutationFn: (id: number) => api.post(`/sms/campaigns/${id}/cancel`),
    onSuccess: () => { client.invalidateQueries({ queryKey: ['sms-campaigns'] }); toast({ title: 'Campaign cancelled' }) },
    onError: (e) => toast({ title: 'Could not cancel', description: apiErrorMessage(e), variant: 'destructive' }),
  })
  return (
    <Stack spacing="16px">
      <Flex justify="space-between" align="center" gap="12px" wrap="wrap">
        <Text color="secondaryGray.600">Promotions and announcements to many people at once.</Text>
        <Button variant="brand" leftIcon={<MdCampaign />} onClick={() => setOpen(true)}>New campaign</Button>
      </Flex>
      <TableBox>
        <Table>
          <Thead><Tr><Th>Campaign</Th><Th>Status</Th><Th isNumeric>People</Th><Th isNumeric>Cost</Th><Th>When</Th><Th /></Tr></Thead>
          <Tbody>
            {isLoading ? <TableMessageRow colSpan={6} loading /> : rows.length === 0 ? <TableMessageRow colSpan={6}>No campaigns yet.</TableMessageRow> : rows.map((c: any) => (
              <Tr key={c.id}>
                <Td maxW="360px">
                  <Text fontWeight="700">{c.name}</Text>
                  <Text fontSize="sm" color="secondaryGray.600" noOfLines={1}>{c.message}</Text>
                </Td>
                <Td>
                  <Badge colorScheme={{ scheduled: 'blue', sending: 'yellow', sent: 'green', cancelled: 'gray' }[c.status as string] ?? 'gray'}>{c.status}</Badge>
                  {c.delivery?.failed > 0 && <Text fontSize="xs" color="red.500" mt="4px">{c.delivery.failed} failed</Text>}
                </Td>
                <Td isNumeric>{c.recipients}</Td>
                <Td isNumeric>{ghs(c.cost)}</Td>
                <Td whiteSpace="nowrap">{fmtDate(c.scheduled_at ?? c.finished_at ?? c.created_at)}</Td>
                <Td textAlign="right">{c.status === 'scheduled' && <Button size="sm" variant="light" onClick={() => cancel.mutate(c.id)}>Cancel</Button>}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </TableBox>
      <NewCampaign isOpen={open} onClose={() => setOpen(false)} />
    </Stack>
  )
}

// ---------- Groups ----------

function GroupDetail({ id, onClose }: { id: number | null; onClose: () => void }) {
  const { toast } = useToast()
  const client = useQueryClient()
  const [numbers, setNumbers] = useState('')
  const { data } = useQuery({ queryKey: ['sms-group', id], queryFn: async () => (await api.get(`/sms/groups/${id}`)).data, enabled: !!id })
  const refresh = () => { client.invalidateQueries({ queryKey: ['sms-group', id] }); client.invalidateQueries({ queryKey: ['sms-groups'] }) }
  const add = useMutation({
    mutationFn: () => api.post(`/sms/groups/${id}/members`, { numbers }),
    onSuccess: (r) => { refresh(); setNumbers(''); toast({ title: `Added ${r.data.added}`, description: r.data.invalid ? `${r.data.invalid} numbers weren't valid` : undefined }) },
    onError: (e) => toast({ title: 'Could not add', description: apiErrorMessage(e), variant: 'destructive' }),
  })
  const remove = useMutation({ mutationFn: (mid: number) => api.delete(`/sms/groups/${id}/members/${mid}`), onSuccess: refresh })
  return (
    <AppModal isOpen={!!id} onClose={onClose} size="2xl" title={data?.name ?? 'Group'} description={data ? `${data.members.length} people` : undefined}>
      <Stack spacing="16px">
        <Field label="Add numbers" helper='One per line. "Name<tab>number" from Excel keeps the name.'>
          <Textarea variant="main" rows={3} value={numbers} onChange={(e) => setNumbers(e.target.value)} />
        </Field>
        <Button variant="brand" alignSelf="start" isDisabled={!numbers.trim()} isLoading={add.isPending} onClick={() => add.mutate()}>Add</Button>
        <Stack spacing="6px" maxH="320px" overflowY="auto">
          {data?.members.map((m: any) => (
            <Flex key={m.id} justify="space-between" align="center" py="6px" borderBottom="1px solid" borderColor="secondaryGray.100" _dark={{ borderColor: 'whiteAlpha.100' }}>
              <Text>{m.name || '—'} <Text as="span" color="secondaryGray.600" ms="8px">{m.phone}</Text></Text>
              <IconButton aria-label="Remove" size="sm" variant="ghost" icon={<MdDelete />} onClick={() => remove.mutate(m.id)} />
            </Flex>
          ))}
        </Stack>
      </Stack>
    </AppModal>
  )
}

function GroupsTab() {
  const { toast } = useToast()
  const client = useQueryClient()
  const [name, setName] = useState('')
  const [openId, setOpenId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState<any>(null)
  const { data: groups = [], isLoading } = useQuery({ queryKey: ['sms-groups'], queryFn: async () => (await api.get('/sms/groups')).data })
  const create = useMutation({
    mutationFn: () => api.post('/sms/groups', { name }),
    onSuccess: (r) => { client.invalidateQueries({ queryKey: ['sms-groups'] }); setName(''); setOpenId(r.data.id) },
    onError: (e) => toast({ title: 'Could not create group', description: apiErrorMessage(e), variant: 'destructive' }),
  })
  const del = useMutation({
    mutationFn: (id: number) => api.delete(`/sms/groups/${id}`),
    onSuccess: () => { client.invalidateQueries({ queryKey: ['sms-groups'] }); setDeleting(null) },
  })
  return (
    <Stack spacing="16px">
      <Flex gap="8px" maxW="520px">
        <Input variant="main" placeholder="New group name, e.g. Corporate clients" value={name} onChange={(e) => setName(e.target.value)} />
        <Button variant="brand" isDisabled={!name.trim()} isLoading={create.isPending} onClick={() => create.mutate()}>Create</Button>
      </Flex>
      {isLoading ? null : groups.length === 0 ? (
        <EmptyState icon={MdGroups} title="No groups yet">Save lists of people you message often, like staff of a partner company.</EmptyState>
      ) : (
        <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing="16px">
          {groups.map((g: any) => (
            <Card key={g.id} cursor="pointer" onClick={() => setOpenId(g.id)} _hover={{ boxShadow: 'pop' }}>
              <Flex justify="space-between" align="start">
                <Box>
                  <Text fontWeight="700" fontSize="lg">{g.name}</Text>
                  <Text color="secondaryGray.600">{g.members} people</Text>
                </Box>
                <IconButton aria-label="Delete group" size="sm" variant="ghost" icon={<MdDelete />} onClick={(e) => { e.stopPropagation(); setDeleting(g) }} />
              </Flex>
            </Card>
          ))}
        </SimpleGrid>
      )}
      <GroupDetail id={openId} onClose={() => setOpenId(null)} />
      <ConfirmDialog isOpen={!!deleting} onClose={() => setDeleting(null)} onConfirm={() => del.mutate(deleting.id)} title={`Delete ${deleting?.name}?`} isLoading={del.isPending}>
        The group and its list of numbers will be removed. Messages already sent are kept in the log.
      </ConfirmDialog>
    </Stack>
  )
}

// ---------- Debtors ----------

function DebtorsTab({ canSend }: { canSend: boolean }) {
  const { toast } = useToast()
  const client = useQueryClient()
  const [min, setMin] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [confirm, setConfirm] = useState(false)
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['sms-debtors', min],
    queryFn: async () => (await api.get('/sms/debtors', { params: { min_balance: parseFloat(min) || 0 } })).data,
  })
  const shown = useMemo(() => rows.filter((r: any) => !search || `${r.name} ${r.phone} ${r.patient_number}`.toLowerCase().includes(search.toLowerCase())), [rows, search])
  const total = shown.reduce((s: number, r: any) => s + r.balance, 0)
  const remind = useMutation({
    mutationFn: () => api.post('/sms/debtors/remind', { patient_ids: Array.from(selected) }),
    onSuccess: (r) => {
      toast({ title: `Reminder sent to ${r.data.queued}`, description: r.data.skipped ? `${r.data.skipped} skipped (no number, paid up, or already reminded today)` : undefined })
      setSelected(new Set())
      setConfirm(false)
      client.invalidateQueries({ queryKey: ['sms-debtors'] })
      client.invalidateQueries({ queryKey: ['sms-credit'] })
    },
    onError: (e) => toast({ title: 'Could not send', description: apiErrorMessage(e), variant: 'destructive' }),
  })
  const toggle = (id: number) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const selectable = shown.filter((r: any) => r.has_valid_phone)

  return (
    <Stack spacing="16px">
      <Flex gap="12px" wrap="wrap" align="end" justify="space-between">
        <Flex gap="12px" wrap="wrap" align="end">
          <Box w={{ base: '100%', md: '280px' }}><SearchInput placeholder="Search name or phone" value={search} onChange={setSearch} /></Box>
          <Field label="Owes at least" w="180px">
            <InputGroup><InputLeftAddon>GH₵</InputLeftAddon><Input variant="main" type="number" min={0} value={min} onChange={(e) => setMin(e.target.value)} /></InputGroup>
          </Field>
        </Flex>
        <Flex align="center" gap="16px">
          <Text color="secondaryGray.600">{shown.length} people · {ghs(total)} owed</Text>
          {canSend && <Button variant="brand" leftIcon={<MdSend />} isDisabled={!selected.size} onClick={() => setConfirm(true)}>Remind {selected.size || ''}</Button>}
        </Flex>
      </Flex>
      <TableBox>
        <Table>
          <Thead>
            <Tr>
              {canSend && (
                <Th w="40px">
                  <Checkbox isChecked={selectable.length > 0 && selected.size === selectable.length} onChange={(e) => setSelected(e.target.checked ? new Set(selectable.map((r: any) => r.patient_id)) : new Set())} />
                </Th>
              )}
              <Th>Patient</Th><Th>Phone</Th><Th isNumeric>Owes</Th><Th>Last visit</Th><Th>Last reminded</Th>
            </Tr>
          </Thead>
          <Tbody>
            {isLoading ? <TableMessageRow colSpan={6} loading /> : shown.length === 0 ? <TableMessageRow colSpan={6}>Nobody owes anything.</TableMessageRow> : shown.map((r: any) => (
              <Tr key={r.patient_id}>
                {canSend && <Td><Checkbox isDisabled={!r.has_valid_phone} isChecked={selected.has(r.patient_id)} onChange={() => toggle(r.patient_id)} /></Td>}
                <Td><Text fontWeight="700">{r.name}</Text><Text fontSize="sm" color="secondaryGray.600">{r.patient_number}</Text></Td>
                <Td color={r.has_valid_phone ? undefined : 'red.500'}>{r.phone || 'No number'}</Td>
                <Td isNumeric fontWeight="700">{ghs(r.balance)}</Td>
                <Td whiteSpace="nowrap">{r.last_visit ? new Date(r.last_visit).toLocaleDateString() : '—'}</Td>
                <Td whiteSpace="nowrap">{r.last_reminder ? fmtDate(r.last_reminder) : 'Never'}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </TableBox>
      <ConfirmDialog isOpen={confirm} onClose={() => setConfirm(false)} onConfirm={() => remind.mutate()} title={`Send ${selected.size} reminders?`} confirmLabel="Send" colorScheme="green" isLoading={remind.isPending}>
        Each person gets the balance reminder with their own amount. Nobody is reminded twice on the same day.
      </ConfirmDialog>
    </Stack>
  )
}

// ---------- Log ----------

function LogTab() {
  const [page, setPage] = useState(1)
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const { data, isLoading } = useQuery({
    queryKey: ['sms-messages', page, category, status, search],
    queryFn: async () => (await api.get('/sms/messages', { params: { page, category: category || undefined, status: status || undefined, search: search || undefined } })).data,
    refetchInterval: 15_000,
  })
  const rows = data?.items ?? []
  return (
    <Stack spacing="16px">
      <Flex gap="12px" wrap="wrap">
        <Box w={{ base: '100%', md: '260px' }}><SearchInput placeholder="Name or number" value={search} onChange={(v) => { setSearch(v); setPage(1) }} /></Box>
        <Select variant="main" maxW="200px" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1) }}>
          <option value="">All types</option>
          {Object.entries(SMS_CATEGORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Select variant="main" maxW="200px" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}>
          <option value="">Any status</option>
          {Object.entries(SMS_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>
      </Flex>
      <TableBox>
        <Table>
          <Thead><Tr><Th>When</Th><Th>To</Th><Th>Message</Th><Th>Type</Th><Th>Status</Th><Th isNumeric>Cost</Th></Tr></Thead>
          <Tbody>
            {isLoading ? <TableMessageRow colSpan={6} loading /> : rows.length === 0 ? <TableMessageRow colSpan={6}>No messages yet.</TableMessageRow> : rows.map((m: any) => (
              <Tr key={m.id}>
                <Td whiteSpace="nowrap">{fmtDate(m.created_at)}</Td>
                <Td><Text fontWeight="600">{m.recipient_name || m.recipient}</Text>{m.recipient_name && <Text fontSize="sm" color="secondaryGray.600">{m.recipient}</Text>}</Td>
                <Td maxW="380px"><Text noOfLines={2}>{m.body}</Text>{m.error && <Text fontSize="xs" color="red.500">{m.error}</Text>}</Td>
                <Td>{SMS_CATEGORY[m.category] ?? m.category}</Td>
                <Td><StatusBadge status={m.status} /></Td>
                <Td isNumeric>{ghs(m.cost)}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </TableBox>
      <Pagination page={page} totalPages={Math.ceil((data?.total || 0) / 25)} total={data?.total || 0} perPage={25} onChange={setPage} />
    </Stack>
  )
}

export default function SmsPage() {
  const { user } = useAuthStore()
  const can = (code: string) => hasPermission(user, [code])
  const tabs = [
    can('sms.send') && { label: 'Send', icon: MdSend, content: <SendTab /> },
    can('sms.bulk_send') && { label: 'Campaigns', icon: MdCampaign, content: <CampaignsTab /> },
    can('sms.bulk_send') && { label: 'Groups', icon: MdGroups, content: <GroupsTab /> },
    can('debtors.view') && { label: 'Debtors', icon: MdMoneyOff, content: <DebtorsTab canSend={can('sms.send') || can('sms.bulk_send')} /> },
    can('sms.view') && { label: 'Message log', icon: MdHistory, content: <LogTab /> },
  ].filter(Boolean) as { label: string; icon: any; content: React.ReactNode }[]

  return (
    <>
      <PageHeader title="SMS" description="Text patients: receipts go out on their own; send messages, campaigns and balance reminders here." />
      <CreditStrip />
      {tabs.length ? <TabCard tabs={tabs} /> : <EmptyState icon={MdSend} title="SMS isn't enabled for your role" />}
    </>
  )
}

