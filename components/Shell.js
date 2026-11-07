"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Icon from "./Icons";
import LangToggle from "./LangToggle";
import { useLang } from "./Providers";
import { supabase } from "../lib/supabaseClient";
import { clearProductsCache } from "../lib/products";
import { useEffect, useState } from "react";
import Paywall, { currentUser } from "./Paywall";
import { clearStatus, daysLeft, useAccountStatus } from "../lib/account";

const tabs = [
  { href: "/catalogue", icon: "box", key: "products", tone: "" },
  { href: "/mouvement/entree", icon: "download", key: "entry", tone: "green" },
  { href: "/mouvement/vente", icon: "cart", key: "sale", tone: "red" },
  { href: "/bilan", icon: "chart", key: "report", tone: "" },
];

export default function Shell({ title, backHref, nav = true, gate = true, children }) {
  const { t } = useLang();
  const pathname = usePathname() || "";
  const router = useRouter();
  const status = useAccountStatus();
  const [user, setUser] = useState(null);

  useEffect(() => {
    currentUser().then(setUser);
  }, []);

  // Accès fini (essai ou abonnement) : on montre l'écran de paiement à la place de la page
  const locked = gate && status && status.access === false;
  const left = status && !status.unknown && !status.staff ? daysLeft(status.paid_until) : null;
  const showReminder = !locked && left !== null && left <= 7 && pathname !== "/abonnement";
  const announcement = status && status.settings ? (status.settings.announcement || "").trim() : "";

  async function logout() {
    await supabase.auth.signOut();
    clearProductsCache();
    clearStatus();
    router.replace("/login");
  }

  return (
    <div className="app">
      <header className="top">
        <div className="top-side">
          {backHref ? (
            <Link href={backHref} className="icon-btn" aria-label={t("back")}>
              <span className="flip">
                <Icon name="back" size={24} />
              </span>
            </Link>
          ) : (
            <span className="icon-btn-spacer" />
          )}
        </div>
        <h1>{title}</h1>
        <div className="top-side right">
          {status && status.staff && (
            <Link href="/admin" className="icon-btn" aria-label={t("admin")}>
              <Icon name="gear" size={22} />
            </Link>
          )}
          <LangToggle />
          {nav && (
            <button className="icon-btn" onClick={logout} aria-label={t("logout")}>
              <Icon name="logout" size={22} />
            </button>
          )}
        </div>
      </header>

      <main className="content">
        {announcement && !locked && <div className="notice announce">{announcement}</div>}
        {showReminder && (
          <Link href="/abonnement" className={`reminder ${left <= 3 ? "urgent" : ""}`}>
            <Icon name="clock" size={22} />
            <span>
              {status.has_paid ? t("sub_left") : t("trial_left")} <b dir="ltr">{Math.max(left, 0)}</b> {t("days_word")}
            </span>
            <span className="reminder-pay">{t("pay_now")}</span>
          </Link>
        )}
        {locked ? <Paywall status={status} user={user} /> : children}
      </main>

      {nav && !locked && (
        <nav className="bottom-nav">
          {tabs.map((tab) => {
            const active =
              pathname === tab.href ||
              (tab.href === "/catalogue" && pathname.startsWith("/produit")) ||
              (tab.href === "/mouvement/vente" && pathname.startsWith("/ventes"));
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`tab ${tab.tone} ${active ? "active" : ""}`}
              >
                <Icon name={tab.icon} size={26} />
                <span>{t(tab.key)}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
