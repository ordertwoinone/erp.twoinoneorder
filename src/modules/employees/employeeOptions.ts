export interface Option {
  value: string
  label: string
}

export const VISA_SPONSORSHIP_TYPES: Option[] = [
  { value: 'company', label: 'Company sponsored' },
  { value: 'family', label: 'Family sponsored' },
  { value: 'work_permit', label: 'Work permit' },
  { value: 'freelance', label: 'Freelance permit' },
  { value: 'other', label: 'Other' },
]

// MOHRE work permit types.
export const WORK_PERMIT_CATEGORIES: Option[] = [
  'New Electronic Work Permit',
  'Work Permit Renewal',
  'Work Permit Transfer',
  'Part-time Work Permit',
  'Temporary Work Permit',
  'One-mission Work Permit',
  'Juvenile Work Permit',
  'Student Training & Employment Permit',
  'Golden Visa Holder Work Permit',
  'UAE / GCC National Work Permit',
  'Family-sponsored Resident Work Permit',
  'Private Teacher Work Permit',
].map((label) => ({ value: label, label }))

export const VISA_STATUSES: Option[] = [
  { value: 'active', label: 'Active' },
  { value: 'under_process', label: 'Under process' },
  { value: 'expired', label: 'Expired' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'absconding', label: 'Absconding' },
  { value: 'on_hold', label: 'On hold' },
]

export const PRESENCE_STATUSES: Option[] = [
  { value: 'in_country', label: 'In country' },
  { value: 'outside_country', label: 'Outside country' },
  { value: 'on_vacation', label: 'On vacation' },
]

export const DOCUMENT_TYPES: Option[] = [
  { value: 'labour_permit', label: 'Labour permit' },
  { value: 'medical', label: 'Medical' },
  { value: 'emirates_id', label: 'Emirates ID' },
  { value: 'passport', label: 'Passport' },
  { value: 'settlement', label: 'Settlement' },
  { value: 'visa', label: 'Visa' },
  { value: 'other', label: 'Other' },
]

export const TICKET_PAID_BY: Option[] = [
  { value: 'company', label: 'Company' },
  { value: 'employee', label: 'Employee' },
  { value: 'shared', label: 'Shared' },
]

export const TICKET_CLAIM_STATUSES: Option[] = [
  { value: 'claimed', label: 'Claimed' },
  { value: 'not_claimed', label: 'Not claimed' },
  { value: 'pending', label: 'Pending' },
]

export const REPLACEMENT_AVAILABILITY: Option[] = [
  { value: 'available_now', label: 'Available now' },
  { value: 'available_from', label: 'Available from date' },
  { value: 'interview_pending', label: 'Interview pending' },
  { value: 'not_available', label: 'Not available' },
]

export const DECISIONS: Option[] = [
  { value: 'renew', label: 'Renew' },
  { value: 'cancel', label: 'Cancel' },
]

export const SETTLEMENT_STATUSES: Option[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'partially_paid', label: 'Partially paid' },
  { value: 'paid', label: 'Paid' },
  { value: 'not_applicable', label: 'Not applicable' },
]

export const SETTLEMENT_DOCUMENT_TYPES: Option[] = [
  'Settlement agreement',
  'Payment receipt',
  'Bank transfer proof',
  'Cheque copy',
  'Visa cancellation form',
  'Other',
].map((label) => ({ value: label, label }))

// Common nationalities in the UAE workforce first, then the rest A–Z.
export const NATIONALITIES: string[] = [
  'Indian', 'Pakistani', 'Bangladeshi', 'Filipino', 'Egyptian', 'Nepali', 'Sri Lankan', 'Emirati',
  'Afghan', 'Algerian', 'American', 'Armenian', 'Australian', 'Azerbaijani', 'Bahraini', 'Belarusian',
  'Brazilian', 'British', 'Burmese', 'Cameroonian', 'Canadian', 'Chinese', 'Colombian', 'Congolese',
  'Djiboutian', 'Dutch', 'Eritrean', 'Ethiopian', 'French', 'Gambian', 'Georgian', 'German', 'Ghanaian',
  'Greek', 'Guinean', 'Indonesian', 'Iranian', 'Iraqi', 'Irish', 'Italian', 'Ivorian', 'Jordanian',
  'Kazakh', 'Kenyan', 'Korean', 'Kuwaiti', 'Kyrgyz', 'Lebanese', 'Liberian', 'Libyan', 'Malagasy',
  'Malaysian', 'Maldivian', 'Malian', 'Mauritanian', 'Moroccan', 'Nigerian', 'Omani', 'Palestinian',
  'Polish', 'Portuguese', 'Qatari', 'Romanian', 'Russian', 'Rwandan', 'Saudi', 'Senegalese',
  'Sierra Leonean', 'Somali', 'South African', 'Spanish', 'Sudanese', 'Syrian', 'Tajik', 'Tanzanian',
  'Thai', 'Tunisian', 'Turkish', 'Turkmen', 'Ugandan', 'Ukrainian', 'Uzbek', 'Vietnamese', 'Yemeni',
  'Zambian', 'Zimbabwean', 'Other',
]

// Documents (MOHRE lists, passports) often print the country, not the
// nationality, and in capitals — map the common ones onto NATIONALITIES.
const COUNTRY_TO_NATIONALITY: Record<string, string> = {
  india: 'Indian', pakistan: 'Pakistani', bangladesh: 'Bangladeshi', philippines: 'Filipino', egypt: 'Egyptian',
  nepal: 'Nepali', 'sri lanka': 'Sri Lankan', 'united arab emirates': 'Emirati', uae: 'Emirati', afghanistan: 'Afghan',
  algeria: 'Algerian', 'united states': 'American', usa: 'American', 'united kingdom': 'British', uk: 'British',
  cameroon: 'Cameroonian', china: 'Chinese', ethiopia: 'Ethiopian', ghana: 'Ghanaian', indonesia: 'Indonesian',
  iran: 'Iranian', iraq: 'Iraqi', jordan: 'Jordanian', kenya: 'Kenyan', lebanon: 'Lebanese', morocco: 'Moroccan',
  myanmar: 'Burmese', nigeria: 'Nigerian', palestine: 'Palestinian', 'saudi arabia': 'Saudi', somalia: 'Somali',
  sudan: 'Sudanese', syria: 'Syrian', tunisia: 'Tunisian', turkey: 'Turkish', uganda: 'Ugandan', uzbekistan: 'Uzbek',
  vietnam: 'Vietnamese', yemen: 'Yemeni', filipino: 'Filipino', philippine: 'Filipino',
}

/** Best match in NATIONALITIES for a scanned/typed value; the input title-cased if there's no match. */
export function normalizeNationality(value: string | null | undefined): string | null {
  const raw = value?.trim()
  if (!raw) return null
  const key = raw.toLowerCase()
  const direct = NATIONALITIES.find((n) => n.toLowerCase() === key)
  if (direct) return direct
  if (COUNTRY_TO_NATIONALITY[key]) return COUNTRY_TO_NATIONALITY[key]
  return key.replace(/\b\w/g, (c) => c.toUpperCase())
}

export function optionLabel(options: Option[], value: string | null | undefined): string {
  return options.find((o) => o.value === value)?.label ?? value ?? ''
}
