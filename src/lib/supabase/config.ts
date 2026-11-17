export function config() {
  const {
    NEXT_PUBLIC_SUPABASE_URL: url,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key,
  } = process.env;
  if (!url || !key || key === 'sb_publishable_reemplazar') return null;
  return { url, key };
}
