import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-server';
import { resolveFormConfig, type FormConfigEntry } from '@/lib/fields';

export const runtime = 'nodejs';

/**
 * GET /api/workspace-config?workspace_id=...
 * Public endpoint. Returns the practice name + the ordered list of fields
 * the patient registration form should render.
 */
export async function GET(req: NextRequest) {
  try {
    const workspaceId = req.nextUrl.searchParams.get('workspace_id');
    if (!workspaceId) return jsonError('Missing workspace_id', 400);

    const admin = createSupabaseAdminClient();

    const [{ data: ws }, { data: cfg }] = await Promise.all([
      admin.from('workspaces').select('id, name').eq('id', workspaceId).maybeSingle(),
      admin
        .from('form_configs')
        .select('fields')
        .eq('workspace_id', workspaceId)
        .maybeSingle(),
    ]);

    if (!ws) return jsonError('Workspace not found', 404);

    const fields = resolveFormConfig((cfg?.fields ?? null) as FormConfigEntry[] | null);
    return NextResponse.json({
      ok: true,
      workspace: { id: ws.id, name: ws.name },
      fields,
    });
  } catch (err) {
    console.error('[/api/workspace-config]', err);
    return jsonError('Could not load workspace config', 500);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}
