"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      router.replace(session ? "/pronosticos" : "/login");
    });
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center">
      <p className="font-marcador text-cal/60">Cargando…</p>
    </main>
  );
}
