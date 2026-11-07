// Visite automatique quotidienne (voir vercel.json) : une petite lecture dans la base
// pour que Supabase (offre gratuite) ne mette jamais le projet en pause après 7 jours sans activité.
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return Response.json({ ok: false, error: "config manquante" }, { status: 500 });
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await supabase.from("products").select("id", { head: true, count: "exact" }).limit(1);
  return Response.json({ ok: !error, at: new Date().toISOString(), error: error ? error.message : null }, { status: error ? 500 : 200 });
}
