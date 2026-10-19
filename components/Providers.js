"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { dict } from "../lib/i18n";

const LangContext = createContext({ lang: "fr", setLang: () => {}, t: (k) => k });

export function useLang() {
  return useContext(LangContext);
}

export default function Providers({ children }) {
  const [lang, setLangState] = useState("fr");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("lang");
      if (saved === "ar" || saved === "fr") setLangState(saved);
    } catch {}
    // Enregistre le service worker (nécessaire pour installer l'app / PWABuilder)
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  // L'arabe s'écrit de droite à gauche : on change le sens de toute la page
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  const setLang = (l) => {
    setLangState(l);
    try {
      localStorage.setItem("lang", l);
    } catch {}
  };

  const t = useCallback((key) => (dict[lang] && dict[lang][key]) || dict.fr[key] || key, [lang]);

  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>;
}
