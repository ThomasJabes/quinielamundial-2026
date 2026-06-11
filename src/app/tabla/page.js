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
  const [ultimaActualizacion, setUltimaActualizacion] = useState(null);
  const [actualizando, setActualizando] = useState(false);
  const [participantes, setParticipantes] = useState([]);
  const [seccion, setSeccion] = useState("tabla");
  const [totalPartidos, setTotalPartidos] = useState(0);

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

  const cargar = useCallback(async (mostrarSpinner = false) => {
    if (!faseId) return;
    if (mostrarSpinner) setActualizando(true);
    const [{ data: t }, { count: pagadosCount }, { data: admins }, { data: todosPerfiles }, { data: todosPagos }, { data: partidosDeFase }] = await Promise.all([
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
        .eq("es_admin", true),
      supabase
        .from("profiles")
        .select("id, nombre, created_at, es_admin")
        .order("nombre"),
      supabase
        .from("pagos")
        .select("user_id, pagado")
        .eq("fase_id", faseId),
      supabase
        .from("partidos")
        .select("id")
        .eq("fase_id", faseId)
    ]);

    const adminIds = new Set((admins || []).map((a) => a.id));
    setFilas((t || []).filter((f) => !adminIds.has(f.user_id)));
    setPagados(pagadosCount || 0);

    const partidosIds = (partidosDeFase || []).map((p) => p.id);
    const totalPartidosFase = partidosIds.length;
    setTotalPartidos(totalPartidosFase);

    const picksMapa = {};
    if (totalPartidosFase > 0) {
      const { data: conteos } = await supabase
        .rpc("obtener_conteo_pronosticos", { fase_id_param: faseId });
      (conteos || []).forEach((c) => {
        picksMapa[c.user_id] = Number(c.completados);
      });
    }

    // Mapear participantes y sus estados de pago
    const jugadoresPerfiles = (todosPerfiles || []).filter((p) => !p.es_admin);
    const pagosMapa = {};
    (todosPagos || []).forEach((p) => {
      pagosMapa[p.user_id] = p.pagado;
    });

    const listaParticipantes = jugadoresPerfiles.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      fecha: p.created_at,
      pagado: Boolean(pagosMapa[p.id]),
      completados: picksMapa[p.id] || 0
    }));
    setParticipantes(listaParticipantes);

    setUltimaActualizacion(new Date());
    if (mostrarSpinner) setActualizando(false);
  }, [faseId]);

  // Carga inicial
  useEffect(() => { cargar(); }, [cargar]);

  // Auto-refresh cada 30 segundos
  useEffect(() => {
    if (!faseId) return;
    const intervalo = setInterval(() => cargar(), 30000);
    return () => clearInterval(intervalo);
  }, [faseId, cargar]);

  // Realtime: actualiza al instante cuando admin cambia un partido
  useEffect(() => {
    if (!faseId) return;
    const channel = supabase
      .channel("partidos-realtime")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "partidos" },
        () => { cargar(); }
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [faseId, cargar]);

  const fase = fases.find((f) => f.id === faseId);
  const bolsa = fase ? Number(fase.cuota) * pagados : 0;

  function horaActualizacion(fecha) {
    if (!fecha) return null;
    return fecha.toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }

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
              Puntos: <strong>Victoria</strong> (3 pts) · <strong>Empate Exac</strong> (2 pts) · <strong>Acertado equipo</strong> (1 pt). Desempate: más marcadores exactos.
            </p>
          </div>
          <div className="text-right">
            <p className="font-marcador text-xs text-cal/50 uppercase">Bolsa de la fase</p>
            <p className="font-display text-3xl text-oro">Q{bolsa}</p>
            <p className="font-marcador text-xs text-cal/50">{pagados} cuota(s) pagada(s)</p>
          </div>
        </header>

        {/* Selector de fase + botón refresh */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
          <div className="flex flex-wrap gap-2">
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
          <div className="flex items-center gap-2">
            {ultimaActualizacion && (
              <span className="font-marcador text-xs text-cal/40">
                ↻ {horaActualizacion(ultimaActualizacion)}
              </span>
            )}
            <button
              className="chip hover:chip-activo"
              onClick={() => cargar(true)}
              disabled={actualizando}
              title="Actualizar tabla"
            >
              {actualizando ? "…" : "⟳ Actualizar"}
            </button>
          </div>
        </div>

        {/* Pestañas de Navegación */}
        <div className="flex border-b linea mb-6">
          <button
            className={`py-2 px-4 font-marcador text-sm font-bold border-b-2 transition-colors -mb-px ${
              seccion === "tabla"
                ? "border-oro text-oro"
                : "border-transparent text-cal/60 hover:text-cal"
            }`}
            onClick={() => setSeccion("tabla")}
          >
            Clasificación
          </button>
          <button
            className={`py-2 px-4 font-marcador text-sm font-bold border-b-2 transition-colors -mb-px ${
              seccion === "participantes"
                ? "border-oro text-oro"
                : "border-transparent text-cal/60 hover:text-cal"
            }`}
            onClick={() => setSeccion("participantes")}
          >
            Participantes ({participantes.length})
          </button>
        </div>

        {seccion === "tabla" ? (
          !filas.length ? (
            <div className="tarjeta-partido text-center text-cal/60 py-10">
              Aún no hay puntos en esta fase. La tabla aparece cuando finaliza el primer partido
              (y solo cuenta a quienes ya pagaron su cuota).
            </div>
          ) : (
            <div className="tarjeta-partido overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="font-marcador text-cal/50 text-xs uppercase border-b linea">
                    <th className="text-left px-2 sm:px-4 py-3">#</th>
                    <th className="text-left px-2 sm:px-4 py-3">Jugador</th>
                    <th className="text-right px-2 sm:px-4 py-3" title="Puntos totales">Pts</th>
                    <th className="text-right px-2 sm:px-4 py-3 text-oro" title="Marcadores exactos de victoria (3 pts)">Victoria</th>
                    <th className="text-right px-2 sm:px-4 py-3 text-oro" title="Marcadores exactos de empate (2 pts)">Empate Exac</th>
                    <th className="text-right px-2 sm:px-4 py-3" title="Aciertos de resultado simple (1 pt)">Acertado eq.</th>
                    <th className="text-right px-2 sm:px-4 py-3 hidden sm:table-cell" title="Partidos jugados / pronosticados">Jugados</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f, i) => {
                    // Calcular posición real manejando empates
                    let posicion = i + 1;
                    if (i > 0) {
                      let j = i;
                      while (j > 0 && filas[j].puntos === filas[j - 1].puntos && filas[j].exactos === filas[j - 1].exactos) {
                        j--;
                      }
                      posicion = j + 1;
                    }

                    return (
                      <tr
                        key={f.user_id}
                        className={`border-b linea last:border-0 transition-colors ${
                          f.user_id === perfil.id ? "bg-canchaclaro/60" : ""
                        }`}
                      >
                        <td className="px-2 sm:px-4 py-3 font-marcador">
                          {posicion === 1 ? <span className="text-oro font-bold">1 ♛</span> : posicion}
                        </td>
                        <td className="px-2 sm:px-4 py-3 font-bold">
                          {f.nombre}
                          {f.user_id === perfil.id && (
                            <span className="text-cal/40 font-normal"> (vos)</span>
                          )}
                        </td>
                        <td className="px-2 sm:px-4 py-3 text-right font-marcador font-bold text-lg text-oro">
                          {f.puntos}
                        </td>
                        <td className="px-2 sm:px-4 py-3 text-right font-marcador">
                          {f.exactos_victoria ?? 0}
                        </td>
                        <td className="px-2 sm:px-4 py-3 text-right font-marcador">
                          {f.exactos_empate ?? 0}
                        </td>
                        <td className="px-2 sm:px-4 py-3 text-right font-marcador">
                          {f.aciertos_simples ?? 0}
                        </td>
                        <td className="px-2 sm:px-4 py-3 text-right font-marcador text-cal/50 hidden sm:table-cell">
                          {f.pronosticados}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <div className="tarjeta-partido p-0 overflow-hidden">
            <div className="p-4 border-b linea flex items-center justify-between flex-wrap gap-2 bg-pizarra/35">
              <h2 className="titulo text-lg text-cal">Jugadores Registrados</h2>
              <span className="text-cal/60 text-xs font-marcador">
                {participantes.filter(p => p.pagado).length} de {participantes.length} cuota(s) pagada(s)
              </span>
            </div>
            <ul className="divide-y divide-cal/10">
              {participantes.length === 0 ? (
                <li className="p-8 text-center text-cal/60 text-sm">
                  No hay jugadores registrados en esta fase.
                </li>
              ) : (
                participantes.map((p, index) => (
                  <li key={p.id} className="p-4 flex items-center justify-between hover:bg-canchaclaro/10 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-cal/40 font-marcador w-6">{index + 1}</span>
                      <span className="font-bold text-cal">
                        {p.nombre}
                        {p.id === perfil.id && <span className="text-cal/40 font-normal"> (vos)</span>}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {totalPartidos > 0 && (
                        p.completados === totalPartidos ? (
                          <span className="chip text-xs bg-canchaclaro/40 border border-canchaclaro/80 text-oro px-2 py-1 flex items-center gap-1 font-bold" title="Pronósticos completos">
                            <span>✓</span> {p.completados}/{totalPartidos}
                          </span>
                        ) : (
                          <span className="chip text-xs bg-pizarra/20 border border-linea text-cal/50 px-2 py-1 flex items-center gap-1" title="Pronósticos incompletos">
                            <span>✍️</span> {p.completados}/{totalPartidos}
                          </span>
                        )
                      )}

                      {p.pagado ? (
                        <span className="chip chip-activo text-xs bg-canchaclaro/20 border border-canchaclaro/40 text-oro px-2 py-1 flex items-center gap-1">
                          <span>✓</span> Pagado
                        </span>
                      ) : (
                        <span className="chip text-xs bg-pizarra/20 border border-linea text-cal/40 px-2 py-1 flex items-center gap-1">
                          <span>⏳</span> Pendiente
                        </span>
                      )}
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </main>
    </>
  );
}
