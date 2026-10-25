"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Icon from "./Icons";
import LangToggle from "./LangToggle";
import { useLang } from "./Providers";
import { supabase } from "../lib/supabaseClient";
import { clearProductsCache } from "../lib/products";

const tabs = [
  { href: "/catalogue", icon: "box", key: "products", tone: "" },
  { href: "/mouvement/entree", icon: "download", key: "entry", tone: "green" },
  { href: "/mouvement/vente", icon: "cart", key: "sale", tone: "red" },
  { href: "/bilan", icon: "chart", key: "report", tone: "" },
];

export default function Shell({ title, backHref, nav = true, children }) {
  const { t } = useLang();
  const pathname = usePathname() || "";
  const router = useRouter();

  async function logout() {
    await supabase.auth.signOut();
    clearProductsCache();
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
          <LangToggle />
          {nav && (
            <button className="icon-btn" onClick={logout} aria-label={t("logout")}>
              <Icon name="logout" size={22} />
            </button>
          )}
        </div>
      </header>

      <main className="content">{children}</main>

      {nav && (
        <nav className="bottom-nav">
          {tabs.map((tab) => {
            const active =
              pathname === tab.href || (tab.href === "/catalogue" && pathname.startsWith("/produit"));
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
