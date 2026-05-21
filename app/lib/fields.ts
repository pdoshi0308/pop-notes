// Catalogue of every field a workspace can include on the patient registration form.
// The order here only determines what shows in the dashboard picker; the order
// patients see is controlled by the `form_configs.fields` array per workspace.

export type FieldType =
  | 'text'
  | 'email'
  | 'tel'
  | 'date'
  | 'textarea'
  | 'radio'
  | 'select';

export interface FieldDefinition {
  id: string;
  label: string;
  type: FieldType;
  /** User-facing description shown in the dashboard. */
  description?: string;
  /** Cannot be turned off. */
  alwaysOn?: boolean;
  /** Cannot be reordered or renamed. */
  locked?: boolean;
  /** Whether the dashboard admin can rename this field. */
  customLabel?: boolean;
  /** Whether to render a postcode-lookup widget alongside this field. */
  postcodeLookup?: boolean;
  options?: string[];
  placeholder?: string;
  /** Used when the patient form first loads to autofill from the SMS ref param. */
  prefillFrom?: 'ref';
}

export const FIELD_CATALOGUE: FieldDefinition[] = [
  {
    id: 'full_name',
    label: 'Full Name',
    type: 'text',
    alwaysOn: true,
    locked: true,
    placeholder: 'Jane Smith',
  },
  {
    id: 'mobile_number',
    label: 'Mobile Number',
    type: 'tel',
    alwaysOn: true,
    locked: true,
    placeholder: '07700 900123',
    prefillFrom: 'ref',
  },
  { id: 'date_of_birth', label: 'Date of Birth', type: 'date' },
  { id: 'email', label: 'Email', type: 'email', placeholder: 'you@example.com' },
  {
    id: 'postcode',
    label: 'Postcode',
    type: 'text',
    postcodeLookup: true,
    placeholder: 'SW1A 1AA',
  },
  {
    id: 'address_line_1',
    label: 'Address',
    type: 'text',
    placeholder: 'House number and street',
  },
  {
    id: 'address_line_2',
    label: 'Address line 2',
    type: 'text',
    placeholder: 'Flat, building, area (optional)',
  },
  { id: 'gp_name', label: 'GP Name', type: 'text' },
  {
    id: 'nhs_private',
    label: 'NHS or Private',
    type: 'radio',
    options: ['NHS', 'Private'],
  },
  { id: 'emergency_contact_name', label: 'Emergency Contact Name', type: 'text' },
  { id: 'emergency_contact_number', label: 'Emergency Contact Number', type: 'tel' },
  {
    id: 'hear_about_us',
    label: 'How did you hear about us?',
    type: 'select',
    options: ['Google', 'Friend', 'Social Media', 'Walked past', 'Other'],
  },
  { id: 'medical_conditions', label: 'Medical Conditions', type: 'textarea' },
  {
    id: 'custom_1',
    label: 'Custom Field 1',
    type: 'text',
    customLabel: true,
    description: 'Set your own label.',
  },
  {
    id: 'custom_2',
    label: 'Custom Field 2',
    type: 'text',
    customLabel: true,
    description: 'Set your own label.',
  },
];

export const FIELD_BY_ID: Record<string, FieldDefinition> = Object.fromEntries(
  FIELD_CATALOGUE.map((f) => [f.id, f])
);

/** Per-workspace stored entry for one field. */
export interface FormConfigEntry {
  id: string;
  required: boolean;
  /** Custom label override; only honoured when the field supports it. */
  label?: string;
}

/** Sensible starting config for newly created workspaces. */
export const DEFAULT_FORM_CONFIG: FormConfigEntry[] = [
  { id: 'full_name', required: true },
  { id: 'mobile_number', required: true },
  { id: 'date_of_birth', required: true },
  { id: 'email', required: true },
  { id: 'postcode', required: false },
  { id: 'address_line_1', required: false },
];

/**
 * Merge stored config with the catalogue so the patient form has everything
 * it needs to render. Unknown ids and the two always-on locked fields are
 * handled defensively.
 */
export function resolveFormConfig(stored: FormConfigEntry[] | null | undefined) {
  const safe = Array.isArray(stored) && stored.length > 0 ? stored : DEFAULT_FORM_CONFIG;
  const byId = new Map(safe.map((e) => [e.id, e]));

  // Always-on locked fields are guaranteed to appear even if missing from the stored config.
  for (const def of FIELD_CATALOGUE) {
    if (def.alwaysOn && !byId.has(def.id)) {
      byId.set(def.id, { id: def.id, required: true });
    }
  }

  // Reconstruct ordered list — locked fields first if they weren't already there.
  const ordered = safe.slice();
  for (const def of FIELD_CATALOGUE) {
    if (def.alwaysOn && !ordered.find((e) => e.id === def.id)) {
      ordered.unshift({ id: def.id, required: true });
    }
  }

  return ordered
    .map((entry) => {
      const def = FIELD_BY_ID[entry.id];
      if (!def) return null;
      return {
        ...def,
        label: def.customLabel && entry.label ? entry.label : def.label,
        required: !!entry.required || !!def.alwaysOn,
      };
    })
    .filter((x): x is FieldDefinition & { required: boolean } => x !== null);
}
