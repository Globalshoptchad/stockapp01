"use client";
import Icon from "./Icons";
import { useLang } from "./Providers";
import { fcfa, fmt, hasPrices, isLow, moneyOf, packSize, splitPacks, stockOf } from "../lib/products";

// "995" + "(20 cartons + 35 pièces)" quand le produit se vend en carton
export function Qty({ value, p }) {
  const { t } = useLang();
  const size = packSize(p);
  const { packs, pieces } = splitPacks(value, p);
  return (
    <>
      <b>{fmt(value)}</b>
      {size > 1 && value > 0 && (
        <span className="qty-split">
          {packs > 0 && (
            <>
              {packs} {t("packs")}
            </>
          )}
          {packs > 0 && pieces > 0 && " + "}
          {pieces > 0 && (
            <>
              {pieces} {t("pieces")}
            </>
          )}
        </span>
      )}
    </>
  );
}

// Les 3 chiffres principaux, chacun avec son titre et sa couleur
export function StockNumbers({ p, compact = false, everIn }) {
  const { t } = useLang();
  const left = stockOf(p);
  return (
    <div className={"stock-nums" + (compact ? " compact" : "")}>
      {!compact && (
        <div className="sn in">
          <span className="sn-title">
            <Icon name="download" size={18} /> {t("what_entered")}
          </span>
          <Qty value={Number(p.total_in) || 0} p={p} />
        </div>
      )}
      <div className="sn out">
        <span className="sn-title">
          <Icon name="cart" size={18} /> {t("what_sold")}
        </span>
        <Qty value={Number(p.total_out) || 0} p={p} />
      </div>
      <div className={"sn left" + (left <= 0 ? " zero" : isLow(p, everIn) ? " low" : "")}>
        <span className="sn-title">
          <Icon name="box" size={18} /> {t("what_remains")}
        </span>
        <Qty value={Math.max(0, left)} p={p} />
      </div>
    </div>
  );
}

// Argent : ventes, bénéfice, valeur du stock restant
export function MoneyNumbers({ p }) {
  const { t } = useLang();
  if (!hasPrices(p)) {
    return (
      <p className="notice small">
        <Icon name="coins" size={20} /> {t("add_price")}
      </p>
    );
  }
  const m = moneyOf(p);
  return (
    <div className="money-nums">
      <div className="mn">
        <span className="sn-title">
          <Icon name="coins" size={18} /> {t("revenue")}
        </span>
        <b>{fcfa(m.revenue)}</b>
      </div>
      <div className={"mn profit" + (m.profit < 0 ? " neg" : "")}>
        <span className="sn-title">
          <Icon name="trend" size={18} /> {m.profit < 0 ? t("loss") : t("profit")}
        </span>
        <b>{fcfa(Math.abs(m.profit))}</b>
      </div>
      <div className="mn">
        <span className="sn-title">
          <Icon name="box" size={18} /> {t("stock_value")}
        </span>
        <b>{fcfa(m.stockValue)}</b>
        <small>
          {t("if_all_sold")} : {fcfa(m.stockSaleValue)}
        </small>
      </div>
    </div>
  );
}
