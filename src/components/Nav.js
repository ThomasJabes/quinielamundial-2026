"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Nav({ perfil }) {
  const pathname = usePathname();
  const router = useRouter();

  async function salir() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const enlaces = [
    { href: "/pronosticos", texto: "Pronósticos" },
    { href: "/tabla", texto: "Tabla" }
  ];
  if (perfil?.es_admin) enlaces.push({ href: "/admin", texto: "Admin" });

  return (
    <nav className="border-b linea bg-pizarra/90 sticky top-0 z-10 backdrop-blur">
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <Link href="/pronosticos" className="titulo text-oro text-sm sm:text-base whitespace-nowrap">
          Quiniela 2026
        </Link>
        <div className="flex items-center gap-1 sm:gap-2">
          {enlaces.map((e) => (
            <Link
              key={e.href}
              href={e.href}
              className={`px-3 py-1.5 rounded-md text-sm font-marcador ${
                pathname === e.href ? "bg-oro text-pizarra font-bold" : "text-cal/80 hover:bg-canchaclaro"
              }`}
            >
              {e.texto}
            </Link>
          ))}
          <button
            onClick={salir}
            className="px-3 py-1.5 rounded-md text-sm font-marcador text-cal/50 hover:text-cal"
            title={perfil ? `Sesión: ${perfil.nombre}` : ""}
          >
            Salir
          </button>
        </div>
      </div>
    </nav>
  );
}
