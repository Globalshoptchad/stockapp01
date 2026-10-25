"use client";
import { memo, useState } from "react";
import Link from "next/link";
import { useLang } from "./Providers";
import { ProductCarton } from "./CartonArt";
import { thumbUrl } from "../lib/products";

// Image du produit : miniature d'abord, grande photo si la miniature n'existe pas, carton dessiné sinon.
export function ProductImage({ p, full = false }) {
  const [step, setStep] = useState(0); // 0 = miniature, 1 = grande photo, 2 = carton
  if (!p.photo_url || step === 2) return <ProductCarton seed={p.id || p.product_id || p.name} />;
  const src = step === 0 && !full ? thumbUrl(p.photo_url) : p.photo_url;
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setStep((s) => (s === 0 && !full ? 1 : 2))}
    />
  );
}

// Carte produit : grande image, nom, et le stock restant bien visible (vert = il en reste, rouge = fini).
function ProductCard({ p, href, onClick, selected }) {
  const { t } = useLang();
  const stock = (p.total_in || 0) - (p.total_out || 0);
  const low = stock > 0 && stock <= 3;

  const inner = (
    <>
      <div className="pimg">
        <ProductImage p={p} />
        <span className={"pbadge" + (stock <= 0 ? " zero" : low ? " low" : "")}>{stock <= 0 ? 0 : stock}</span>
      </div>
      <div className="pname">{p.name}</div>
      <div className={"pstock" + (stock <= 0 ? " zero" : "")}>
        {stock <= 0 ? t("out_of_stock") : ""}
      </div>
    </>
  );

  const cls = "pcard" + (selected ? " sel" : "") + (stock <= 0 ? " empty-stock" : "");
  if (href) {
    return (
      <Link href={href} className={cls} prefetch={false}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} onClick={() => onClick && onClick(p)}>
      {inner}
    </button>
  );
}

// memo : une carte n'est redessinée que si son produit change (fluide même avec 150 produits)
export default memo(ProductCard);
