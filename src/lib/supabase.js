import { createClient } from "@supabase/supabase-js";

// Los valores de fallback solo se usan en build time (generación estática).
// En runtime siempre estarán disponibles las variables de entorno reales.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-key"
);
