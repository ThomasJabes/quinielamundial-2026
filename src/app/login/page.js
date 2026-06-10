"use client";
export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Login() {
  const router = useRouter();
  const [modo, setModo] = useState("entrar"); // entrar | crear
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mensaje, setMensaje] = useState(null);
  const [cargando, setCargando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setMensaje(null);
    setCargando(true);

    if (modo === "crear") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { nombre: nombre.trim() } }
      });
      setCargando(false);
      if (error) return setMensaje({ tipo: "error", texto: error.message });
      if (data.session) return router.push("/pronosticos");
      setMensaje({
        tipo: "ok",
        texto: "Cuenta creada. Revisá tu correo para confirmarla y luego entrá."
      });
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setCargando(false);
      if (error) return setMensaje({ tipo: "error", texto: "Correo o contraseña incorrectos." });
      router.push("/pronosticos");
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Círculo central de la cancha como marco del título */}
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
          <div className="flex gap-2 mb-5">
            <button
              className={`chip flex-1 text-center ${modo === "entrar" ? "chip-activo" : ""}`}
              onClick={() => setModo("entrar")}
            >
              Entrar
            </button>
            <button
              className={`chip flex-1 text-center ${modo === "crear" ? "chip-activo" : ""}`}
              onClick={() => setModo("crear")}
            >
              Crear cuenta
            </button>
          </div>

          <form onSubmit={enviar} className="space-y-4">
            {modo === "crear" && (
              <div>
                <label className="block text-sm text-cal/70 mb-1">Tu nombre o apodo</label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Como te conoce el grupo"
                  required
                />
              </div>
            )}
            <div>
              <label className="block text-sm text-cal/70 mb-1">Correo</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
            </div>

            {mensaje && (
              <p
                className={`text-sm ${
                  mensaje.tipo === "error" ? "text-tarjeta" : "text-oro"
                }`}
              >
                {mensaje.texto}
              </p>
            )}

            <button className="boton w-full" disabled={cargando}>
              {cargando ? "Un momento…" : modo === "crear" ? "Crear mi cuenta" : "Entrar"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
