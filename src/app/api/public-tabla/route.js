import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const faseIdParam = searchParams.get("faseId");

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json(
        { error: "Error de configuración del servidor: faltan variables de entorno de Supabase." },
        { status: 500 }
      );
    }

    // Inicializar Supabase usando la clave SERVICE_ROLE para evadir RLS de forma segura
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Obtener todas las fases activas (excluyendo la Fase de grupos)
    const { data: fases, error: fasesError } = await supabaseAdmin
      .from("fases")
      .select("*")
      .neq("id", 1)
      .order("orden");

    if (fasesError) {
      return NextResponse.json({ error: fasesError.message }, { status: 500 });
    }

    if (!fases || fases.length === 0) {
      return NextResponse.json({ fases: [], filas: [], bolsa: 0, pagados: 0 });
    }

    // Determinar la fase a cargar (la primera por defecto o la solicitada)
    const faseId = faseIdParam ? parseInt(faseIdParam, 10) : fases[0].id;
    const selectedFase = fases.find((f) => f.id === faseId) || fases[0];

    // Consultar tabla de posiciones, pagos y administradores en paralelo
    const [
      { data: t, error: tError },
      { count: pagadosCount, error: pError },
      { data: admins, error: aError }
    ] = await Promise.all([
      supabaseAdmin
        .from("tabla_posiciones")
        .select("*")
        .eq("fase_id", selectedFase.id)
        .order("puntos", { ascending: false })
        .order("exactos", { ascending: false }),
      supabaseAdmin
        .from("pagos")
        .select("*", { count: "exact", head: true })
        .eq("fase_id", selectedFase.id)
        .eq("pagado", true),
      supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("es_admin", true)
    ]);

    if (tError) return NextResponse.json({ error: tError.message }, { status: 500 });
    if (pError) return NextResponse.json({ error: pError.message }, { status: 500 });
    if (aError) return NextResponse.json({ error: aError.message }, { status: 500 });

    const adminIds = new Set((admins || []).map((a) => a.id));
    // Excluir administradores de la clasificación de la quiniela
    const filas = (t || []).filter((f) => !adminIds.has(f.user_id));
    const pagados = pagadosCount || 0;
    const bolsa = Number(selectedFase.cuota) * pagados;

    return NextResponse.json({
      fases,
      faseId: selectedFase.id,
      filas,
      bolsa,
      pagados
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
