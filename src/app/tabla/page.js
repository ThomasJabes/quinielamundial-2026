"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Nav from "@/components/Nav";

export default function Tabla() {
  const router = useRouter();
  const [perfil, setPerfil] = useState(null);
  const [fases, setFases] = useState([]);
  const [faseId, setFaseId] = useState(null);
  const [filas, setFilas] = useState([]);
  const [pagados, setPagados] = useState(0);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.replace("/login");
      const [{ data: p }, { data: f }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", session.user.id).single(),
        supabase.from("fases").select("*").order("orden")
      ]);
      setPerfil(p);
      setFases(f || []);
      if (f?.length) setFaseId(f[0].id);
    })();
  }, [router]);

  const cargar = useCallback(async () => {
    if (!faseId) return;
    const [{ data: t }, { count }, { data: admins }] = await Promise.all([
      supabase
        .from("tabla_posiciones")
        .select("*")
        .eq("fase_id", faseId)
        .order("puntos", { ascending: false })
        .order("exactos", { ascending: false }),
      supabase
        .from("pagos")
        .select("*", { count: "exact", head: true })
        .eq("fase_id", faseId)
        .eq("pagado", true),
      supabase
        .from("profiles")
        .select("id")
        .eq("es_admin", true)
    ]);
    const adminIds = new Set((admins || []).map((a) => a.id));
    setFilas((t || []).filter((f) => !adminIds.has(f.user_id)));
    setPagados(count || 0);
  }, [faseId]);

  useEffect(() => { cargar(); }, [cargar]);

  const fase = fases.find((f) => f.id === faseId);
  const bolsa = fase ? Number(fase.cuota) * pagados : 0;

  if (!perfil) {
    return <main className="min-h-screen flex items-center justify-center font-marcador text-cal/60">Cargando…</main>;
  }

  return (
    <>
      <Nav perfil={perfil} />
      <main className="max-w-3xl mx-auto px-4 py-6">
        <header className="mb-5 flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h1 className="titulo text-2xl text-cal">Tabla de posiciones</h1>
            <p className="text-cal/60 text-sm mt-1">
              Desempate: más marcadores exactos. El 1er lugar se lleva toda la bolsa.
            </p>
          </div>
          <div className="text-right">
            <p className="font-marcador text-xs text-cal/50 uppercase">Bolsa de la fase</p>
            <p className="font-display text-3xl text-oro">Q{bolsa}</p>
            <p className="font-marcador text-xs text-cal/50">{pagados} cuota(s) pagada(s)</p>
          </div>
        </header>

        <div className="flex flex-wrap gap-2 mb-5">
          {fases.map((f) => (
            <button
              key={f.id}
              className={`chip ${f.id === faseId ? "chip-activo" : ""}`}
              onClick={() => setFaseId(f.id)}
            >
              {f.nombre}
            </button>
          ))}
        </div>

        {!filas.length ? (
          <div className="tarjeta-partido text-center text-cal/60 py-10">
            Aún no hay puntos en esta fase. La tabla aparece cuando finaliza el primer partido
            (y solo cuenta a quienes ya pagaron su cuota).
          </div>
        ) : (
          <div className="tarjeta-partido overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="font-marcador text-cal/50 text-xs uppercase border-b linea">
                  <th className="text-left px-4 py-3">#</th>
                  <th className="text-left px-4 py-3">Jugador</th>
                  <th className="text-right px-4 py-3">Pts</th>
                  <th className="text-right px-4 py-3">Exactos</th>
                  <th className="text-right px-4 py-3 hidden sm:table-cell">Aciertos</th>
                  <th className="text-right px-4 py-3 hidden sm:table-cell">Jugados</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f, i) => (
                  <tr
                    key={f.user_id}
                    className={`border-b linea last:border-0 ${
                      f.user_id === perfil.id ? "bg-canchaclaro/60" : ""
                    }`}
                  >
                    <td className="px-4 py-3 font-marcador">
                      {i === 0 ? <span className="text-oro font-bold">1 ♛</span> : i + 1}
                    </td>
                    <td className="px-4 py-3 font-bold">
                      {f.nombre}
                      {f.user_id === perfil.id && (
                        <span className="text-cal/40 font-normal"> (vos)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-marcador font-bold text-lg">
                      {f.puntos}
                    </td>
                    <td className="px-4 py-3 text-right font-marcador text-oro">{f.exactos}</td>
                    <td className="px-4 py-3 text-right font-marcador hidden sm:table-cell">
                      {f.aciertos}
                    </td>
                    <td className="px-4 py-3 text-right font-marcador text-cal/50 hidden sm:table-cell">
                      {f.pronosticados}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
