"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Shell from "../../components/Shell";
import Icon from "../../components/Icons";
import { ProductImage } from "../../components/ProductCard";
import { StockNumbers } from "../../components/StockSummary";
import { useLang } from "../../components/Providers";
import { useRequireAuth } from "../../lib/useRequireAuth";
import { supabase } from "../../lib/supabaseClient";
import { fcfa, fmt, hasPrices, isLow } from "../../lib/products";

const periods = [
  { key: "today", label: "today", days: 0 },
  { key: "d7", label: "days7", days: 7 },
  { key: "d30", label: "days30", days: 30 },
  { key: "all", label: "all_time", days: null },
];

function sinceFor(days) {
  if (days === null) return "1970-01-01T00:00:00Z";
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

const N = (v) => Number(v) || 0;

export default function BilanPage() {
  const { t } = useLang();
  const { ready } = useRequireAuth();
  const [period, setPeriod] = useState("d7");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    const p = periods.find((x) => x.key === period);
    setLoading(true);
    supabase.rpc("period_report", { since: sinceFor(p.days) }).then(({ data }) => {
      setRows(data || []);
      setLoading(false);
    });
  }, [ready, period]);

  const a = useMemo(() => {
    // Chaque ligne prend la forme attendue par <StockNumbers> : vendu sur la période + reste actuel
    const items = rows.map((r) => {
      const profit = N(r.revenue) - N(r.cost_sold);
      return {
        ...r,
        id: r.product_id,
        ever_in: N(r.total_in), // tout ce qui est entré depuis le début
        total_out: N(r.sold),
        total_in: N(r.sold) + N(r.stock),
        profit,
        priced: hasPrices(r),
      };
    });
    const sum = (k) => items.reduce((s, r) => s + N(r[k]), 0);
    const revenue = sum("revenue");
    const profit = items.reduce((s, r) => s + r.profit, 0);
    return {
      items,
      revenue,
      profit,
      margin: revenue > 0 ? Math.round((profit / revenue) * 100) : 0,
      sold: sum("sold"),
      entered: sum("entered"),
      stock: items.reduce((s, r) => s + Math.max(0, N(r.stock)), 0),
      stockValue: items.reduce((s, r) => s + Math.max(0, N(r.stock_value)), 0),
      // Classement : ceux qui rapportent le plus d'argent d'abord, puis les plus vendus
      ranked: items
        .filter((r) => r.sold > 0)
        .sort((x, y) => y.profit - x.profit || y.sold - x.sold),
      finished: items.filter((r) => N(r.stock) <= 0 && r.ever_in > 0),
      low: items.filter((r) => isLow(r, r.ever_in)),
      sleeping: items.filter((r) => r.sold === 0 && N(r.stock) > 0),
      noPrice: items.filter((r) => !r.priced),
    };
  }, [rows]);

  if (!ready) return <div className="center-screen">…</div>;

  const maxProfit = Math.max(1, ...a.ranked.map((r) => Math.abs(r.profit) || r.sold));

  return (
    <Shell title={t("report")}>
      <div className="chips">
        {periods.map((p) => (
          <button key={p.key} className={"chip" + (period === p.key ? " on" : "")} onClick={() => setPeriod(p.key)}>
            {t(p.label)}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="muted">{t("loading")}</p>
      ) : (
        <>
          {/* Les gros chiffres d'argent */}
          <div className="big-money">
            <div className="bm revenue">
              <span className="sn-title">
                <Icon name="coins" size={20} /> {t("revenue")}
              </span>
              <b>{fcfa(a.revenue)}</b>
            </div>
            <div className={"bm profit" + (a.profit < 0 ? " neg" : "")}>
              <span className="sn-title">
                <Icon name="trend" size={20} /> {a.profit < 0 ? t("loss") : t("profit")}
              </span>
              <b>{fcfa(Math.abs(a.profit))}</b>
              {a.revenue > 0 && <small className="num">{a.margin}{"\u00a0"}%</small>}
            </div>
          </div>

          <div className="summary">
            <div className="sum red">
              <small>{t("what_sold")}</small>
              <b>{fmt(a.sold)}</b>
            </div>
            <div className="sum green">
              <small>{t("what_entered")}</small>
              <b>{fmt(a.entered)}</b>
            </div>
            <div className="sum">
              <small>{t("what_remains")}</small>
              <b>{fmt(a.stock)}</b>
            </div>
          </div>
          <div className="stock-value-line">
            <Icon name="box" size={20} /> {t("stock_value")} : <b>{fcfa(a.stockValue)}</b>
          </div>

          {a.noPrice.length > 0 && (
            <p className="notice small">
              <Icon name="coins" size={20} /> {t("add_price")} ({a.noPrice.length})
            </p>
          )}

          {/* Alertes */}
          {(a.finished.length > 0 || a.low.length > 0) && (
            <>
              <h2 className="section">
                <Icon name="alert" size={22} /> {t("to_restock")}
              </h2>
              <div className="alert-strip">
                {[...a.finished, ...a.low].map((r) => (
                  <Link key={r.id} href={`/produit/${r.id}`} className={"alert-item" + (N(r.stock) <= 0 ? " zero" : " low")}>
                    <div className="ai-img">
                      <ProductImage p={r} />
                    </div>
                    <span className="ai-name">{r.name}</span>
                    <b>{N(r.stock) <= 0 ? t("out_of_stock") : `${t("remaining")} ${fmt(r.stock)}`}</b>
                  </Link>
                ))}
              </div>
            </>
          )}

          {/* Détail de chaque produit vendu */}
          <h2 className="section">
            <Icon name="chart" size={22} /> {t("per_product")}
          </h2>
          {a.ranked.length === 0 ? (
            <p className="muted">{t("nothing_sold")}</p>
          ) : (
            <ul className="analysis">
              {a.ranked.map((r, i) => (
                <li key={r.id}>
                  <Link href={`/produit/${r.id}`} className="an-row">
                    <span className="an-rank">{i + 1}</span>
                    <div className="an-img">
                      <ProductImage p={r} />
                    </div>
                    <div className="an-mid">
                      <div className="an-name">{r.name}</div>
                      <StockNumbers p={r} compact everIn={r.ever_in} />
                      {r.priced ? (
                        <div className="an-money">
                          <span>
                            <small>{t("revenue")}</small> {fcfa(r.revenue)}
                          </span>
                          <span className={"an-profit" + (r.profit < 0 ? " neg" : "")}>
                            <small>{r.profit < 0 ? t("loss") : t("profit")}</small> {fcfa(Math.abs(r.profit))}
                          </span>
                        </div>
                      ) : (
                        <small className="hint">{t("add_price")}</small>
                      )}
                      <div className="bar">
                        <span
                          className={r.profit < 0 ? "neg" : ""}
                          style={{ width: `${Math.max(6, ((Math.abs(r.profit) || r.sold) / maxProfit) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {a.sleeping.length > 0 && (
            <>
              <h2 className="section">
                <Icon name="box" size={22} /> {t("not_sold_yet")}
              </h2>
              <div className="alert-strip">
                {a.sleeping.map((r) => (
                  <Link key={r.id} href={`/produit/${r.id}`} className="alert-item">
                    <div className="ai-img">
                      <ProductImage p={r} />
                    </div>
                    <span className="ai-name">{r.name}</span>
                    <b>
                      {t("remaining")} {fmt(r.stock)}
                    </b>
                  </Link>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </Shell>
  );
}
