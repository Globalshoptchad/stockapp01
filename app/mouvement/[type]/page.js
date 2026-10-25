"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Shell from "../../../components/Shell";
import Icon from "../../../components/Icons";
import ProductCard from "../../../components/ProductCard";
import BarcodeScanner from "../../../components/BarcodeScanner";
import { useLang } from "../../../components/Providers";
import { useRequireAuth } from "../../../lib/useRequireAuth";
import { supabase } from "../../../lib/supabaseClient";
import { cachedProducts, fcfa, fetchProducts, filterProducts, packSize, piecePrice, stockOf } from "../../../lib/products";

// Une seule page pour les deux gestes : "entree" (marchandise reçue) et "vente" (produit vendu)
export default function MovementPage() {
  const { t } = useLang();
  const params = useParams();
  const isSale = params && params.type === "vente";
  const { ready } = useRequireAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [qty, setQty] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);
  const [scan, setScan] = useState(false);
  const [q, setQ] = useState("");
  const [unit, setUnit] = useState("piece"); // "pack" = carton, "piece" = pièce

  async function load() {
    try {
      setProducts(await fetchProducts());
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    if (!ready) return;
    const c = cachedProducts();
    if (c) {
      setProducts(c);
      setLoading(false);
    }
    load();
  }, [ready]);

  const filtered = useMemo(() => filterProducts(products, q), [products, q]);

  const pick = useCallback((p) => {
    setSelected(p);
    setQty(1);
    // Marchandise reçue : en carton par défaut. Vente : à la pièce par défaut.
    setUnit(packSize(p) > 1 && !isSale ? "pack" : "piece");
    setError("");
    setQ("");
    window.scrollTo(0, 0);
  }, [isSale]);

  function onScanned(code) {
    setScan(false);
    const found = products.find((p) => p.barcode === code);
    if (found) pick(found);
    else setError(t("unknown_barcode"));
  }

  // Quantité en pièces (1 carton = pack_size pièces)
  const size = selected ? packSize(selected) : 1;
  const mult = unit === "pack" ? size : 1;
  const nQty = parseInt(qty, 10) || 0;
  const pieces = nQty * mult;
  const unitPrice = selected ? (unit === "pack" ? Number(selected.sell_price) || 0 : piecePrice(selected)) : 0;

  async function confirm() {
    setError("");
    if (!nQty || nQty < 1) return;
    const left = stockOf(selected);
    if (isSale && pieces > left) {
      setError(`${t("not_enough")} ${left} ${t("pieces")}`);
      return;
    }
    setSaving(true);
    const { error: err } = await supabase
      .from("movements")
      .insert({ product_id: selected.id, type: isSale ? "out" : "in", quantity: pieces, unit });
    setSaving(false);
    if (err) {
      setError(t("error_generic"));
      return;
    }
    setDone({ name: selected.name, qty: nQty, unit: size > 1 ? unit : "piece", amount: isSale ? nQty * unitPrice : 0 });
    setSelected(null);
    load();
  }

  if (!ready) return <div className="center-screen">…</div>;

  const title = isSale ? t("sale_long") : t("entry_long");
  const tone = isSale ? "red" : "green";

  if (done) {
    return (
      <Shell title={title}>
        <div className="done">
          <div className={"done-icon " + tone}>
            <Icon name="check" size={64} stroke={3} />
          </div>
          <p className="done-text">
            {done.qty} {done.unit === "pack" ? t("packs") : t("pieces")} × {done.name}
          </p>
          {done.amount > 0 && <p className="done-amount">{fcfa(done.amount)}</p>}
          <button className={"btn " + tone} onClick={() => setDone(null)}>
            <Icon name="plus" size={24} /> {t("again")}
          </button>
        </div>
      </Shell>
    );
  }

  if (selected) {
    return (
      <Shell title={title}>
        <div className="picked">
          <ProductCard p={selected} showMoney={false} />
        </div>
        {error && <div className="error">{error}</div>}
        {size > 1 && (
          <div className="unit-toggle">
            <button type="button" className={unit === "pack" ? "on" : ""} onClick={() => setUnit("pack")}>
              <Icon name="box" size={34} />
              <span>{t("in_packs")}</span>
              <small>
                {size} {t("pieces")}
              </small>
            </button>
            <button type="button" className={unit === "piece" ? "on" : ""} onClick={() => setUnit("piece")}>
              <Icon name="piece" size={34} />
              <span>{t("in_pieces")}</span>
              <small>1</small>
            </button>
          </div>
        )}
        <label className="qty-label">{t("quantity")}</label>
        <div className="qty">
          <button type="button" className="qty-btn" onClick={() => setQty(Math.max(1, (parseInt(qty, 10) || 1) - 1))}>
            <Icon name="minus" size={36} stroke={3} />
          </button>
          <input
            className="qty-input"
            type="number"
            inputMode="numeric"
            min="1"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
          <button type="button" className="qty-btn" onClick={() => setQty((parseInt(qty, 10) || 0) + 1)}>
            <Icon name="plus" size={36} stroke={3} />
          </button>
        </div>
        <div className="quick-qty">
          {[5, 10, 20, 50].map((n) => (
            <button key={n} type="button" className={"chip" + (Number(qty) === n ? " on" : "")} onClick={() => setQty(n)}>
              {n}
            </button>
          ))}
        </div>
        {(mult > 1 || (isSale && unitPrice > 0)) && nQty > 0 && (
          <div className="qty-total">
            {mult > 1 && (
              <span>
                = {pieces} {t("pieces")}
              </span>
            )}
            {isSale && unitPrice > 0 && <b>{fcfa(nQty * unitPrice)}</b>}
          </div>
        )}
        <button className={"btn " + tone} onClick={confirm} disabled={saving}>
          <Icon name="check" size={26} /> {saving ? t("loading") : t("confirm")}
        </button>
        <button className="btn ghost spaced" onClick={() => setSelected(null)}>
          <Icon name="x" size={22} /> {t("cancel")}
        </button>
      </Shell>
    );
  }

  return (
    <Shell title={title}>
      <p className="choose">
        <Icon name="hand" size={24} /> {t("choose_product")}
      </p>
      <div className="row sticky-tools">
        <div className="search">
          <Icon name="search" size={22} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} />
          {q && (
            <button type="button" className="clear-btn" onClick={() => setQ("")} aria-label={t("cancel")}>
              <Icon name="x" size={20} />
            </button>
          )}
        </div>
        <button className="icon-btn big" onClick={() => setScan(true)} aria-label={t("scan")}>
          <Icon name="scan" size={28} />
        </button>
      </div>
      {error && <div className="error">{error}</div>}
      {loading ? (
        <p className="muted">{t("loading")}</p>
      ) : products.length === 0 ? (
        <div className="empty">
          <Icon name="box" size={72} />
          <p>{t("empty_catalogue")}</p>
        </div>
      ) : (
        <div className="plist">
          {filtered.map((p) => (
            <ProductCard key={p.id} p={p} onClick={pick} showMoney={false} />
          ))}
        </div>
      )}
      {scan && <BarcodeScanner onClose={() => setScan(false)} onDetected={onScanned} />}
    </Shell>
  );
}
