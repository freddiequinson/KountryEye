import { Input, Select, Textarea } from '@chakra-ui/react'
import { DateField } from '@/components/DateField'
import { ChoiceField, IntakeDivider, IntakeSection } from '@/components/IntakeSheet'
import { Field } from '@/components/ui'

// The patient details every intake form collects. One definition, so the front desk form and the
// public self-registration form always ask for the same things in the same order.
export const emptyPatientIntake = {
  first_name: '',
  last_name: '',
  other_names: '',
  date_of_birth: '',
  sex: '',
  marital_status: '',
  phone: '',
  email: '',
  address: '',
  nationality: 'Ghanaian',
  occupation: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  ghana_card: '',
}

export type PatientIntake = typeof emptyPatientIntake

export const SEX_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
]

export const calculateAge = (dob: string) => {
  const today = new Date()
  const birthDate = new Date(dob)
  let age = today.getFullYear() - birthDate.getFullYear()
  const m = today.getMonth() - birthDate.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--
  return `${age} years`
}

const digits10 = (value: string) => value.replace(/\D/g, '').slice(0, 10)

export type IntakeGroup = 'identity' | 'background' | 'contact' | 'emergency'

// `group` renders just one group of fields with no heading, for the public wizard; leave it out for the three numbered sections.
// `selfService` is the public form: the phone number is required and limited to 10 digits.
export function PatientIntakeFields({
  data,
  onChange,
  group,
  selfService,
}: {
  data: PatientIntake
  onChange: (key: keyof PatientIntake, value: string) => void
  group?: IntakeGroup
  selfService?: boolean
}) {
  const text = (key: keyof PatientIntake) => ({
    value: data[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => onChange(key, e.target.value),
  })
  const phone = (key: keyof PatientIntake) =>
    selfService
      ? { value: data[key], maxLength: 10, inputMode: 'numeric' as const, placeholder: '0200000000', onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(key, digits10(e.target.value)) }
      : { ...text(key), placeholder: '+233 XX XXX XXXX' }

  const groups: Record<IntakeGroup, React.ReactNode> = {
    identity: (
      <>
        <Field label="First Name" isRequired>
          <Input variant="main" autoComplete="given-name" autoCapitalize="words" {...text('first_name')} />
        </Field>
        <Field label="Surname / Last Name" isRequired>
          <Input variant="main" autoComplete="family-name" autoCapitalize="words" {...text('last_name')} />
        </Field>
        {/* The public form asks only for first name and surname */}
        {!selfService && (
          <Field label="Other Names">
            <Input variant="main" placeholder="Middle name" autoComplete="additional-name" autoCapitalize="words" {...text('other_names')} />
          </Field>
        )}
        <Field label="Date of Birth" helper={data.date_of_birth && `Age: ${calculateAge(data.date_of_birth)}`}>
          {selfService ? (
            <DateField value={data.date_of_birth} onChange={(value) => onChange('date_of_birth', value)} placeholder="Select your date of birth" />
          ) : (
            <Input variant="main" type="date" {...text('date_of_birth')} />
          )}
        </Field>
        {selfService ? (
          <Field label="Sex">
            <Select variant="main" placeholder="Select" {...text('sex')}>
              {SEX_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <ChoiceField label="Sex" value={data.sex} onChange={(value) => onChange('sex', value)} options={SEX_OPTIONS} />
        )}
      </>
    ),
    background: (
      <>
        <Field label="Marital Status">
          <Select variant="main" placeholder="Select status" {...text('marital_status')}>
            <option value="single">Single</option>
            <option value="married">Married</option>
            <option value="divorced">Divorced</option>
            <option value="widowed">Widowed</option>
          </Select>
        </Field>
        <Field label="Nationality">
          <Input variant="main" {...text('nationality')} />
        </Field>
        <Field label="Occupation">
          <Input variant="main" {...text('occupation')} />
        </Field>
        <Field label="Ghana Card Number">
          <Input variant="main" placeholder="GHA-XXXXXXXXX-X" {...text('ghana_card')} />
        </Field>
      </>
    ),
    contact: (
      <>
        <Field label="Phone Number" isRequired={selfService}>
          <Input variant="main" type="tel" autoComplete="tel" {...phone('phone')} />
        </Field>
        <Field label="Email Address">
          <Input variant="main" type="email" autoComplete="email" placeholder="name@example.com" {...text('email')} />
        </Field>
        <Field label="Home Address" gridColumn="1 / -1">
          <Textarea variant="main" rows={2} autoComplete="street-address" placeholder="Full address" {...text('address')} />
        </Field>
      </>
    ),
    emergency: (
      <>
        <Field label="Name">
          <Input variant="main" {...text('emergency_contact_name')} />
        </Field>
        <Field label="Phone Number">
          <Input variant="main" type="tel" {...phone('emergency_contact_phone')} />
        </Field>
      </>
    ),
  }

  if (group) return <IntakeSection>{groups[group]}</IntakeSection>

  return (
    <>
      <IntakeSection number={1} title="Patient information">
        {groups.identity}
        <IntakeDivider />
        {groups.background}
      </IntakeSection>
      <IntakeSection number={2} title="Contact" description="How the clinic reaches the patient for reminders and follow-ups.">
        {groups.contact}
      </IntakeSection>
      <IntakeSection number={3} title="Emergency contact" description="Next of kin to call if something goes wrong.">
        {groups.emergency}
      </IntakeSection>
    </>
  )
}
