import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import {
  resolveFormConfig,
  DEFAULT_FORM_CONFIG,
  type FormConfigEntry,
} from '@/lib/fields';
import FormBuilder from './form-builder';

export default async function FormPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/dashboard/login');

  const { data: profile } = await supabase
    .from('users')
    .select('workspace_id')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile?.workspace_id) redirect('/dashboard/login?error=no_workspace');

  const { data: cfg } = await supabase
    .from('form_configs')
    .select('fields')
    .eq('workspace_id', profile.workspace_id)
    .maybeSingle();

  const initial: FormConfigEntry[] =
    (cfg?.fields as FormConfigEntry[] | undefined) ?? DEFAULT_FORM_CONFIG;
  // Run through resolver to fill in always-on locked fields.
  const resolved = resolveFormConfig(initial).map((f) => ({
    id: f.id,
    required: f.required,
    label: f.label,
  }));

  return <FormBuilder workspaceId={profile.workspace_id} initial={resolved} />;
}
