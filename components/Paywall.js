"use client";
// Écran affiché quand l'essai ou l'abonnement est fini : comment payer et se faire débloquer.
import { useState } from "react";
import Icon from "./Icons";
import { useLang } from "./Providers";
import { supabase } from "../lib/supabaseClient";
import { loadStatus, whatsappLink } from "../lib/account";

function money(v) {
  const n = parseInt(String(v || "").replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? n.toLocaleString("fr-FR").replace(/ | /g, " ") : "";
}

export function PayInfo({ settings = {}, phone, shop }) {
  const { t } = useLang();
  const price = money(settings.price_month);
  const wa = whatsappLink(settings.whatsapp_number, `${t("wa_message")} ${phone || ""}${shop ? ` (${shop})` : ""}`);
  const ops = [
    { key: "airtel", label: "Airtel Money", number: settings.airtel_number, color: "#e11d2a" },
    { key: "moov", label: "Moov Money", number: settings.moov_number, color: "#0b5cad" },
  ];

  return (
    <div className="pay">
      {price && (
        <div className="pay-price">
          <b dir="ltr">{price} FCFA</b> <span>{t("sub_price")}</span>
        </div>
      )}

      <h3 className="pay-step">{t("pay_step1")}</h3>
      <div className="pay-ops">
        {ops.map((o) => (
          <div key={o.key} className="pay-op" style={{ borderColor: o.color }}>
            <span className="pay-op-name" style={{ background: o.color }}>{o.label}</span>
            {o.number ? (
              <a className="pay-op-num" dir="ltr" href={`tel:${String(o.number).replace(/[^\d+]/g, "")}`}>
                {o.number}
              </a>
            ) : (
              <span className="pay-op-soon">{t("number_soon")}</span>
            )}
          </div>
        ))}
      </div>

      <h3 className="pay-step">{t("pay_step2")}</h3>
      <div className="pay-me">
        <small>{t("your_number")}</small>
        <b dir="ltr">{phone}</b>
      </div>
      {wa && (
        <a className="btn green" href={wa} target="_blank" rel="noreferrer">
          <Icon name="chat" size={24} /> {t("i_paid")}
        </a>
      )}

      <h3 className="pay-step">{t("pay_step3")}</h3>
    </div>
  );
}

export default function Paywall({ status, user }) {
  const { t } = useLang();
  const [checking, setChecking] = useState(false);
  const phone = user && user.email ? user.email.split("@")[0] : "";
  const shop = user && user.user_metadata ? user.user_metadata.shop_name : "";
  const title = status.blocked ? t("account_blocked") : status.has_paid ? t("sub_over") : t("trial_over");

  async function check() {
    setChecking(true);
    await loadStatus(true);
    setChecking(false);
  }

  return (
    <div className="paywall">
      <div className="paywall-icon">
        <Icon name="lock" size={56} />
      </div>
      <h2>{title}</h2>
      <p className="paywall-safe">{t("data_safe")}</p>
      <PayInfo settings={status.settings || {}} phone={phone} shop={shop} />
      <button className="btn ghost spaced" onClick={check} disabled={checking}>
        <Icon name="refresh" size={22} /> {checking ? t("loading") : t("check_again")}
      </button>
    </div>
  );
}

// Récupère l'utilisateur connecté (pour afficher son numéro)
export async function currentUser() {
  const { data } = await supabase.auth.getSession();
  return data && data.session ? data.session.user : null;
}
