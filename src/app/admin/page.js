"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Nav from "@/components/Nav";

export default function Admin() {
  const router = useRouter();
  const [perfil, setPerfil] = useState(null);
  const [fases, setFases] = useState([]);
  const [partidos, setPartidos] = useState([]);
  const [jugadores, setJugadores] = useState([]);
  const [pagos, setPagos] = useState({}); // `${user}-${fase}` -> true
  const [aviso, setAviso] = useState(null);
  const [nuevo, setNuevo] = useState({
    fase_id: "", jornada: 1, grupo: "", equipo_local: "", equipo_visitante: "", fecha_hora: ""
  });

  const cargar = useCallback(async () => {
    const [{ data: f }, { data: pa }, { data: ju }, { data: pg }] = await Promise.all([
      supabase.from("fases").select("*").order("orden"),
      supabase.from("partidos").select("*").order("fecha_hora"),
      supabase.from("profiles").select("*").order("nombre"),
      supabase.from("pagos").select("*")
    ]);
    setFases(f || []);
    setPartidos(pa || []);
    setJugadores(ju || []);
    const mapa = {};
    (pg || []).forEach((x) => { mapa[`${x.user_id}-${x.fase_id}`] = x.pagado; });
    setPagos(mapa);
    if (f?.length && !nuevo.fase_id) setNuevo((n) => ({ ...n, fase_id: f[0].id }));
  }, [nuevo.fase_id]);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.replace("/login");
      const { data: p } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
      if (!p?.es_admin) return router.replace("/pronosticos");
      setPerfil(p);
      cargar();
    })();
  }, [router, cargar]);

  function avisar(tipo, texto) {
    setAviso({ tipo, texto });
    setTimeout(() => setAviso(null), 4000);
  }

  async function guardarResultado(p, gl, gv, finalizado) {
    const { error } = await supabase
      .from("partidos")
      .update({ goles_local: gl, goles_visitante: gv, finalizado })
      .eq("id", p.id);
    if (error) return avisar("error", "No se pudo guardar el resultado.");
    avisar("ok", `Resultado guardado: ${p.equipo_local} ${gl}–${gv} ${p.equipo_visitante}`);
    cargar();
  }

  async function alternarPago(userId, faseId) {
    const actual = Boolean(pagos[`${userId}-${faseId}`]);
    const { error } = await supabase.from("pagos").upsert(
      {
        user_id: userId,
        fase_id: faseId,
        pagado: !actual,
        fecha_pago: !actual ? new Date().toISOString() : null
      },
      { onConflict: "user_id,fase_id" }
    );
    if (error) return avisar("error", "No se pudo actualizar el pago.");
    setPagos((prev) => ({ ...prev, [`${userId}-${faseId}`]: !actual }));
  }

  async function agregarPartido(e) {
    e.preventDefault();
    const { error } = await supabase.from("partidos").insert({
      fase_id: Number(nuevo.fase_id),
      jornada: Number(nuevo.jornada),
      grupo: nuevo.grupo.trim() || null,
      equipo_local: nuevo.equipo_local.trim(),
      equipo_visitante: nuevo.equipo_visitante.trim(),
      fecha_hora: new Date(nuevo.fecha_hora).toISOString()
    });
    if (error) return avisar("error", "No se pudo agregar el partido.");
    avisar("ok", "Partido agregado.");
    setNuevo((n) => ({ ...n, equipo_local: "", equipo_visitante: "" }));
    cargar();
  }

  if (!perfil) {
    return <main className="min-h-screen flex items-center justify-center font-marcador text-cal/60">Cargando…</main>;
  }

  return (
    <>
      <Nav perfil={perfil} />
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-8">
        <header className="flex items-center justify-between gap-3">
          <h1 className="titulo text-2xl text-cal">Administración</h1>
          {aviso && (
            <span className={`text-sm ${aviso.tipo === "error" ? "text-tarjeta" : "text-oro"}`}>
              {aviso.texto}
            </span>
          )}
        </header>

        {/* ---- Agregar partido ---- */}
        <section className="tarjeta-partido">
          <h2 className="titulo text-base text-oro mb-4">Agregar partido</h2>
          <form onSubmit={agregarPartido} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-cal/70 mb-1">Fase</label>
              <select
                value={nuevo.fase_id}
                onChange={(e) => setNuevo({ ...nuevo, fase_id: e.target.value })}
              >
                {fases.map((f) => (
                  <option key={f.id} value={f.id}>{f.nombre}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-cal/70 mb-1">Jornada</label>
                <input
                  type="number" min={1}
                  value={nuevo.jornada}
                  onChange={(e) => setNuevo({ ...nuevo, jornada: e.target.value })}
                  className="!w-full"
                />
              </div>
              <div>
                <label className="block text-sm text-cal/70 mb-1">Grupo</label>
                <input
                  type="text" placeholder="A"
                  value={nuevo.grupo}
                  onChange={(e) => setNuevo({ ...nuevo, grupo: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-cal/70 mb-1">Equipo local</label>
              <input
                type="text" required
                value={nuevo.equipo_local}
                onChange={(e) => setNuevo({ ...nuevo, equipo_local: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm text-cal/70 mb-1">Equipo visitante</label>
              <input
                type="text" required
                value={nuevo.equipo_visitante}
                onChange={(e) => setNuevo({ ...nuevo, equipo_visitante: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm text-cal/70 mb-1">Fecha y hora (Guatemala)</label>
              <input
                type="datetime-local" required
                value={nuevo.fecha_hora}
                onChange={(e) => setNuevo({ ...nuevo, fecha_hora: e.target.value })}
              />
            </div>
            <div className="flex items-end">
              <button className="boton w-full">Agregar partido</button>
            </div>
          </form>
        </section>

        {/* ---- Resultados ---- */}
        <section className="tarjeta-partido">
          <h2 className="titulo text-base text-oro mb-4">Resultados</h2>
          {!partidos.length && (
            <p className="text-cal/60 text-sm">Todavía no hay partidos cargados.</p>
          )}
          <div className="space-y-3">
            {partidos.map((p) => (
              <FilaResultado key={p.id} partido={p} onGuardar={guardarResultado} />
            ))}
          </div>
        </section>

        {/* ---- Pagos ---- */}
        <section className="tarjeta-partido overflow-x-auto">
          <h2 className="titulo text-base text-oro mb-4">Control de pagos</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="font-marcador text-cal/50 text-xs uppercase border-b linea">
                <th className="text-left py-2 pr-3">Jugador</th>
                {fases.map((f) => (
                  <th key={f.id} className="text-center py-2 px-2">
                    {f.nombre}<br /><span className="text-oro">Q{Number(f.cuota)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jugadores.map((j) => (
                <tr key={j.id} className="border-b linea last:border-0">
                  <td className="py-2 pr-3 font-bold">
                    {j.nombre}{j.es_admin && <span className="text-cal/40 font-normal"> · admin</span>}
                  </td>
                  {fases.map((f) => {
                    const ok = Boolean(pagos[`${j.id}-${f.id}`]);
                    return (
                      <td key={f.id} className="text-center py-2 px-2">
                        <button
                          onClick={() => alternarPago(j.id, f.id)}
                          className={`px-3 py-1 rounded-full font-marcador text-xs border transition ${
                            ok
                              ? "bg-oro text-pizarra border-oro font-bold"
                              : "border-cal/30 text-cal/50 hover:border-oro"
                          }`}
                        >
                          {ok ? "Pagado" : "Pendiente"}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </>
  );
}

function FilaResultado({ partido: p, onGuardar }) {
  const [gl, setGl] = useState(p.goles_local ?? "");
  const [gv, setGv] = useState(p.goles_visitante ?? "");
  const completo = gl !== "" && gv !== "";

  return (
    <div className="flex flex-wrap items-center gap-3 border-b linea last:border-0 pb-3">
      <span className="flex-1 min-w-[180px] text-sm">
        <span className="font-bold">{p.equipo_local}</span>
        <span className="text-cal/40"> vs </span>
        <span className="font-bold">{p.equipo_visitante}</span>
        <span className="block font-marcador text-xs text-cal/50">
          {p.grupo ? `Grupo ${p.grupo} · ` : ""}J{p.jornada} ·{" "}
          {new Date(p.fecha_hora).toLocaleString("es-GT", {
            day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
          })}
          {p.finalizado && <span className="text-oro"> · Finalizado</span>}
        </span>
      </span>
      <input
        type="number" min={0} max={20}
        className="marcador-input !w-12 !h-11 !text-lg"
        value={gl}
        onChange={(e) => setGl(e.target.value === "" ? "" : Number(e.target.value))}
        aria-label={`Goles ${p.equipo_local}`}
      />
      <span className="font-marcador text-cal/40">:</span>
      <input
        type="number" min={0} max={20}
        className="marcador-input !w-12 !h-11 !text-lg"
        value={gv}
        onChange={(e) => setGv(e.target.value === "" ? "" : Number(e.target.value))}
        aria-label={`Goles ${p.equipo_visitante}`}
      />
      <button
        className="boton !py-2 !px-4 !text-xs"
        disabled={!completo}
        onClick={() => onGuardar(p, Number(gl), Number(gv), true)}
      >
        {p.finalizado ? "Actualizar" : "Finalizar"}
      </button>
    </div>
  );
}
