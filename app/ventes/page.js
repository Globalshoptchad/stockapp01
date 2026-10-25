"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Shell from "../../components/Shell";
import Icon from "../../components/Icons";
import { ProductImage } from "../../components/ProductCard";
import { useLang } from "../../components/Providers";
import { useRequireAuth } from "../../lib/useRequireAuth";
import { supabase } from "../../lib/supabaseClient";
import { cachedProducts, fcfa, fetchProducts, fmt, packSize, piecePrice, stockOf } from "../../lib/products";
import { dayKey, dayLabel, startOfToday, timeOf } from "../../lib/helpers";

const DAYS = 30; // on montre les ventes des 30 derniers jours

// Montant d'une vente (même calcul que la base : carton au prix du carton, pièce au prix de la pièce)
function amountOf(m, p) {
  if (!p) return 0;
  if (m.unit === "pack") return (m.quantity * (Number(p.sell_price) || 0)) / packSize(p);
  return m.quantity * piecePrice(p);
}

// Suivi des ventes : chaque vente avec son jour et son heure, modifiable (+ / −) ou supprimable.
export default function SalesJournalPage() {
  const { t, lang } = useLang();
  const { ready } = useRequireAuth();
  const [moves, setMoves] = useState(null);
  const [products, setProducts] = useState({});
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const since = startOfToday();
    since.setDate(since.getDate() - (DAYS - 1));
    const [{ data }, list] = await Promise.all([
      supabase
        .from("movements")
        .select("id,product_id,quantity,unit,created_at")
        .eq("type", "out")
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false })
        .limit(1000),
      fetchProducts().catch(() => cachedProducts() || []),
    ]);
    const map = {};
    (list || []).forEach((p) => (map[p.id] = p));
    setProducts(map);
    setMoves(data || []);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const c = cachedProducts();
    if (c) {
      const map = {};
      c.forEach((p) => (map[p.id] = p));
      setProducts(map);
    }
    load();
  }, [ready, load]);

  // Regroupe par jour : Aujourd'hui, Hier, puis les autres jours
  const days = useMemo(() => {
    if (!moves) return [];
    const todayK = dayKey(new Date());
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const yesterdayK = dayKey(y);
    const groups = [];
    const byKey = {};
    moves.forEach((m) => {
      const k = dayKey(m.created_at);
      if (!byKey[k]) {
        byKey[k] = {
          key: k,
          label: k === todayK ? t("today") : k === yesterdayK ? t("yesterday") : dayLabel(m.created_at, lang),
          items: [],
          pieces: 0,
          amount: 0,
        };
        groups.push(byKey[k]);
      }
      const g = byKey[k];
      g.items.push(m);
      g.pieces += m.quantity;
      g.amount += amountOf(m, products[m.product_id]);
    });
    return groups;
  }, [moves, products, t, lang]);

  // + / − : ajoute ou retire 1 (1 pièce, ou 1 carton si la vente était en carton)
  async function change(m, dir) {
    setError("");
    const p = products[m.product_id];
    const step = m.unit === "pack" ? packSize(p) : 1;
    const next = m.quantity + dir * step;
    if (next <= 0) return remove(m);
    if (dir > 0 && p && stockOf(p) < step) {
      setError(`${t("not_enough")} ${stockOf(p)} ${t("pieces")}`);
      return;
    }
    setBusy(m.id);
    const { error: err } = await supabase.from("movements").update({ quantity: next }).eq("id", m.id);
    setBusy(null);
    if (err) return setError(t("error_generic"));
    setMoves((old) => old.map((x) => (x.id === m.id ? { ...x, quantity: next } : x)));
    if (p) setProducts((old) => ({ ...old, [p.id]: { ...p, total_out: (Number(p.total_out) || 0) + dir * step } }));
    fetchProducts().catch(() => {});
  }

  async function remove(m) {
    if (!window.confirm(t("confirm_delete_sale"))) return;
    setBusy(m.id);
    const { error: err } = await supabase.from("movements").delete().eq("id", m.id);
    setBusy(null);
    if (err) return setError(t("error_generic"));
    setMoves((old) => old.filter((x) => x.id !== m.id));
    const p = products[m.product_id];
    if (p) setProducts((old) => ({ ...old, [p.id]: { ...p, total_out: (Number(p.total_out) || 0) - m.quantity } }));
    fetchProducts().catch(() => {});
  }

  if (!ready) return <div className="center-screen">…</div>;

  return (
    <Shell title={t("journal_title")} backHref="/mouvement/vente">
      <Link href="/mouvement/vente" className="btn red">
        <Icon name="cart" size={26} /> {t("add_sale")}
      </Link>

      {error && (
        <div className="error" style={{ marginTop: 12 }}>
          {error}
        </div>
      )}

      {moves === null ? (
        <p className="muted">{t("loading")}</p>
      ) : days.length === 0 ? (
        <div className="empty">
          <Icon name="list" size={72} />
          <p>{t("no_sales")}</p>
          <small>{t("tap_plus_hint")}</small>
        </div>
      ) : (
        days.map((g) => (
          <section key={g.key} className="day">
            <header className="day-head">
              <span className="day-name">{g.label}</span>
              <span className="day-sum">
                <span>
                  <Icon name="cart" size={16} /> {fmt(g.pieces)}
                </span>
                {g.amount > 0 && <b>{fcfa(g.amount)}</b>}
              </span>
            </header>
            <ul className="sales">
              {g.items.map((m) => {
                const p = products[m.product_id];
                const isPack = m.unit === "pack" && p && packSize(p) > 1;
                const shown = isPack ? Math.round(m.quantity / packSize(p)) : m.quantity;
                const amount = amountOf(m, p);
                return (
                  <li key={m.id} className={busy === m.id ? "busy" : ""}>
                    <div className="s-img">{p ? <ProductImage p={p} /> : <Icon name="box" size={28} />}</div>
                    <div className="s-mid">
                      <div className="s-name">{p ? p.name : "—"}</div>
                      <div className="s-meta">
                        <span>
                          <Icon name="clock" size={15} /> {timeOf(m.created_at)}
                        </span>
                        {amount > 0 && <b>{fcfa(amount)}</b>}
                      </div>
                    </div>
                    <div className="s-qty">
                      <button type="button" onClick={() => change(m, -1)} disabled={busy === m.id} aria-label="-1">
                        <Icon name="minus" size={22} stroke={3} />
                      </button>
                      <span className="s-n">
                        <b>{shown}</b>
                        <small>{isPack ? t("packs") : t("pieces")}</small>
                      </span>
                      <button type="button" onClick={() => change(m, 1)} disabled={busy === m.id} aria-label="+1">
                        <Icon name="plus" size={22} stroke={3} />
                      </button>
                    </div>
                    <button type="button" className="s-del" onClick={() => remove(m)} disabled={busy === m.id} aria-label={t("delete")}>
                      <Icon name="trash" size={20} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </Shell>
  );
}
