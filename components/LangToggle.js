"use client";
import { useLang } from "./Providers";

export default function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <button
      type="button"
      className="lang-btn"
      onClick={() => setLang(lang === "fr" ? "ar" : "fr")}
      aria-label="Language"
    >
      {lang === "fr" ? "عربي" : "Français"}
    </button>
  );
}
