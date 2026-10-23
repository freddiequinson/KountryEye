import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, AlertIcon, Badge, Box, Button, Flex, Input, InputGroup, InputLeftAddon, Select, SimpleGrid, Stack, Table, Tbody, Td, Text, Textarea, Th, Thead, Tr } from '@chakra-ui/react'
import { Link } from 'react-router-dom'
import { MdAccessTime, MdChat, MdHistory, MdKey, MdPayments, MdPeople, MdSms, MdStore, MdTune } from 'react-icons/md'
import api from '@/lib/api'
import { apiErrorMessage } from '@/lib/errors'
import { useToast } from '@/hooks/use-toast'
import PageHeader from '@/components/PageHeader'
import TabCard from '@/components/card/TabCard'
import StatCard from '@/components/card/StatCard'
import { FormSection } from '@/components/FormSection'
import { ConfirmDialog, Field, Pagination, TableBox, TableMessageRow } from '@/components/ui'
import PermissionManagerPage from './PermissionManagerPage'
import SettingsPage from './SettingsPage'

type Setting = { key: string; value: string | null; secret: boolean; configured: boolean }
type Change = {
  id: number
  entity_type: string
  entity_id: number
  entity_label: string
  field: string
  old_display: string
  new_display: string
  changed_by: string
  created_at: string
  reversible: boolean
  reverted: boolean
  reverted_change_id: number | null
}

// Plain names for the records and fields the history tracks
const RECORD_NAMES: Record<string, string> = {
  system_settings: 'Setting',
  roles: 'Role',
  users: 'User',
  products: 'Product',
  consultation_types: 'Consultation type',
  visit_fee_settings: 'Visit fees',
  insurance_fee_overrides: 'Insurance fee',
  insurance_companies: 'Insurance company',
  branches: 'Branch',
}
const FIELD_NAMES: Record<string, string> = {
  value: 'value',
  role_id: 'role',
  branch_id: 'branch',
  is_active: 'active',
  is_superuser: 'superadmin',
  unit_price: 'price',
  cost_price: 'cost price',
  admin_may_assign: 'clinic admin may assign',
  permissions: 'permissions',
  extra_permissions: 'extra permissions',
  denied_permissions: 'denied permissions',
  additional_branches: 'extra branches',
}
const fieldName = (f: string) => FIELD_NAMES[f] ?? f.replace(/_/g, ' ')

// ---------- Change history ----------

function History() {
  const [page, setPage] = useState(1)
  const [entity, setEntity] = useState('')
  const [selected, setSelected] = useState<Change | null>(null)
  const { toast } = useToast()
  const client = useQueryClient()
  const history = useQuery({
    queryKey: ['change-history', page, entity],
    queryFn: async () =>
      (await api.get('/superadmin/changes', { params: { page, entity_type: entity || undefined } })).data as { total: number; items: Change[] },
  })
  const revert = useMutation({
    mutationFn: (id: number) => api.post(`/superadmin/changes/${id}/revert`),
    onSuccess: () => {
      setSelected(null)
      client.invalidateQueries()
      toast({ title: 'Change reverted' })
    },
    onError: (error) => toast({ title: 'Could not revert', description: apiErrorMessage(error), variant: 'destructive' }),
  })
  const rows = history.data?.items ?? []

  return (
    <Stack spacing="16px">
      <Flex justify="space-between" align={{ base: 'start', md: 'center' }} direction={{ base: 'column', md: 'row' }} gap="12px">
        <Text color="secondaryGray.600" maxW="640px">
          Every change to settings, prices, fees, roles and accounts, with who made it. Revert puts the old value back and is logged too.
          Payments, deleted records and API keys can't be reverted.
        </Text>
        <Select variant="main" maxW="240px" value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1) }}>
          <option value="">All records</option>
          {Object.entries(RECORD_NAMES).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </Select>
      </Flex>
      <TableBox>
        <Table variant="simple">
          <Thead>
            <Tr>
              <Th>When</Th>
              <Th>Change</Th>
              <Th>Before</Th>
              <Th>After</Th>
              <Th />
            </Tr>
          </Thead>
          <Tbody>
            {history.isLoading ? (
              <TableMessageRow colSpan={5} loading />
            ) : history.isError ? (
              <TableMessageRow colSpan={5}>Could not load history.</TableMessageRow>
            ) : rows.length === 0 ? (
              <TableMessageRow colSpan={5}>No changes recorded yet.</TableMessageRow>
            ) : (
              rows.map((row) => (
                <Tr key={row.id}>
                  <Td whiteSpace="nowrap">
                    <Text fontWeight="600">{new Date(`${row.created_at}Z`).toLocaleString()}</Text>
                    <Text fontSize="sm" color="secondaryGray.600">{row.changed_by}</Text>
                  </Td>
                  <Td>
                    <Text fontWeight="600">
                      {RECORD_NAMES[row.entity_type] ?? row.entity_type}: {row.entity_label}
                    </Text>
                    <Text fontSize="sm" color="secondaryGray.600">
                      {fieldName(row.field)}
                      {row.reverted_change_id ? ` · undo of change #${row.reverted_change_id}` : ''}
                    </Text>
                  </Td>
                  <Td maxW="260px" overflowWrap="anywhere" color="secondaryGray.600">{row.old_display}</Td>
                  <Td maxW="260px" overflowWrap="anywhere" fontWeight="600">{row.new_display}</Td>
                  <Td textAlign="right">
                    {row.reverted ? (
                      <Badge>Reverted</Badge>
                    ) : row.reversible ? (
                      <Button size="sm" variant="light" onClick={() => setSelected(row)}>Revert</Button>
                    ) : null}
                  </Td>
                </Tr>
              ))
            )}
          </Tbody>
        </Table>
      </TableBox>
      <Pagination page={page} totalPages={Math.ceil((history.data?.total || 0) / 25)} total={history.data?.total || 0} perPage={25} onChange={setPage} />
      <ConfirmDialog
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        onConfirm={() => selected && revert.mutate(selected.id)}
        title="Revert this change?"
        confirmLabel="Revert"
        isLoading={revert.isPending}
      >
        {selected && (
          <>
            {RECORD_NAMES[selected.entity_type] ?? selected.entity_type} {selected.entity_label}: {fieldName(selected.field)} goes back to{' '}
            <b>{selected.old_display}</b>.
          </>
        )}
      </ConfirmDialog>
    </Stack>
  )
}

// ---------- Settings editors ----------

function useSettings() {
  return useQuery({ queryKey: ['superadmin-settings'], queryFn: async () => (await api.get('/superadmin/settings')).data as Setting[] })
}

function useSaveSetting() {
  const { toast } = useToast()
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) => api.put(`/settings/${key}`, { value }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['superadmin-settings'] })
      toast({ title: 'Saved' })
    },
    onError: (error) => toast({ title: 'Could not save', description: apiErrorMessage(error), variant: 'destructive' }),
  })
}

type EditorProps = {
  settingKey: string
  label: string
  settings: Setting[]
  kind?: 'text' | 'secret' | 'money' | 'time' | 'multiline' | 'toggle' | 'choice'
  choices?: { value: string; label: string }[]
  placeholder?: string
  help?: string
  onDraft?: (value: string) => void
}

function SettingEditor({ settingKey, label, settings, kind = 'text', choices, placeholder, help, onDraft }: EditorProps) {
  const saved = settings.find((s) => s.key === settingKey)
  const [draft, setDraft] = useState<string | null>(null)
  const save = useSaveSetting()
  const value = draft ?? (kind === 'secret' ? '' : saved?.value ?? (kind === 'toggle' ? 'false' : ''))
  const change = (v: string) => {
    setDraft(v)
    onDraft?.(v)
  }
  const options = kind === 'toggle' ? [{ value: 'true', label: 'On' }, { value: 'false', label: 'Off' }] : choices

  let input
  if (options) {
    input = (
      <Select variant="main" value={value} onChange={(e) => change(e.target.value)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </Select>
    )
  } else if (kind === 'multiline') {
    input = <Textarea variant="main" rows={2} value={value} placeholder={placeholder} onChange={(e) => change(e.target.value)} />
  } else if (kind === 'money') {
    input = (
      <InputGroup>
        <InputLeftAddon>GH₵</InputLeftAddon>
        <Input variant="main" type="number" step="0.0001" min="0" value={value} placeholder={placeholder} onChange={(e) => change(e.target.value)} />
      </InputGroup>
    )
  } else {
    input = (
      <Input
        variant="main"
        type={kind === 'secret' ? 'password' : kind === 'time' ? 'time' : 'text'}
        autoComplete="off"
        value={value}
        placeholder={kind === 'secret' && saved?.configured ? 'Saved. Type a new key to replace it.' : placeholder}
        onChange={(e) => change(e.target.value)}
      />
    )
  }

  return (
    <Box>
      <Field label={label}>
        <Flex gap="8px" align="start">
          <Box flex="1">{input}</Box>
          <Button variant="brand" isDisabled={draft === null || (kind === 'secret' && !draft)} isLoading={save.isPending} onClick={() => draft !== null && save.mutate({ key: settingKey, value: draft }, { onSuccess: () => setDraft(null) })}>
            Save
          </Button>
        </Flex>
      </Field>
      {help && <Text fontSize="sm" color="secondaryGray.600" mt="6px">{help}</Text>}
    </Box>
  )
}

function SettingsLoader({ children }: { children: (settings: Setting[]) => React.ReactNode }) {
  const query = useSettings()
  if (query.isLoading) return <Text color="secondaryGray.600">Loading…</Text>
  if (query.isError) return <Alert status="error" borderRadius="12px"><AlertIcon />Could not load settings.</Alert>
  return <>{children(query.data || [])}</>
}

function SmsSetup() {
  const [cost, setCost] = useState<string | null>(null)
  const [rate, setRate] = useState<string | null>(null)
  return (
    <SettingsLoader>
      {(settings) => {
        const get = (k: string) => settings.find((s) => s.key === k)?.value
        const providerCost = parseFloat(cost ?? get('sms.cost_per_segment') ?? '')
        const shopRate = parseFloat(rate ?? get('sms.shop_rate') ?? '')
        const margin = Number.isFinite(providerCost) && Number.isFinite(shopRate) ? shopRate - providerCost : null
        return (
          <Stack spacing="0">
            <FormSection icon={MdKey} title="Arkesel account" description="The key is stored on the server and never shown again after saving.">
              <SettingEditor settingKey="sms.api_key" label="API key" kind="secret" settings={settings} />
              <SettingEditor settingKey="sms.sender_id" label="Sender ID" placeholder="KountryEye" settings={settings} help="Must match the sender ID Arkesel approved (max 11 characters)." />
            </FormSection>
            <FormSection icon={MdPayments} title="Pricing" description="What one SMS segment (160 characters) costs you, and what the shop is charged.">
              <SettingEditor settingKey="sms.cost_per_segment" label="Your cost per SMS" kind="money" placeholder="0.0300" settings={settings} onDraft={setCost} />
              <SettingEditor settingKey="sms.shop_rate" label="Shop rate per SMS" kind="money" placeholder="0.0500" settings={settings} onDraft={setRate} />
              <Text gridColumn={{ md: 'span 2' }} fontWeight="600" color={margin !== null && margin < 0 ? 'red.500' : undefined}>
                {margin === null ? 'Set both prices to see your margin.' : `Margin: GH₵${margin.toFixed(4)} per SMS`}
              </Text>
            </FormSection>
            <FormSection icon={MdStore} title="Shop credit" description="The shop's prepaid SMS wallet. Sending stops once it goes past the overdraft limit.">
              <SettingEditor settingKey="sms.credit_overdraft" label="Overdraft limit" kind="money" placeholder="20.00" settings={settings} help="How far below zero the shop can go before all SMS stop." />
              <SettingEditor settingKey="sms.credit_low_warning" label="Warn the clinic below" kind="money" placeholder="10.00" settings={settings} />
              <Box gridColumn={{ md: 'span 2' }}><ShopWallet /></Box>
            </FormSection>
          </Stack>
        )
      }}
    </SettingsLoader>
  )
}

const TEMPLATES: [string, string, string][] = [
  ['receipt', 'Payment receipt', 'Kountry Eyecare: Paid GHS {amount} (VAT {vat}). Bal GHS {balance}. Receipt: {link}'],
  ['in_progress', 'Glasses being made', "Kountry Eyecare: Your glasses will be ready by {date}. We'll text you when they're in."],
  ['ready', 'Glasses ready', 'Kountry Eyecare: Your glasses are ready. Pick up at {branch}. Bal GHS {balance}.'],
  ['birthday', 'Birthday', 'Happy birthday {first_name}! From all of us at Kountry Eyecare.'],
  ['review', 'Review due', 'Kountry Eyecare: Your eye review is due on {date}. Call {branch_phone} to book.'],
  ['debt', 'Balance reminder', 'Kountry Eyecare: You have an outstanding balance of GHS {balance}. Please call {branch_phone}.'],
]

function TemplatesAndAutomation() {
  return (
    <SettingsLoader>
      {(settings) => (
        <Stack spacing="0">
          <FormSection
            icon={MdChat}
            title="Message templates"
            description="Keep each under 160 characters so it sends as one SMS. Placeholders: {first_name} {amount} {vat} {balance} {link} {date} {branch} {branch_phone}"
            columns={1}
          >
            {TEMPLATES.map(([key, label, placeholder]) => (
              <SettingEditor key={key} settingKey={`sms.template.${key}`} label={label} kind="multiline" placeholder={placeholder} settings={settings} help="Leave empty to use the text shown." />
            ))}
          </FormSection>
          <FormSection icon={MdAccessTime} title="Automatic messages" description="Times are Ghana time.">
            <SettingEditor settingKey="sms.automation.birthday_enabled" label="Birthday wishes" kind="toggle" settings={settings} />
            <SettingEditor settingKey="sms.automation.birthday_time" label="Send birthdays at" kind="time" placeholder="08:00" settings={settings} />
            <SettingEditor settingKey="sms.automation.review_enabled" label="Review reminders" kind="toggle" settings={settings} />
            <SettingEditor settingKey="sms.automation.review_time" label="Send reminders at" kind="time" placeholder="08:00" settings={settings} />
            <SettingEditor
              settingKey="sms.automation.debt_frequency"
              label="Automatic balance reminders"
              kind="choice"
              choices={[{ value: 'off', label: 'Off' }, { value: 'weekly', label: 'Weekly' }, { value: 'fortnightly', label: 'Every two weeks' }, { value: 'monthly', label: 'Monthly' }]}
              settings={settings}
            />
            <SettingEditor settingKey="sms.automation.debt_minimum" label="Only remind if they owe at least" kind="money" placeholder="10.00" settings={settings} />
          </FormSection>
        </Stack>
      )}
    </SettingsLoader>
  )
}

// ---------- SMS wallet and bill ----------

type SmsSummary = {
  month: string
  credit: { balance: number; overdraft_limit: number; can_send: boolean; low: boolean; messages_left: number | null }
  dry_run: boolean
  api_key_set: boolean
  arkesel_balance: Record<string, unknown> | null
  arkesel_error: string | null
  messages: number
  provider_cost: number
  shop_billed: number
  margin: number
  by_status: Record<string, number>
}

function useSmsSummary(month?: string) {
  return useQuery({
    queryKey: ['superadmin-sms-summary', month],
    queryFn: async () => (await api.get('/superadmin/sms/summary', { params: { month } })).data as SmsSummary,
  })
}

const arkeselBalanceText = (b: SmsSummary['arkesel_balance']) => {
  if (!b) return '—'
  const sms = b['sms_balance'] ?? b['balance'] ?? b['main_balance']
  return sms !== undefined ? String(sms) : JSON.stringify(b)
}

function ShopWallet() {
  const { toast } = useToast()
  const client = useQueryClient()
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [testPhone, setTestPhone] = useState('')
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const summary = useSmsSummary(month).data
  const ledger = useQuery({ queryKey: ['superadmin-sms-ledger'], queryFn: async () => (await api.get('/superadmin/sms/ledger')).data })
  const topup = useMutation({
    mutationFn: () => api.post('/superadmin/sms/topup', { amount: parseFloat(amount), note: note || null }),
    onSuccess: () => {
      toast({ title: 'Credit added' })
      setAmount('')
      setNote('')
      client.invalidateQueries({ queryKey: ['superadmin-sms-summary'] })
      client.invalidateQueries({ queryKey: ['superadmin-sms-ledger'] })
      client.invalidateQueries({ queryKey: ['sms-credit'] })
    },
    onError: (e) => toast({ title: 'Could not add credit', description: apiErrorMessage(e), variant: 'destructive' }),
  })
  const test = useMutation({
    mutationFn: () => api.post('/superadmin/sms/test', { phone: testPhone }),
    onSuccess: (r) => toast({
      title: r.data.status === 'sent' ? 'Test SMS sent' : r.data.status === 'dry_run' ? 'Test mode: logged, not sent' : `Not sent: ${r.data.status}`,
      description: r.data.error || undefined,
      variant: r.data.status === 'failed' || r.data.status === 'blocked' ? 'destructive' : undefined,
    }),
    onError: (e) => toast({ title: 'Could not send test', description: apiErrorMessage(e), variant: 'destructive' }),
  })
  const c = summary?.credit

  return (
    <Stack spacing="20px">
      {summary?.dry_run && (
        <Alert status="warning" borderRadius="12px">
          <AlertIcon />
          {summary.api_key_set ? 'This server is in test mode: messages are logged but not sent.' : 'No API key yet: messages are logged but not sent.'}
        </Alert>
      )}
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing="16px">
        <StatCard name="Shop credit" value={c ? `GH₵${c.balance.toFixed(2)}` : '…'} icon={MdStore} valueColor={c && !c.can_send ? 'red.500' : c?.low ? 'orange.500' : undefined} helpText={c?.messages_left != null ? `about ${Math.max(c.messages_left, 0)} SMS left` : undefined} />
        <StatCard name="Arkesel balance" value={summary ? arkeselBalanceText(summary.arkesel_balance) : '…'} icon={MdSms} helpText={summary?.arkesel_error ?? undefined} />
        <StatCard name={`Shop billed (${month})`} value={summary ? `GH₵${summary.shop_billed.toFixed(2)}` : '…'} icon={MdPayments} helpText={summary ? `${summary.messages} SMS` : undefined} />
        <StatCard name="Your margin" value={summary ? `GH₵${summary.margin.toFixed(2)}` : '…'} icon={MdPayments} helpText={summary ? `Arkesel cost GH₵${summary.provider_cost.toFixed(2)}` : undefined} />
      </SimpleGrid>
      <Flex gap="12px" align="end" wrap="wrap">
        <Field label="Add credit" w={{ base: '100%', md: '200px' }}>
          <InputGroup><InputLeftAddon>GH₵</InputLeftAddon><Input variant="main" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></InputGroup>
        </Field>
        <Field label="Note" w={{ base: '100%', md: '260px' }}>
          <Input variant="main" placeholder="MoMo ref 12345" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <Button variant="brand" isDisabled={!(parseFloat(amount) > 0)} isLoading={topup.isPending} onClick={() => topup.mutate()}>Top up</Button>
        <Field label="Bill for" w="170px" ms={{ md: 'auto' }}>
          <Input variant="main" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </Field>
      </Flex>
      {ledger.data?.items?.length > 0 && (
        <TableBox>
          <Table size="sm">
            <Thead><Tr><Th>Top-up</Th><Th>By</Th><Th>Note</Th><Th isNumeric>Amount</Th></Tr></Thead>
            <Tbody>
              {ledger.data.items.slice(0, 8).map((r: any) => (
                <Tr key={r.id}>
                  <Td whiteSpace="nowrap">{new Date(`${r.created_at}Z`).toLocaleString()}</Td>
                  <Td>{r.by ?? '—'}</Td>
                  <Td>{r.note}</Td>
                  <Td isNumeric fontWeight="700">GH₵{r.amount.toFixed(2)}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableBox>
      )}
      <Flex gap="8px" align="end" maxW="460px">
        <Field label="Send a test SMS to"><Input variant="main" placeholder="024 123 4567" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} /></Field>
        <Button variant="light" isDisabled={testPhone.length < 9} isLoading={test.isPending} onClick={() => test.mutate()}>Send test</Button>
      </Flex>
    </Stack>
  )
}

// ---------- Overview ----------

function Overview() {
  const query = useQuery({
    queryKey: ['superadmin-overview'],
    queryFn: async () => (await api.get('/superadmin/overview')).data as { users: number; active_users: number; branches: number; changes_today: number },
  })
  const d = query.data
  return (
    <Stack spacing="20px">
      <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} spacing="16px">
        <StatCard name="Accounts" value={d?.users ?? '…'} icon={MdPeople} />
        <StatCard name="Active accounts" value={d?.active_users ?? '…'} icon={MdPeople} />
        <StatCard name="Active branches" value={d?.branches ?? '…'} icon={MdStore} />
        <StatCard name="Changes today" value={d?.changes_today ?? '…'} icon={MdHistory} />
      </SimpleGrid>
      <SmsOverview />
    </Stack>
  )
}

function SmsOverview() {
  const s = useSmsSummary().data
  if (!s) return null
  const failed = (s.by_status['failed'] ?? 0) + (s.by_status['blocked'] ?? 0)
  return (
    <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} spacing="16px">
      <StatCard name="Shop SMS credit" value={`GH₵${s.credit.balance.toFixed(2)}`} icon={MdSms} valueColor={!s.credit.can_send ? 'red.500' : s.credit.low ? 'orange.500' : undefined} />
      <StatCard name="SMS this month" value={s.messages} icon={MdChat} helpText={s.dry_run ? 'test mode' : undefined} />
      <StatCard name="Failed or held" value={failed} icon={MdChat} valueColor={failed ? 'red.500' : undefined} />
      <StatCard name="SMS margin this month" value={`GH₵${s.margin.toFixed(2)}`} icon={MdPayments} />
    </SimpleGrid>
  )
}

export default function SuperadminPage() {
  return (
    <>
      <PageHeader title="Superadmin" description="System controls, access and change history. Only superadmins see this page." />
      <TabCard
        tabs={[
          { label: 'Overview', icon: MdTune, content: <Overview /> },
          { label: 'SMS', icon: MdSms, content: <SmsSetup /> },
          { label: 'Templates & automation', icon: MdChat, content: <TemplatesAndAutomation /> },
          { label: 'Roles & permissions', icon: MdKey, content: <PermissionManagerPage embedded /> },
          { label: 'Users', icon: MdPeople, content: <SettingsPage consoleSection="Users" /> },
          { label: 'Branches', icon: MdStore, content: <SettingsPage consoleSection="Branches" /> },
          {
            label: 'System',
            icon: MdTune,
            content: (
              <Stack spacing="20px">
                <Button as={Link} to="/admin/terminal" variant="light" alignSelf="start">Open server logs</Button>
                <SettingsPage consoleSection="System" />
              </Stack>
            ),
          },
          { label: 'Change history', icon: MdHistory, content: <History /> },
        ]}
      />
    </>
  )
}
