"use client";
import { memo, useState } from "react";
import Link from "next/link";
import Icon from "./Icons";
import { useLang } from "./Providers";
import { ProductCarton } from "./CartonArt";
import { StockNumbers } from "./StockSummary";
import { fcfa, hasPrices, isLow, moneyOf, stockOf } from "../lib/products";

// Photo du produit en grand ; carton dessiné s'il n'y a pas de photo (ou si elle ne charge pas)
export function ProductImage({ p }) {
  const [broken, setBroken] = useState(false);
  if (!p.photo_url || broken) return <ProductCarton seed={p.id || p.product_id || p.name} />;
  return <img src={p.photo_url} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} />;
}

// Vente rapide : une case pour le nombre vendu (vide = 1) + le chariot rouge qui enregistre tout de suite
function QuickSell({ p, left, onQuick }) {
  const [n, setN] = useState("");
  const qty = Math.max(1, parseInt(n, 10) || 1);
  const tooMuch = qty > left;
  return (
    <div className="pquick">
      <input
        className={"quick-n" + (tooMuch && n ? " bad" : "")}
        inputMode="numeric"
        placeholder="1"
        value={n}
        onChange={(e) => setN(e.target.value.replace(/\D/g, "").slice(0, 5))}
        aria-label="Nombre vendu"
      />
      <button
        type="button"
        className="quick-plus"
        disabled={left <= 0 || tooMuch}
        onClick={() => {
          onQuick(p, qty);
          setN("");
        }}
      >
        <Icon name="cart" size={30} /> +{n ? qty : ""}
      </button>
    </div>
  );
}

// Carte produit en grand : photo, nom, « Ce qui est vendu » / « Ce qui reste », bénéfice.
// onQuick : vente rapide (+1) sans passer par l'écran de quantité ; today = vendu aujourd'hui
function ProductCard({ p, href, onClick, onDelete, onQuick, today = 0, selected, showMoney = true }) {
  const { t } = useLang();
  const [busy, setBusy] = useState(false);
  const left = stockOf(p);
  const money = showMoney && hasPrices(p) ? moneyOf(p) : null;

  const body = (
    <>
      <div className="pimg">
        <ProductImage p={p} />
        {left <= 0 && <span className="ptag zero">{t("out_of_stock")}</span>}
        {isLow(p) && (
          <span className="ptag low">
            <Icon name="alert" size={16} /> {t("low_stock")}
          </span>
        )}
        {onQuick && today > 0 && (
          <span className="ptoday">
            {t("sold_today")} <b>{today}</b>
          </span>
        )}
      </div>
      <div className="pbody">
        <div className="pname">{p.name}</div>
        <StockNumbers p={p} compact />
        {money && (
          <div className={"pmoney" + (money.profit < 0 ? " neg" : "")}>
            <span>
              <Icon name="trend" size={18} /> {money.profit < 0 ? t("loss") : t("profit")}
            </span>
            <b>{fcfa(Math.abs(money.profit))}</b>
          </div>
        )}
      </div>
    </>
  );

  async function del() {
    if (!window.confirm(t("confirm_delete_card"))) return;
    setBusy(true);
    try {
      await onDelete(p);
    } catch {
      setBusy(false);
      window.alert(t("error_generic"));
    }
  }

  const cls = "pcard" + (selected ? " sel" : "") + (left <= 0 ? " empty-stock" : "") + (busy ? " busy" : "");
  return (
    <div className={cls}>
      {href ? (
        <Link href={href} className="pmain" prefetch={false}>
          {body}
        </Link>
      ) : (
        <button type="button" className="pmain" onClick={() => onClick && onClick(p)} disabled={!onClick}>
          {body}
        </button>
      )}
      {onQuick && <QuickSell p={p} left={left} onQuick={onQuick} />}
      {onDelete && (
        <button type="button" className="pdel" onClick={del} disabled={busy} aria-label={t("delete")}>
          <Icon name="trash" size={22} />
        </button>
      )}
    </div>
  );
}

// memo : une carte n'est redessinée que si son produit change (fluide même avec 150 produits)
export default memo(ProductCard);
