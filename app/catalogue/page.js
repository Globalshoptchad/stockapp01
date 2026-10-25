"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Shell from "../../components/Shell";
import Icon from "../../components/Icons";
import ProductCard from "../../components/ProductCard";
import BarcodeScanner from "../../components/BarcodeScanner";
import { useLang } from "../../components/Providers";
import { useRequireAuth } from "../../lib/useRequireAuth";
import { cachedProducts, deleteProduct, fetchProducts, filterProducts } from "../../lib/products";

export default function CataloguePage() {
  const { t } = useLang();
  const router = useRouter();
  const { ready } = useRequireAuth();
  const [products, setProducts] = useState(null);
  const [q, setQ] = useState("");
  const [scan, setScan] = useState(false);
  const [notFound, setNotFound] = useState("");

  useEffect(() => {
    if (!ready) return;
    const c = cachedProducts();
    if (c) setProducts(c);
    fetchProducts()
      .then(setProducts)
      .catch(() => setProducts((old) => old || []));
  }, [ready]);

  // Supprime le produit + sa photo (l'espace est libéré) et l'enlève de la liste tout de suite
  const onDelete = useCallback(async (p) => {
    await deleteProduct(p);
    setProducts((old) => (old || []).filter((x) => x.id !== p.id));
  }, []);

  const list = products || [];
  const filtered = useMemo(() => filterProducts(list, q), [list, q]);

  function onScanned(code) {
    setScan(false);
    const found = list.find((p) => p.barcode === code);
    if (found) router.push(`/produit/${found.id}`);
    else setNotFound(code);
  }

  if (!ready) return <div className="center-screen">…</div>;

  return (
    <Shell title={t("products")}>
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

      {notFound && (
        <div className="notice">
          <div>{t("unknown_barcode")}</div>
          <Link className="btn green small" href={`/produit/nouveau?barcode=${encodeURIComponent(notFound)}`}>
            <Icon name="plus" size={20} /> {t("add_with_barcode")}
          </Link>
        </div>
      )}

      {products === null ? (
        <div className="plist">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="pcard skeleton" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="empty">
          <Icon name="box" size={72} />
          <p>{t("empty_catalogue")}</p>
          <small>{t("empty_catalogue_hint")}</small>
        </div>
      ) : (
        <>
          <p className="count">
            <Icon name="box" size={18} /> {filtered.length}
          </p>
          <div className="plist">
            {filtered.map((p) => (
              <ProductCard key={p.id} p={p} href={`/produit/${p.id}`} onDelete={onDelete} />
            ))}
          </div>
        </>
      )}

      <Link href="/produit/nouveau" className="fab" aria-label={t("add_product")}>
        <Icon name="plus" size={34} stroke={3} />
      </Link>

      {scan && <BarcodeScanner onClose={() => setScan(false)} onDetected={onScanned} />}
    </Shell>
  );
}
