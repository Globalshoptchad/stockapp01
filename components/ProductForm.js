"use client";
import { useRef, useState } from "react";
import Icon from "./Icons";
import BarcodeScanner from "./BarcodeScanner";
import { useLang } from "./Providers";
import { supabase } from "../lib/supabaseClient";
import { compressImage, uniqueId } from "../lib/helpers";

const BUCKET = "product-photos";

function pathFromUrl(url) {
  if (!url) return null;
  const marker = `/${BUCKET}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : url.slice(i + marker.length);
}

// Formulaire pour ajouter OU modifier un produit (photo + nom + code-barres optionnel)
export default function ProductForm({ initial, defaultBarcode = "", onSaved, onDeleted }) {
  const { t } = useLang();
  const editing = !!initial;
  const [name, setName] = useState(initial?.name || "");
  const [barcode, setBarcode] = useState(initial?.barcode || defaultBarcode || "");
  const [photoUrl] = useState(initial?.photo_url || "");
  const [newFile, setNewFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  function onPick(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setNewFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function save(e) {
    e.preventDefault();
    setError("");
    const cleanName = name.trim();
    if (!cleanName) {
      setError(t("name_required"));
      return;
    }
    setSaving(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const uid = session.user.id;
      const code = barcode.trim() || null;

      if (code) {
        let q = supabase.from("products").select("id").eq("barcode", code).limit(1);
        if (editing) q = q.neq("id", initial.id);
        const { data: dup } = await q;
        if (dup && dup.length) {
          setError(t("barcode_used"));
          setSaving(false);
          return;
        }
      }

      let finalUrl = photoUrl;
      if (newFile) {
        const blob = await compressImage(newFile);
        const path = `${uid}/${uniqueId()}.jpg`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, blob, { contentType: "image/jpeg" });
        if (upErr) throw upErr;
        finalUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
        const oldPath = pathFromUrl(photoUrl);
        if (oldPath) await supabase.storage.from(BUCKET).remove([oldPath]);
      }

      const row = { name: cleanName, barcode: code, photo_url: finalUrl || null };
      if (editing) {
        const { error: err } = await supabase.from("products").update(row).eq("id", initial.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from("products").insert(row);
        if (err) throw err;
      }
      if (onSaved) onSaved();
    } catch (err) {
      console.error(err);
      setError(t("error_generic"));
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm(t("confirm_delete_product"))) return;
    setSaving(true);
    const oldPath = pathFromUrl(photoUrl);
    const { error: err } = await supabase.from("products").delete().eq("id", initial.id);
    if (err) {
      setError(t("error_generic"));
      setSaving(false);
      return;
    }
    if (oldPath) await supabase.storage.from(BUCKET).remove([oldPath]);
    if (onDeleted) onDeleted();
  }

  const shownPhoto = preview || photoUrl;

  return (
    <form onSubmit={save}>
      {error && <div className="error">{error}</div>}

      <button type="button" className="photo-pick" onClick={() => fileRef.current && fileRef.current.click()}>
        {shownPhoto ? <img src={shownPhoto} alt="" /> : <Icon name="camera" size={56} />}
        <span className="photo-label">
          <Icon name="camera" size={20} /> {shownPhoto ? t("change_photo") : t("take_photo")}
        </span>
      </button>
      <input ref={fileRef} type="file" accept="image/*" onChange={onPick} hidden />

      <div className="field">
        <label>{t("product_name")}</label>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          autoComplete="off"
        />
      </div>

      <div className="field">
        <label>{t("barcode")}</label>
        <div className="row">
          <input
            className="input"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            inputMode="numeric"
            autoComplete="off"
          />
          <button type="button" className="icon-btn big" onClick={() => setScanOpen(true)} aria-label={t("scan")}>
            <Icon name="scan" size={26} />
          </button>
        </div>
      </div>

      <button type="submit" className="btn green" disabled={saving}>
        <Icon name="check" size={24} /> {saving ? t("loading") : t("save")}
      </button>

      {editing && (
        <button type="button" className="btn danger spaced" onClick={remove} disabled={saving}>
          <Icon name="trash" size={22} /> {t("delete_product")}
        </button>
      )}

      {scanOpen && (
        <BarcodeScanner
          onClose={() => setScanOpen(false)}
          onDetected={(code) => {
            setBarcode(code);
            setScanOpen(false);
          }}
        />
      )}
    </form>
  );
}
