"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// Convierte el nombre en un email interno único y reproducible.
// Ej: "Juan López" → "juan.lopez@quiniela2026.com"
function nombreAEmail(nombre) {
  return (
    nombre
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")   // quita tildes
      .replace(/\s+/g, ".")
      .replace(/[^a-z0-9.]/g, "")
    + "@quiniela2026.com"
  );
}

export default function Login() {
  const router = useRouter();
  const [modo, setModo] = useState("entrar"); // entrar | crear
  const [nombre, setNombre] = useState("");
  const [password, setPassword] = useState("");
  const [mensaje, setMensaje] = useState(null);
  const [cargando, setCargando] = useState(false);

  // Estados para la tabla de posiciones pública
  const [fases, setFases] = useState([]);
  const [faseId, setFaseId] = useState(null);
  const [filas, setFilas] = useState([]);
  const [bolsa, setBolsa] = useState(0);
  const [pagados, setPagados] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [vistaMovil, setVistaMovil] = useState("login"); // login | tabla

  const cargarTabla = useCallback(async (fId, mostrarSpinner = false) => {
    if (mostrarSpinner) setActualizando(true);
    else setLoading(true);

    try {
      const url = fId ? `/api/public-tabla?faseId=${fId}` : "/api/public-tabla";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setFases(data.fases || []);
        setFaseId(data.faseId || null);
        setFilas(data.filas || []);
        setBolsa(data.bolsa || 0);
        setPagados(data.pagados || 0);
      }
    } catch (err) {
      console.error("Error al cargar la tabla de posiciones:", err);
    } finally {
      setLoading(false);
      setActualizando(false);
    }
  }, []);

  useEffect(() => {
    cargarTabla();
  }, [cargarTabla]);

  const cambiarFase = (id) => {
    setFaseId(id);
    cargarTabla(id);
  };

  async function enviar(e) {
    e.preventDefault();
    setMensaje(null);
    setCargando(true);
    const email = nombreAEmail(nombre);

    if (modo === "crear") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { nombre: nombre.trim() } }
      });
      setCargando(false);
      if (error) {
        const texto =
          error.message.includes("already registered")
            ? "Ese nombre ya está en uso. Elegí otro o entrá directamente."
            : error.message;
        return setMensaje({ tipo: "error", texto });
      }
      if (data.session) return router.push("/pronosticos");
      setMensaje({ tipo: "ok", texto: "¡Cuenta creada! Ya podés entrar." });
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setCargando(false);
      if (error) return setMensaje({ tipo: "error", texto: "Nombre o contraseña incorrectos." });
      router.push("/pronosticos");
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-5xl flex flex-col lg:flex-row gap-8 items-start justify-center py-8">
        
        {/* Cabecera de Logo en Móvil (siempre arriba en celular) */}
        <div className="w-full text-center lg:hidden mb-2">
          <div className="inline-block border-2 linea rounded-full px-8 py-5 bg-pizarra/40">
            <h1 className="titulo text-2xl text-cal leading-tight">
              Quiniela
              <span className="block text-oro">Mundial 2026</span>
            </h1>
          </div>
          <p className="font-marcador text-cal/60 mt-2 text-xs">
            Creado por Inge Thomas · World Cup
          </p>
        </div>

        {/* Selector de Vista en Móvil (solo visible en pantallas pequeñas, colocado abajo del nombre) */}
        <div className="flex w-full gap-2 mb-2 lg:hidden bg-pizarra/40 p-1.5 rounded-lg border linea">
          <button
            className={`flex-1 py-2.5 text-center rounded-md font-display uppercase tracking-wider text-xs transition-all duration-200 ${
              vistaMovil === "login"
                ? "bg-oro text-pizarra font-bold shadow-md"
                : "text-cal/60 hover:text-cal"
            }`}
            onClick={() => setVistaMovil("login")}
          >
            🔑 Ingresar
          </button>
          <button
            className={`flex-1 py-2.5 text-center rounded-md font-display uppercase tracking-wider text-xs transition-all duration-200 ${
              vistaMovil === "tabla"
                ? "bg-oro text-pizarra font-bold shadow-md"
                : "text-cal/60 hover:text-cal"
            }`}
            onClick={() => setVistaMovil("tabla")}
          >
            🏆 Posiciones
          </button>
        </div>

        {/* Columna Izquierda: Logo (escritorio) y Formulario de Login */}
        <div className={`${vistaMovil === "login" ? "flex" : "hidden"} lg:flex w-full lg:max-w-md flex-col justify-center`}>
          {/* Logo (solo visible en pantallas grandes) */}
          <div className="text-center mb-8 hidden lg:block">
            <div className="inline-block border-2 linea rounded-full px-10 py-8 bg-pizarra/40">
              <h1 className="titulo text-3xl text-cal leading-tight">
                Quiniela
                <span className="block text-oro">Mundial 2026</span>
              </h1>
            </div>
            <p className="font-marcador text-cal/60 mt-3 text-sm">
              Creado por Inge Thomas · World Cup
            </p>
          </div>

          <div className="tarjeta-partido">
            {/* Tabs */}
            <div className="flex gap-2 mb-5">
              <button
                className={`chip flex-1 text-center ${modo === "entrar" ? "chip-activo" : ""}`}
                onClick={() => { setModo("entrar"); setMensaje(null); }}
              >
                Entrar
              </button>
              <button
                className={`chip flex-1 text-center ${modo === "crear" ? "chip-activo" : ""}`}
                onClick={() => { setModo("crear"); setMensaje(null); }}
              >
                Crear cuenta
              </button>
            </div>

            <form onSubmit={enviar} className="space-y-4">
              <div>
                <label className="block text-sm text-cal/70 mb-1">
                  {modo === "crear" ? "Tu nombre o apodo" : "Tu nombre"}
                </label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder={modo === "crear" ? "Como te conoce el grupo" : "El nombre con que te registraste"}
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-cal/70 mb-1">Contraseña</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  required
                />
                {modo === "crear" && (
                  <p className="text-xs text-cal/40 mt-1">Mínimo 6 caracteres</p>
                )}
              </div>

              {mensaje && (
                <p className={`text-sm ${mensaje.tipo === "error" ? "text-tarjeta" : "text-oro"}`}>
                  {mensaje.texto}
                </p>
              )}

              <button className="boton w-full" disabled={cargando}>
                {cargando
                  ? "Un momento…"
                  : modo === "crear"
                  ? "Crear mi cuenta"
                  : "Entrar"}
              </button>
            </form>
          </div>
        </div>

        {/* Columna Derecha: Tabla de Posiciones Pública */}
        <div className={`${vistaMovil === "tabla" ? "block" : "hidden"} lg:block w-full lg:flex-1`}>
          <div className="tarjeta-partido">
            <header className="mb-4 flex items-end justify-between gap-3 flex-wrap border-b linea pb-4">
              <div>
                <h2 className="titulo text-xl text-cal">Tabla de posiciones</h2>
                <p className="text-cal/50 text-xs mt-1">
                  Puntos: <strong>Vic</strong> (3 pts) · <strong>Emp</strong> (2 pts) · <strong>Acierto</strong> (1 pt)
                </p>
              </div>
              <div className="text-right flex flex-col items-end">
                <p className="font-marcador text-xs text-cal/50 uppercase">Bolsa</p>
                <p className="font-display text-2xl text-oro">Q{bolsa}</p>
                <p className="font-marcador text-[10px] text-cal/50 mb-1">{pagados} cuota(s) pagada(s)</p>
                {bolsa > 0 && (
                  <div className="text-right text-[10px] text-cal/70 bg-pizarra/30 border border-linea rounded px-2 py-1 space-y-0.5 font-marcador mt-1">
                    <span className="block text-oro/90">🏆 Premios:</span>
                    <span className="block">🥇 1°: Q{Math.round(bolsa * 0.5)}</span>
                    <span className="block">🥈 2°: Q{Math.round(bolsa * 0.3333)}</span>
                    <span className="block">🥉 3°: Q{bolsa - Math.round(bolsa * 0.5) - Math.round(bolsa * 0.3333)}</span>
                  </div>
                )}
              </div>
            </header>

            {/* Selector de fase + botón refresh */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div className="flex flex-wrap gap-1.5">
                {fases.map((f) => (
                  <button
                    key={f.id}
                    className={`px-3 py-1 rounded-full border linea text-xs font-marcador cursor-pointer transition ${
                      f.id === faseId ? "bg-oro text-pizarra border-oro font-bold" : "hover:bg-canchaclaro/30"
                    }`}
                    onClick={() => cambiarFase(f.id)}
                  >
                    {f.nombre}
                  </button>
                ))}
              </div>
              <button
                className="px-3 py-1 rounded-full border linea text-xs font-marcador cursor-pointer transition hover:bg-oro hover:text-pizarra"
                onClick={() => cargarTabla(faseId, true)}
                disabled={actualizando || loading}
                title="Actualizar tabla"
              >
                {actualizando ? "…" : "⟳"}
              </button>
            </div>

            {loading ? (
              <div className="text-center text-cal/60 py-10 font-marcador text-sm">Cargando posiciones…</div>
            ) : !filas.length ? (
              <div className="text-center text-cal/60 py-10 text-sm">
                Aún no hay puntos en esta fase. La tabla aparece cuando finaliza el primer partido (y solo cuenta a quienes ya pagaron).
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="font-marcador text-cal/50 text-[10px] uppercase border-b linea">
                      <th className="text-left px-2 py-2">#</th>
                      <th className="text-left px-2 py-2">Jugador</th>
                      <th className="text-right px-2 py-2 text-oro" title="Puntos totales">Pts</th>
                      <th className="text-right px-2 py-2 hidden sm:table-cell" title="Victoria exacta (3 pts)">Victoria</th>
                      <th className="text-right px-2 py-2 hidden sm:table-cell" title="Empate exacto (2 pts)">Empate Exac</th>
                      <th className="text-right px-2 py-2 hidden sm:table-cell" title="Acierto de resultado simple (1 pt)">Acertado eq.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((f, i) => {
                      let posicion = i + 1;
                      if (i > 0) {
                        let j = i;
                        while (
                          j > 0 &&
                          filas[j].puntos === filas[j - 1].puntos &&
                          filas[j].exactos === filas[j - 1].exactos
                        ) {
                          j--;
                        }
                        posicion = j + 1;
                      }

                      return (
                        <tr
                          key={f.user_id}
                          className="border-b linea last:border-0 hover:bg-canchaclaro/10 transition-colors"
                        >
                          <td className="px-2 py-2 font-marcador">
                            {posicion === 1 ? <span className="text-oro font-bold">1 ♛</span> : posicion}
                          </td>
                          <td className="px-2 py-2 font-bold max-w-[120px] truncate" title={f.nombre}>
                            {f.nombre}
                          </td>
                          <td className="px-2 py-2 text-right font-marcador font-bold text-sm text-oro">
                            {f.puntos}
                          </td>
                          <td className="px-2 py-2 text-right font-marcador text-cal/70 hidden sm:table-cell">
                            {f.exactos_victoria ?? 0}
                          </td>
                          <td className="px-2 py-2 text-right font-marcador text-cal/70 hidden sm:table-cell">
                            {f.exactos_empate ?? 0}
                          </td>
                          <td className="px-2 py-2 text-right font-marcador text-cal/70 hidden sm:table-cell">
                            {f.aciertos_simples ?? 0}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      </div>
    </main>
  );
}
