"use client";
export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// Convierte el nombre en un email interno único y reproducible.
// Ej: "Juan López" → "juan.lopez@quiniela.local"
function nombreAEmail(nombre) {
  return (
    nombre
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")   // quita tildes
      .replace(/\s+/g, ".")
      .replace(/[^a-z0-9.]/g, "")
    + "@quiniela.local"
  );
}

export default function Login() {
  const router = useRouter();
  const [modo, setModo] = useState("entrar"); // entrar | crear
  const [nombre, setNombre] = useState("");
  const [password, setPassword] = useState("");
  const [mensaje, setMensaje] = useState(null);
  const [cargando, setCargando] = useState(false);

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
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-block border-2 linea rounded-full px-10 py-8">
            <h1 className="titulo text-3xl text-cal leading-tight">
              Quiniela
              <span className="block text-oro">Mundial 2026</span>
            </h1>
          </div>
          <p className="font-marcador text-cal/60 mt-3 text-sm">
            La polla del grupo · que gane el mejor
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
    </main>
  );
}
