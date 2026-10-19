"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Shell from "../../components/Shell";
import Icon from "../../components/Icons";
import ProductCard from "../../components/ProductCard";
import BarcodeScanner from "../../components/BarcodeScanner";
import { useLang } from "../../components/Providers";
import { useRequireAuth } from "../../lib/useRequireAuth";
import { supabase } from "../../lib/supabaseClient";

export default function CataloguePage() {
  const { t } = useLang();
  const router = useRouter();
  const { ready } = useRequireAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [scan, setScan] = useState(false);
  const [notFound, setNotFound] = useState("");

  useEffect(() => {
    if (!ready) return;
    supabase
      .from("product_stock")
      .select("*")
      .order("name")
      .then(({ data }) => {
        setProducts(data || []);
        setLoading(false);
      });
  }, [ready]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return products;
    return products.filter((p) => p.name.toLowerCase().includes(s) || (p.barcode || "").includes(s));
  }, [products, q]);

  function onScanned(code) {
    setScan(false);
    const found = products.find((p) => p.barcode === code);
    if (found) router.push(`/produit/${found.id}`);
    else setNotFound(code);
  }

  if (!ready) return <div className="center-screen">…</div>;

  return (
    <Shell title={t("products")}>
      <div className="row">
        <div className="search">
          <Icon name="search" size={20} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} />
        </div>
        <button className="icon-btn big" onClick={() => setScan(true)} aria-label={t("scan")}>
          <Icon name="scan" size={26} />
        </button>
      </div>

      {notFound && (
        <div className="notice">
          <div>{t("unknown_barcode")}</div>
          <Link className="btn green small" href={`/produit/nouveau?barcode=${encodeURIComponent(notFound)}`}>
            <Icon name="plus" size={20} /> {t("add_with_barcode")}
          </Link>
        </div>
      )}

      {loading ? (
        <p className="muted">{t("loading")}</p>
      ) : products.length === 0 ? (
        <div className="empty">
          <Icon name="box" size={72} />
          <p>{t("empty_catalogue")}</p>
          <small>{t("empty_catalogue_hint")}</small>
        </div>
      ) : (
        <div className="grid">
          {filtered.map((p) => (
            <ProductCard key={p.id} p={p} href={`/produit/${p.id}`} />
          ))}
        </div>
      )}

      <Link href="/produit/nouveau" className="fab" aria-label={t("add_product")}>
        <Icon name="plus" size={32} stroke={3} />
      </Link>

      {scan && <BarcodeScanner onClose={() => setScan(false)} onDetected={onScanned} />}
    </Shell>
  );
}
