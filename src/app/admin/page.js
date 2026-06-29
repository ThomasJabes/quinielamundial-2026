"use client";
export const dynamic = "force-dynamic";

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
  const [usuarioIdReset, setUsuarioIdReset] = useState("");
  const [nuevaPasswordReset, setNuevaPasswordReset] = useState("");
  const [mensajeReset, setMensajeReset] = useState(null);

  const cargar = useCallback(async () => {
    const [{ data: f }, { data: pa }, { data: ju }, { data: pg }] = await Promise.all([
      supabase.from("fases").select("*").neq("id", 1).order("orden"),
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

  async function resetResultado(p) {
    if (!confirm(`¿Resetear el resultado de ${p.equipo_local} vs ${p.equipo_visitante}? Se borrarán los goles y quedará como no finalizado.`)) return;
    const { error } = await supabase
      .from("partidos")
      .update({ goles_local: null, goles_visitante: null, finalizado: false })
      .eq("id", p.id);
    if (error) return avisar("error", "No se pudo resetear el partido.");
    avisar("ok", `Reseteado: ${p.equipo_local} vs ${p.equipo_visitante}`);
    cargar();
  }

  async function alternarParticipacion(userId, faseId) {
    const key = `${userId}-${faseId}`;
    const participa = pagos[key] !== undefined;

    if (participa) {
      const { error } = await supabase
        .from("pagos")
        .delete()
        .eq("user_id", userId)
        .eq("fase_id", faseId);
      if (error) return avisar("error", "No se pudo eliminar la participación.");
      setPagos((prev) => {
        const copia = { ...prev };
        delete copia[key];
        return copia;
      });
      avisar("ok", "Participación eliminada.");
    } else {
      const { error } = await supabase.from("pagos").insert({
        user_id: userId,
        fase_id: faseId,
        pagado: false
      });
      if (error) return avisar("error", "No se pudo registrar la participación.");
      setPagos((prev) => ({ ...prev, [key]: false }));
      avisar("ok", "Participación registrada.");
    }
  }

  async function alternarPago(userId, faseId) {
    const key = `${userId}-${faseId}`;
    const pagado = Boolean(pagos[key]);

    const { error } = await supabase.from("pagos").upsert(
      {
        user_id: userId,
        fase_id: faseId,
        pagado: !pagado,
        fecha_pago: !pagado ? new Date().toISOString() : null
      },
      { onConflict: "user_id,fase_id" }
    );
    if (error) return avisar("error", "No se pudo actualizar el pago.");
    setPagos((prev) => ({ ...prev, [key]: !pagado }));
    avisar("ok", !pagado ? "Pago registrado." : "Pago marcado como pendiente.");
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

  async function actualizarFechaLimite(faseId, fecha) {
    const isoFecha = fecha ? new Date(fecha).toISOString() : null;
    const { error } = await supabase
      .from("fases")
      .update({ fecha_limite: isoFecha })
      .eq("id", faseId);
    if (error) return avisar("error", "No se pudo guardar la fecha límite.");
    avisar("ok", "Límite de tiempo de la fase actualizado.");
    cargar();
  }

  async function cambiarPasswordUsuario(e) {
    e.preventDefault();
    if (!usuarioIdReset || nuevaPasswordReset.length < 6) return;
    setMensajeReset(null);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return setMensajeReset({ tipo: "error", texto: "No hay sesión activa." });
    }

    try {
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          userId: usuarioIdReset,
          nuevaContrasena: nuevaPasswordReset
        })
      });

      const data = await res.json();
      if (!res.ok) {
        return setMensajeReset({ tipo: "error", texto: data.error || "No se pudo cambiar la contraseña." });
      }

      setMensajeReset({ tipo: "ok", texto: "Contraseña restablecida con éxito." });
      setUsuarioIdReset("");
      setNuevaPasswordReset("");
      setTimeout(() => setMensajeReset(null), 4000);
    } catch (err) {
      setMensajeReset({ tipo: "error", texto: "Error de red al cambiar la contraseña." });
    }
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
              <FilaResultado key={p.id} partido={p} onGuardar={guardarResultado} onReset={resetResultado} />
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
                    const key = `${j.id}-${f.id}`;
                    const participa = pagos[key] !== undefined;
                    const pagado = Boolean(pagos[key]);
                    return (
                      <td key={f.id} className="text-center py-2 px-2">
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-1.5">
                          <button
                            onClick={() => alternarParticipacion(j.id, f.id)}
                            className={`px-2 py-1 rounded font-marcador text-[10px] border transition ${
                              participa
                                ? "bg-cal/20 text-cal border-cal/50 font-bold"
                                : "border-cal/20 text-cal/30 hover:border-cal/50"
                            }`}
                          >
                            {participa ? "✓ Juega" : "No juega"}
                          </button>
                          <button
                            onClick={() => alternarPago(j.id, f.id)}
                            className={`px-2 py-1 rounded font-marcador text-[10px] border transition ${
                              pagado
                                ? "bg-oro text-pizarra border-oro font-bold"
                                : "border-cal/30 text-cal/50 hover:border-oro"
                            }`}
                          >
                            {pagado ? "Pagado" : "Pendiente"}
                          </button>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* ---- Restablecer Contraseña ---- */}
        <section className="tarjeta-partido">
          <h2 className="titulo text-base text-oro mb-4">Restablecer contraseña de jugador</h2>
          <form onSubmit={cambiarPasswordUsuario} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm text-cal/70 mb-1">Seleccionar Jugador</label>
              <select
                value={usuarioIdReset}
                onChange={(e) => setUsuarioIdReset(e.target.value)}
                required
              >
                <option value="">-- Selecciona un jugador --</option>
                {jugadores.map((j) => (
                  <option key={j.id} value={j.id}>{j.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-cal/70 mb-1">Nueva Contraseña</label>
              <input
                type="password"
                value={nuevaPasswordReset}
                onChange={(e) => setNuevaPasswordReset(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                minLength={6}
                required
              />
            </div>
            <div className="flex items-end">
              <button 
                type="submit" 
                className="boton w-full" 
                disabled={!usuarioIdReset || nuevaPasswordReset.length < 6}
              >
                Actualizar Contraseña
              </button>
            </div>
            {mensajeReset && (
              <p className={`text-sm col-span-full ${mensajeReset.tipo === "error" ? "text-tarjeta" : "text-oro"}`}>
                {mensajeReset.texto}
              </p>
            )}
          </form>
        </section>

        {/* ---- Límites de Pronósticos ---- */}
        <section className="tarjeta-partido">
          <h2 className="titulo text-base text-oro mb-4">Límites de tiempo por fase</h2>
          <p className="text-cal/60 text-xs mb-4">
            Establece una fecha y hora límite global para cada fase. Al expirar,
            los usuarios no podrán crear ni modificar pronósticos en esa fase, incluso si hay partidos que no hayan iniciado.
          </p>
          <div className="space-y-4">
            {fases.map((f) => (
              <FilaLimiteFase key={f.id} fase={f} onGuardar={actualizarFechaLimite} />
            ))}
          </div>
        </section>
      </main>
    </>
  );
}

function FilaResultado({ partido: p, onGuardar, onReset }) {
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
      <div className="flex gap-2">
        <button
          className="boton !py-2 !px-4 !text-xs"
          disabled={!completo}
          onClick={() => onGuardar(p, Number(gl), Number(gv), true)}
        >
          {p.finalizado ? "Actualizar" : "Finalizar"}
        </button>
        {p.finalizado && (
          <button
            className="boton-secundario !py-2 !px-4 !text-xs"
            onClick={() => onReset(p)}
            title="Borrar resultado y volver a pendiente"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}

function FilaLimiteFase({ fase: f, onGuardar }) {
  // Convertir fecha de ISO a formato local de input (YYYY-MM-DDTHH:MM)
  const formatISOToLocal = (isoStr) => {
    if (!isoStr) return "";
    const d = new Date(isoStr);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const [fecha, setFecha] = useState(formatISOToLocal(f.fecha_limite));

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b linea last:border-0 pb-3">
      <div className="flex-1 min-w-[200px]">
        <span className="font-bold text-sm text-cal">{f.nombre}</span>
        {f.fecha_limite ? (
          <span className="block text-xs text-oro">
            Bloquea el: {new Date(f.fecha_limite).toLocaleString("es-GT")}
          </span>
        ) : (
          <span className="block text-xs text-cal/40">Sin límite global (bloqueo por partido)</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="datetime-local"
          className="marcador-input !w-44 !h-9 text-xs px-2"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          aria-label={`Límite de tiempo para ${f.nombre}`}
        />
        <button
          className="boton !py-2 !px-3 !text-xs"
          onClick={() => onGuardar(f.id, fecha)}
        >
          Guardar
        </button>
        {f.fecha_limite && (
          <button
            className="boton-secundario !py-2 !px-3 !text-xs"
            onClick={() => {
              setFecha("");
              onGuardar(f.id, "");
            }}
            title="Quitar límite"
          >
            Quitar
          </button>
        )}
      </div>
    </div>
  );
}
