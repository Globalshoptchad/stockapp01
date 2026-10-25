"use client";
import { useEffect, useState } from "react";
import Shell from "../../components/Shell";
import { ProductImage } from "../../components/ProductCard";
import { useLang } from "../../components/Providers";
import { useRequireAuth } from "../../lib/useRequireAuth";
import { supabase } from "../../lib/supabaseClient";

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

  if (!ready) return <div className="center-screen">…</div>;

  const totalSold = rows.reduce((s, r) => s + Number(r.sold || 0), 0);
  const totalIn = rows.reduce((s, r) => s + Number(r.entered || 0), 0);
  const totalStock = rows.reduce((s, r) => s + Number(r.stock || 0), 0);
  const best = rows
    .filter((r) => Number(r.sold) > 0)
    .sort((a, b) => Number(b.sold) - Number(a.sold))
    .slice(0, 10);
  const maxSold = best.length ? Number(best[0].sold) : 1;
  const empty = rows.filter((r) => Number(r.stock) <= 0);

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
          <div className="summary">
            <div className="sum red">
              <small>{t("total_sold")}</small>
              <b>{totalSold}</b>
            </div>
            <div className="sum green">
              <small>{t("total_entered")}</small>
              <b>{totalIn}</b>
            </div>
            <div className="sum">
              <small>{t("total_stock")}</small>
              <b>{totalStock}</b>
            </div>
          </div>

          <h2 className="section">{t("best_sellers")}</h2>
          {best.length === 0 ? (
            <p className="muted">{t("nothing_sold")}</p>
          ) : (
            <ul className="bars">
              {best.map((r) => (
                <li key={r.product_id}>
                  <div className="bimg">
                    <ProductImage p={r} />
                  </div>
                  <div className="bmid">
                    <div className="bname">{r.name}</div>
                    <div className="bar">
                      <span style={{ width: `${Math.max(6, (Number(r.sold) / maxSold) * 100)}%` }} />
                    </div>
                  </div>
                  <b className="bval">{r.sold}</b>
                </li>
              ))}
            </ul>
          )}

          {empty.length > 0 && (
            <>
              <h2 className="section">{t("to_restock")}</h2>
              <div className="grid small">
                {empty.map((r) => (
                  <div key={r.product_id} className="pcard static">
                    <div className="pimg">
                      <ProductImage p={r} />
                    </div>
                    <div className="pname">{r.name}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </Shell>
  );
}
