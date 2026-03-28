import { getServiceSupabase } from '@/lib/supabase';

/**
 * Resolves a project slug or UUID to the project's actual UUID.
 * The project page exposes `id: slug || uuid` (see useFullProjects in hooks.ts),
 * so API routes must handle both forms.
 */
export async function resolveProjectId(slugOrId: string): Promise<string | null> {
  const supabase = getServiceSupabase();

  // Try as UUID first
  const { data: byId } = await supabase
    .from('projects')
    .select('id')
    .eq('id', slugOrId)
    .maybeSingle();

  if (byId) return byId.id;

  // Fall back to slug
  const { data: bySlug } = await supabase
    .from('projects')
    .select('id')
    .eq('slug', slugOrId)
    .maybeSingle();

  return bySlug?.id ?? null;
}
