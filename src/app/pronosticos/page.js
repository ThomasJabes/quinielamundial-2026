"use client";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Nav from "@/components/Nav";

function puntosDe(pl, pv, rl, rv) {
  if (rl == null || rv == null) return 0;
  if (pl === rl && pv === rv) return rl === rv ? 2 : 3;
  if (Math.sign(pl - pv) === Math.sign(rl - rv)) return 1;
  return 0;
}

function fechaCorta(iso) {
  return new Date(iso).toLocaleString("es-GT", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export default function Pronosticos() {
  const router = useRouter();
  const [perfil, setPerfil] = useState(null);
  const [fases, setFases] = useState([]);
  const [faseId, setFaseId] = useState(null);
  const [jornada, setJornada] = useState(null);
  const [partidos, setPartidos] = useState([]);
  const [picks, setPicks] = useState({});
  const [pagado, setPagado] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [ajenos, setAjenos] = useState({});
  const [errorPerfil, setErrorPerfil] = useState(null);

  // Sesión + datos base
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.replace("/login");

      const [{ data: p, error: ep }, { data: f }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", session.user.id).single(),
        supabase.from("fases").select("*").order("orden")
      ]);

      if (!p || ep) {
        setErrorPerfil("No se encontró tu perfil. Cerrá sesión, volvé a entrar o contactá al administrador.");
        return;
      }

      setPerfil(p);
      setFases(f || []);
      if (f?.length) setFaseId(f[0].id);
    })();
  }, [router]);

  // Partidos + mis pronósticos + estado de pago de la fase
  const cargarFase = useCallback(async () => {
    if (!faseId || !perfil) return;
    const [{ data: pa }, { data: pn }, { data: pg }] = await Promise.all([
      supabase.from("partidos").select("*").eq("fase_id", faseId).order("fecha_hora"),
      supabase.from("pronosticos").select("*").eq("user_id", perfil.id),
      supabase.from("pagos").select("pagado").eq("user_id", perfil.id).eq("fase_id", faseId).maybeSingle()
    ]);
    setPartidos(pa || []);
    const mapa = {};
    (pn || []).forEach((x) => {
      mapa[x.partido_id] = { goles_local: x.goles_local, goles_visitante: x.goles_visitante };
    });
    setPicks(mapa);
    setPagado(Boolean(pg?.pagado));
    const jornadas = [...new Set((pa || []).map((x) => x.jornada))].sort((a, b) => a - b);
    const pendiente = (pa || []).find((x) => !x.finalizado);
    setJornada(pendiente ? pendiente.jornada : jornadas[0] ?? null);
  }, [faseId, perfil]);

  useEffect(() => { cargarFase(); }, [cargarFase]);

  const jornadas = useMemo(
    () => [...new Set(partidos.map((p) => p.jornada))].sort((a, b) => a - b),
    [partidos]
  );
  const visibles = useMemo(
    () => partidos.filter((p) => p.jornada === jornada),
    [partidos, jornada]
  );
  const fase = fases.find((f) => f.id === faseId);

  function setPick(id, campo, valor) {
    const n = valor === "" ? "" : Math.max(0, Math.min(20, Number(valor)));
    setPicks((prev) => ({ ...prev, [id]: { ...prev[id], [campo]: n } }));
  }

  async function guardar() {
    setAviso(null);
    const abiertos = visibles.filter((p) => new Date(p.fecha_hora) > new Date());
    const filas = abiertos
      .map((p) => ({ partido: p, pick: picks[p.id] }))
      .filter(({ pick }) =>
        pick && pick.goles_local !== "" && pick.goles_visitante !== "" &&
        pick.goles_local != null && pick.goles_visitante != null
      )
      .map(({ partido, pick }) => ({
        user_id: perfil.id,
        partido_id: partido.id,
        goles_local: pick.goles_local,
        goles_visitante: pick.goles_visitante,
        actualizado: new Date().toISOString()
      }));

    if (!filas.length) {
      return setAviso({ tipo: "error", texto: "No hay marcadores completos que guardar." });
    }

    setGuardando(true);
    const { error } = await supabase
      .from("pronosticos")
      .upsert(filas, { onConflict: "user_id,partido_id" });
    setGuardando(false);

    if (error) {
      setAviso({ tipo: "error", texto: "No se pudo guardar. Verificá que los partidos no hayan iniciado." });
    } else {
      setAviso({ tipo: "ok", texto: `Guardado: ${filas.length} pronóstico(s). ¡Suerte!` });
    }
  }

  async function verAjenos(partidoId) {
    if (ajenos[partidoId]) {
      setAjenos((prev) => ({ ...prev, [partidoId]: null }));
      return;
    }
    const { data } = await supabase
      .from("pronosticos")
      .select("goles_local, goles_visitante, profiles(nombre)")
      .eq("partido_id", partidoId);
    setAjenos((prev) => ({ ...prev, [partidoId]: data || [] }));
  }

  if (errorPerfil) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="tarjeta-partido max-w-md text-center space-y-4">
          <p className="text-tarjeta font-bold">⚠️ Error de perfil</p>
          <p className="text-cal/70 text-sm">{errorPerfil}</p>
          <button
            className="boton-secundario"
            onClick={async () => { await supabase.auth.signOut(); router.push("/login"); }}
          >
            Cerrar sesión
          </button>
        </div>
      </main>
    );
  }

  if (!perfil) {
    return <main className="min-h-screen flex items-center justify-center font-marcador text-cal/60">Cargando…</main>;
  }

  return (
    <>
      <Nav perfil={perfil} />
      <main className="max-w-3xl mx-auto px-4 py-6 pb-28">
        <header className="mb-5">
          <h1 className="titulo text-2xl text-cal">Mis pronósticos</h1>
          <p className="text-cal/60 text-sm mt-1">
            Hola, {perfil.nombre}. Podés editar tus marcadores hasta el pitazo inicial de cada partido.
          </p>
        </header>

        {!pagado && fase && (
          <div className="mb-5 rounded-lg border border-oro/50 bg-oro/10 p-3 text-sm">
            <span className="font-bold text-oro">Cuota pendiente:</span>{" "}
            esta fase cuesta Q{Number(fase.cuota)}. Podés pronosticar desde ya, pero tus puntos
            no aparecerán en la tabla hasta que el administrador registre tu pago.
          </div>
        )}

        {/* Selector de fase y jornada */}
        <div className="flex flex-wrap gap-2 mb-3">
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
        {jornadas.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-5">
            {jornadas.map((j) => (
              <button
                key={j}
                className={`chip ${j === jornada ? "chip-activo" : ""}`}
                onClick={() => setJornada(j)}
              >
                Jornada {j}
              </button>
            ))}
          </div>
        )}

        {!visibles.length && (
          <div className="tarjeta-partido text-center text-cal/60 py-10">
            Todavía no hay partidos cargados en esta fase. El administrador los agregará pronto.
          </div>
        )}

        <div className="space-y-3">
          {visibles.map((p) => {
            const inicio = new Date(p.fecha_hora);
            const cerrado = inicio <= new Date();
            const pick = picks[p.id] || {};
            const pts = p.finalizado && pick.goles_local != null
              ? puntosDe(pick.goles_local, pick.goles_visitante, p.goles_local, p.goles_visitante)
              : null;

            return (
              <div key={p.id} className="tarjeta-partido">
                <div className="flex items-center justify-between text-xs font-marcador text-cal/50 mb-3">
                  <span>{p.grupo ? `Grupo ${p.grupo} · ` : ""}{fechaCorta(p.fecha_hora)}</span>
                  {p.finalizado ? (
                    <span className="text-oro">Final {p.goles_local} – {p.goles_visitante}</span>
                  ) : cerrado ? (
                    <span className="text-tarjeta">En juego / cerrado</span>
                  ) : (
                    <span>Abierto</span>
                  )}
                </div>

                <div className="flex items-center justify-center gap-3">
                  <span className="flex-1 text-right font-bold">{p.equipo_local}</span>
                  {cerrado ? (
                    <span className="font-marcador text-2xl font-bold w-28 text-center bg-pizarra rounded-md py-2 border linea">
                      {pick.goles_local ?? "–"} : {pick.goles_visitante ?? "–"}
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <input
                        type="number"
                        className="marcador-input"
                        min={0}
                        max={20}
                        value={pick.goles_local ?? ""}
                        onChange={(e) => setPick(p.id, "goles_local", e.target.value)}
                        aria-label={`Goles ${p.equipo_local}`}
                      />
                      <span className="font-marcador text-cal/40">:</span>
                      <input
                        type="number"
                        className="marcador-input"
                        min={0}
                        max={20}
                        value={pick.goles_visitante ?? ""}
                        onChange={(e) => setPick(p.id, "goles_visitante", e.target.value)}
                        aria-label={`Goles ${p.equipo_visitante}`}
                      />
                    </span>
                  )}
                  <span className="flex-1 font-bold">{p.equipo_visitante}</span>
                </div>

                {pts != null && (
                  <p className="text-center text-sm mt-2 font-marcador">
                    {pts === 3 && <span className="text-oro">★ Marcador exacto · 3 puntos</span>}
                    {pts === 2 && <span className="text-oro">★ Empate exacto · 2 puntos</span>}
                    {pts === 1 && <span className="text-cal/80">Acierto · 1 punto</span>}
                    {pts === 0 && <span className="text-cal/40">0 puntos</span>}
                  </p>
                )}

                {cerrado && (
                  <div className="mt-3 text-center">
                    <button
                      className="text-xs font-marcador text-cal/50 hover:text-oro underline underline-offset-4"
                      onClick={() => verAjenos(p.id)}
                    >
                      {ajenos[p.id] ? "Ocultar pronósticos del grupo" : "Ver pronósticos del grupo"}
                    </button>
                    {ajenos[p.id] && (
                      <ul className="mt-2 text-sm font-marcador text-cal/80 space-y-1">
                        {ajenos[p.id].map((x, i) => (
                          <li key={i}>
                            {x.profiles?.nombre ?? "—"}: {x.goles_local} – {x.goles_visitante}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Barra fija de guardado */}
        {visibles.some((p) => new Date(p.fecha_hora) > new Date()) && (
          <div className="fixed bottom-0 inset-x-0 bg-pizarra/95 border-t linea backdrop-blur">
            <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
              <button className="boton flex-1 sm:flex-none" onClick={guardar} disabled={guardando}>
                {guardando ? "Guardando…" : "Guardar pronósticos"}
              </button>
              {aviso && (
                <span className={`text-sm ${aviso.tipo === "error" ? "text-tarjeta" : "text-oro"}`}>
                  {aviso.texto}
                </span>
              )}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
