// Numéro de téléphone -> "e-mail" interne (jamais envoyé : la confirmation e-mail est désactivée)
export function cleanPhone(phone) {
  return String(phone || "").replace(/\D/g, "");
}

export function phoneToEmail(phone) {
  return `${cleanPhone(phone)}@monstock-app.com`;
}

// Le code PIN à 4 chiffres devient le mot de passe (Supabase exige 6 caractères minimum)
export function pinToPassword(pin) {
  return `${pin}-monstock`;
}

export function uniqueId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// Réduit la photo (téléphone = plusieurs Mo) à ~800px pour économiser les données mobiles
export function compressImage(file, maxSize = 800, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          blob ? resolve(blob) : reject(new Error("compress"));
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image"));
    };
    img.src = url;
  });
}

export function formatDate(value, lang) {
  try {
    return new Date(value).toLocaleString(lang === "ar" ? "ar-u-nu-latn" : "fr-FR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// "14:32" (toujours en chiffres latins, même en arabe)
export function timeOf(value) {
  try {
    const d = new Date(value);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return "";
  }
}

// Clé de jour locale "2026-10-25" pour regrouper les ventes
export function dayKey(value) {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// "dimanche 25/10" — "اليوم" / "Aujourd'hui" géré par la page
export function dayLabel(value, lang) {
  try {
    const d = new Date(value);
    const wd = d.toLocaleDateString(lang === "ar" ? "ar-u-nu-latn" : "fr-FR", { weekday: "long" });
    return `${wd} ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  } catch {
    return "";
  }
}
