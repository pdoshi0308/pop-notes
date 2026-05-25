import { requireAdmin } from '@/lib/auth-guards';
import {
  resolveFormConfig,
  DEFAULT_FORM_CONFIG,
  type FormConfigEntry,
} from '@/lib/fields';
import FormBuilder from './form-builder';

export default async function FormPage() {
  const { supabase, profile } = await requireAdmin();

  const { data: cfg } = await supabase
    .from('form_configs')
    .select('fields')
    .eq('workspace_id', profile.workspace_id)
    .maybeSingle();

  const initial: FormConfigEntry[] =
    (cfg?.fields as FormConfigEntry[] | undefined) ?? DEFAULT_FORM_CONFIG;
  const resolved = resolveFormConfig(initial).map((f) => ({
    id: f.id,
    required: f.required,
    label: f.label,
  }));

  return (
    <FormBuilder
      workspaceId={profile.workspace_id}
      initial={resolved}
      canEdit={true}
    />
  );
}
