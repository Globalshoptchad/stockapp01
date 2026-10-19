"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Icon from "../../components/Icons";
import LangToggle from "../../components/LangToggle";
import { useLang } from "../../components/Providers";
import { supabase } from "../../lib/supabaseClient";
import { cleanPhone, phoneToEmail, pinToPassword } from "../../lib/helpers";

export default function SignupPage() {
  const { t } = useLang();
  const router = useRouter();
  const [shop, setShop] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (cleanPhone(phone).length < 6) return setError(t("invalid_phone"));
    if (!/^\d{4}$/.test(pin)) return setError(t("invalid_pin"));
    if (pin !== pin2) return setError(t("pins_differ"));
    setLoading(true);
    const { data, error: err } = await supabase.auth.signUp({
      email: phoneToEmail(phone),
      password: pinToPassword(pin),
      options: { data: { shop_name: shop.trim(), phone: cleanPhone(phone) } },
    });
    if (err) {
      setError(/registered|exists/i.test(err.message) ? t("phone_used") : t("error_generic"));
      setLoading(false);
      return;
    }
    if (!data.session) {
      // La confirmation e-mail est encore active dans Supabase : on tente quand même la connexion
      const { error: e2 } = await supabase.auth.signInWithPassword({
        email: phoneToEmail(phone),
        password: pinToPassword(pin),
      });
      if (e2) {
        setError(t("error_generic"));
        setLoading(false);
        return;
      }
    }
    router.replace("/catalogue");
  }

  return (
    <div className="auth">
      <div className="auth-lang">
        <LangToggle />
      </div>
      <div className="logo">
        <Icon name="box" size={56} />
      </div>
      <h1 className="auth-title">{t("app_name")}</h1>
      <form onSubmit={submit}>
        {error && <div className="error">{error}</div>}
        <div className="field">
          <label>{t("shop_name")}</label>
          <input className="input" value={shop} onChange={(e) => setShop(e.target.value)} maxLength={60} />
        </div>
        <div className="field">
          <label>{t("phone")}</label>
          <input
            className="input"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
          />
          <small className="hint">{t("phone_hint")}</small>
        </div>
        <div className="field">
          <label>{t("pin")}</label>
          <input
            className="input pin"
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            autoComplete="new-password"
          />
        </div>
        <div className="field">
          <label>{t("pin_confirm")}</label>
          <input
            className="input pin"
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pin2}
            onChange={(e) => setPin2(e.target.value.replace(/\D/g, ""))}
            autoComplete="new-password"
          />
        </div>
        <button className="btn green" disabled={loading}>
          <Icon name="check" size={24} /> {loading ? t("loading") : t("signup")}
        </button>
      </form>
      <p className="auth-switch">
        {t("have_account")} <Link href="/login">{t("login")}</Link>
      </p>
    </div>
  );
}
