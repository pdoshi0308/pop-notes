/**
 * Build-time configuration for the Chrome extension.
 *
 * Edit these values BEFORE loading the extension. The anon key is safe to ship
 * client-side (it only allows what RLS policies permit). The API base must
 * point at your deployed Next.js app.
 */
window.POPFORM_CONFIG = {
  // Brand — change here once to rename the extension UI.
  BRAND_NAME: 'Pingform',

  SUPABASE_URL: 'https://usgdjgbuuhamlczospio.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_6Wjxls37PcIxHAE8PrMpJQ_29foBFek',
  API_BASE: 'https://pop-notes.vercel.app',
};
