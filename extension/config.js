/**
 * Build-time configuration for the Chrome extension.
 *
 * Edit these values BEFORE loading the extension. The anon key is safe to ship
 * client-side (it only allows what RLS policies permit). The API base must
 * point at your deployed Next.js app.
 */
window.POPFORM_CONFIG = {
  SUPABASE_URL: 'https://your-project.supabase.co',
  SUPABASE_ANON_KEY: 'your-anon-key',
  API_BASE: 'https://popform.io',
};
