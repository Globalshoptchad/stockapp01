"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Shell from "../../../components/Shell";
import Icon from "../../../components/Icons";
import ProductCard from "../../../components/ProductCard";
import BarcodeScanner from "../../../components/BarcodeScanner";
import { useLang } from "../../../components/Providers";
import { useRequireAuth } from "../../../lib/useRequireAuth";
import { supabase } from "../../../lib/supabaseClient";

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

  async function load() {
    const { data } = await supabase.from("product_stock").select("*").order("name");
    setProducts(data || []);
    setLoading(false);
  }

  useEffect(() => {
    if (ready) load();
  }, [ready]);

  function stockOf(p) {
    return (p.total_in || 0) - (p.total_out || 0);
  }

  function pick(p) {
    setSelected(p);
    setQty(1);
    setError("");
  }

  function onScanned(code) {
    setScan(false);
    const found = products.find((p) => p.barcode === code);
    if (found) pick(found);
    else setError(t("unknown_barcode"));
  }

  async function confirm() {
    setError("");
    const n = parseInt(qty, 10);
    if (!n || n < 1) return;
    if (isSale && n > stockOf(selected)) {
      setError(`${t("not_enough")} ${stockOf(selected)}`);
      return;
    }
    setSaving(true);
    const { error: err } = await supabase
      .from("movements")
      .insert({ product_id: selected.id, type: isSale ? "out" : "in", quantity: n });
    setSaving(false);
    if (err) {
      setError(t("error_generic"));
      return;
    }
    setDone({ name: selected.name, qty: n });
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
            {done.qty} × {done.name}
          </p>
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
          <ProductCard p={selected} onClick={() => {}} />
        </div>
        {error && <div className="error">{error}</div>}
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
      <div className="row">
        <p className="choose">{t("choose_product")}</p>
        <button className="icon-btn big" onClick={() => setScan(true)} aria-label={t("scan")}>
          <Icon name="scan" size={26} />
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
        <div className="grid">
          {products.map((p) => (
            <ProductCard key={p.id} p={p} onClick={() => pick(p)} />
          ))}
        </div>
      )}
      {scan && <BarcodeScanner onClose={() => setScan(false)} onDetected={onScanned} />}
    </Shell>
  );
}
