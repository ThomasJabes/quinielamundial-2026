import { createClient } from "@supabase/supabase-js";

// Fallback seguro para build time. En runtime Vercel inyecta las vars reales.
// Usamos || (no ??) para cubrir strings vacíos además de null/undefined.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key-for-build-only"
);
