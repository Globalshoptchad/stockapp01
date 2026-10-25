"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Shell from "../../../components/Shell";
import Icon from "../../../components/Icons";
import ProductForm from "../../../components/ProductForm";
import { MoneyNumbers, StockNumbers } from "../../../components/StockSummary";
import { fetchProducts, packSize } from "../../../lib/products";
import { useLang } from "../../../components/Providers";
import { useRequireAuth } from "../../../lib/useRequireAuth";
import { supabase } from "../../../lib/supabaseClient";
import { formatDate } from "../../../lib/helpers";

export default function ProductPage() {
  const { t, lang } = useLang();
  const router = useRouter();
  const params = useParams();
  const id = params && params.id;
  const { ready } = useRequireAuth();
  const [product, setProduct] = useState(null);
  const [moves, setMoves] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [{ data: p }, { data: m }] = await Promise.all([
      supabase.from("product_stock").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("movements")
        .select("*")
        .eq("product_id", id)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    setProduct(p || null);
    setMoves(m || []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    if (ready && id) load();
  }, [ready, id, load]);

  async function removeMove(mid) {
    if (!window.confirm(t("confirm_delete_movement"))) return;
    await supabase.from("movements").delete().eq("id", mid);
    load();
    fetchProducts().catch(() => {});
  }

  if (!ready || loading) return <div className="center-screen">…</div>;
  if (!product) {
    router.replace("/catalogue");
    return null;
  }

  return (
    <Shell title={product.name || t("edit_product")} backHref="/catalogue" nav={false}>
      <StockNumbers p={product} />
      <MoneyNumbers p={product} />

      <ProductForm
        initial={product}
        onSaved={() => {
          load();
          fetchProducts().catch(() => {});
        }}
        onDeleted={() => router.replace("/catalogue")}
      />

      <h2 className="section">{t("history")}</h2>
      {moves.length === 0 ? (
        <p className="muted">{t("no_history")}</p>
      ) : (
        <ul className="history">
          {moves.map((m) => (
            <li key={m.id} className={m.type === "in" ? "in" : "out"}>
              <span className="mi">
                <Icon name={m.type === "in" ? "plus" : "minus"} size={20} stroke={3} />
              </span>
              <span className="mq">
                {m.unit === "pack" && packSize(product) > 1 ? (
                  <>
                    {Math.round(m.quantity / packSize(product))} <small>{t("packs")}</small>
                  </>
                ) : (
                  <>
                    {m.quantity} <small>{t("pieces")}</small>
                  </>
                )}
              </span>
              <span className="md">{formatDate(m.created_at, lang)}</span>
              <button className="icon-btn" onClick={() => removeMove(m.id)} aria-label={t("delete")}>
                <Icon name="trash" size={20} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}
