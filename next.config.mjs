/** @type {import('next').NextConfig} */
const nextConfig = {
  // Garantiza valores durante el build aunque las env vars no estén configuradas
  env: {
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key-for-build-only",
  },
};
export default nextConfig;
