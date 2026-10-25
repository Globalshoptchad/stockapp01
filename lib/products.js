import { supabase } from "./supabaseClient";

// Liste des produits avec un petit cache : l'écran s'affiche tout de suite avec la dernière liste connue
// (utile avec un réseau lent), puis se met à jour quand Supabase répond.
const KEY = "products-cache-v2";
const COLS =
  "id,name,barcode,photo_url,total_in,total_out,pack_size,buy_price,sell_price,sell_price_piece,revenue,cost_sold,cost_in";
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

// ---------- Argent ----------
const n = (v) => Number(v) || 0;

export function packSize(p) {
  return Math.max(1, parseInt(p && p.pack_size, 10) || 1);
}
// Prix de vente d'une pièce : celui écrit par le commerçant, sinon prix du carton ÷ nombre de pièces
export function piecePrice(p) {
  return p && p.sell_price_piece != null && p.sell_price_piece !== "" ? n(p.sell_price_piece) : n(p && p.sell_price) / packSize(p);
}
// Coût d'achat d'une pièce
export function pieceCost(p) {
  return n(p && p.buy_price) / packSize(p);
}
export function hasPrices(p) {
  return n(p && p.sell_price) > 0 || n(p && p.sell_price_piece) > 0;
}
export function stockOf(p) {
  return n(p.total_in) - n(p.total_out);
}
// "Presque fini" : il reste 3 pièces ou moins, ou moins de 10 % de ce qui est entré
export function isLow(p, everIn) {
  const left = stockOf(p);
  const base = everIn != null ? everIn : n(p.total_in);
  return left > 0 && left <= Math.max(3, Math.ceil(base * 0.1));
}
// Résumé argent d'un produit (tout l'historique)
export function moneyOf(p) {
  const revenue = n(p.revenue);
  const cost = n(p.cost_sold);
  const left = Math.max(0, stockOf(p));
  return {
    revenue, // argent des ventes
    profit: revenue - cost, // bénéfice
    stockValue: Math.round(left * pieceCost(p)), // ce que vaut le stock restant (prix d'achat)
    stockSaleValue: Math.round(left * piecePrice(p)), // ce qu'il rapportera s'il est tout vendu
  };
}

// 20000 -> "20 000"
// En arabe la page s'écrit de droite à gauche : sans précaution, "12 000 FCFA" devient "FCFA 000 12".
// On entoure donc le nombre d'une « bulle gauche-à-droite » (caractères invisibles LRI…PDI) et on groupe
// les milliers avec une espace insécable : le chiffre s'affiche toujours comme en français.
const LRI = "\u2066";
const PDI = "\u2069";
const NBSP = "\u00a0";
function group(v) {
  const r = Math.round(n(v));
  const s = Math.abs(r)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return (r < 0 ? "-" : "") + s;
}
export function fmt(v) {
  return LRI + group(v) + PDI;
}
export function fcfa(v) {
  return LRI + group(v) + NBSP + "FCFA" + PDI;
}

// 995 pièces, carton de 48 -> { packs: 20, pieces: 35 }
export function splitPacks(qty, p) {
  const size = packSize(p);
  const q = Math.max(0, n(qty));
  return { packs: Math.floor(q / size), pieces: q % size, size };
}

// ---------- Suppression ----------
// Supprime le produit, son historique (automatique en base) ET ses photos dans le stockage :
// l'espace est libéré tout de suite.
export const BUCKET = "product-photos";

function pathFromUrl(url) {
  if (!url) return null;
  const marker = `/${BUCKET}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length).split("?")[0]);
}

export function photoPaths(url) {
  const a = pathFromUrl(url);
  const b = pathFromUrl(thumbUrl(url));
  return [a, b].filter((x, i, arr) => x && arr.indexOf(x) === i);
}

export async function deleteProduct(p) {
  const { error } = await supabase.from("products").delete().eq("id", p.id);
  if (error) throw error;
  const paths = photoPaths(p.photo_url);
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
  if (memory) {
    memory = memory.filter((x) => x.id !== p.id);
    try {
      localStorage.setItem(KEY, JSON.stringify(memory));
    } catch {}
  }
}
