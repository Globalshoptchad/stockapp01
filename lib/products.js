import { supabase } from "./supabaseClient";

// Liste des produits avec un petit cache : l'écran s'affiche tout de suite avec la dernière liste connue
// (utile avec un réseau lent), puis se met à jour quand Supabase répond.
const KEY = "products-cache-v1";
const COLS = "id,name,barcode,photo_url,total_in,total_out";
let memory = null;

export function cachedProducts() {
  if (memory) return memory;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) memory = JSON.parse(raw);
  } catch {}
  return memory;
}

export async function fetchProducts() {
  const { data, error } = await supabase.from("product_stock").select(COLS).order("name");
  if (error) throw error;
  memory = data || [];
  try {
    localStorage.setItem(KEY, JSON.stringify(memory));
  } catch {}
  return memory;
}

export function clearProductsCache() {
  memory = null;
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

// Miniature : à côté de chaque photo "abc.jpg" on enregistre aussi "abc_t.jpg" (petite, ~15 Ko)
// pour que la grille de 150 produits charge vite et consomme peu de données mobiles.
export function thumbUrl(url) {
  if (!url || !/\.jpg(\?|$)/.test(url)) return url;
  return url.replace(/\.jpg(\?|$)/, "_t.jpg$1");
}

// Recherche sans tenir compte des accents ni des majuscules
export function normalize(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function filterProducts(list, q) {
  const s = normalize(q.trim());
  if (!s) return list;
  return list.filter((p) => normalize(p.name).includes(s) || (p.barcode || "").includes(s));
}
