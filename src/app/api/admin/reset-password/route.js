import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { userId, nuevaContrasena } = await request.json();

    if (!userId || !nuevaContrasena || nuevaContrasena.length < 6) {
      return NextResponse.json(
        { error: "Datos de entrada no válidos. La contraseña debe tener al menos 6 caracteres." },
        { status: 400 }
      );
    }

    // Obtener la sesión del usuario actual que hace la petición (el administrador)
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    
    if (!token) {
      return NextResponse.json({ error: "No autorizado. Token no proporcionado." }, { status: 401 });
    }

    // Inicializar Supabase usando la clave SERVICE_ROLE (solo servidor)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    );

    // Validar el token del administrador
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: "Sesión inválida o expirada." }, { status: 401 });
    }

    // Verificar en la base de datos si el usuario autenticado tiene rol de administrador
    const { data: perfil, error: dbError } = await supabaseAdmin
      .from("profiles")
      .select("es_admin")
      .eq("id", user.id)
      .single();

    if (dbError || !perfil || !perfil.es_admin) {
      return NextResponse.json({ error: "Acceso denegado. Se requieren permisos de administrador." }, { status: 403 });
    }

    // Modificar la contraseña del usuario objetivo usando la API Auth Admin
    const { error: resetError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: nuevaContrasena }
    );

    if (resetError) {
      return NextResponse.json({ error: resetError.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, mensaje: "Contraseña actualizada exitosamente." });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
