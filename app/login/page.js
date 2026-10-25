"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Icon from "../../components/Icons";
import LangToggle from "../../components/LangToggle";
import { AppLogo } from "../../components/CartonArt";
import { clearProductsCache } from "../../lib/products";
import { useLang } from "../../components/Providers";
import { supabase } from "../../lib/supabaseClient";
import { cleanPhone, phoneToEmail, pinToPassword } from "../../lib/helpers";

export default function LoginPage() {
  const { t } = useLang();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (cleanPhone(phone).length < 6) return setError(t("invalid_phone"));
    if (!/^\d{4}$/.test(pin)) return setError(t("invalid_pin"));
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({
      email: phoneToEmail(phone),
      password: pinToPassword(pin),
    });
    if (err) {
      setError(t("wrong_login"));
      setLoading(false);
      return;
    }
    clearProductsCache();
    router.replace("/catalogue");
  }

  return (
    <div className="auth">
      <div className="auth-lang">
        <LangToggle />
      </div>
      <AppLogo size={150} />
      <form onSubmit={submit}>
        {error && <div className="error">{error}</div>}
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
            autoComplete="current-password"
          />
        </div>
        <button className="btn green" disabled={loading}>
          <Icon name="check" size={24} /> {loading ? t("loading") : t("login")}
        </button>
      </form>
      <p className="auth-switch">
        {t("no_account")} <Link href="/inscription">{t("signup")}</Link>
      </p>
    </div>
  );
}
