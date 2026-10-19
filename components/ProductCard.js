"use client";
import Link from "next/link";
import Icon from "./Icons";
import { useLang } from "./Providers";

// Carte produit : grande photo, nom, et le stock restant bien visible.
export default function ProductCard({ p, href, onClick, selected }) {
  const { t } = useLang();
  const stock = (p.total_in || 0) - (p.total_out || 0);

  const inner = (
    <>
      <div className="pimg">
        {p.photo_url ? <img src={p.photo_url} alt={p.name} loading="lazy" /> : <Icon name="box" size={44} />}
      </div>
      <div className="pname">{p.name}</div>
      <div className={"pstock" + (stock <= 0 ? " zero" : "")}>
        {stock <= 0 ? (
          t("out_of_stock")
        ) : (
          <>
            <small>{t("remaining")}</small> {stock}
          </>
        )}
      </div>
    </>
  );

  const cls = "pcard" + (selected ? " sel" : "");
  if (href) {
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} onClick={onClick}>
      {inner}
    </button>
  );
}
