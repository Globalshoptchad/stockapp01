"use client";
import { useRef, useState } from "react";
import Icon from "./Icons";
import BarcodeScanner from "./BarcodeScanner";
import { useLang } from "./Providers";
import { supabase } from "../lib/supabaseClient";
import { compressImage, uniqueId } from "../lib/helpers";
import { BUCKET, deleteProduct, fcfa, photoPaths } from "../lib/products";

// Garde seulement les chiffres ("20 000" -> "20000")
const digits = (v) => String(v || "").replace(/\D/g, "");
const num = (v) => Number(digits(v)) || 0;
// Affiche "20000" en "20 000" pendant la saisie
const spaced = (v) => digits(v).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const initNum = (v) => (v === null || v === undefined || Number(v) === 0 ? "" : String(Math.round(Number(v))));

// Champ de prix : gros chiffres, "FCFA" à côté
function MoneyInput({ label, icon, value, onChange, placeholder, hint, tone }) {
  const { t } = useLang();
  return (
    <div className={"field money " + (tone || "")}>
      <label>
        <Icon name={icon} size={22} /> {label}
      </label>
      <div className="money-box">
        <input
          className="input"
          inputMode="numeric"
          value={spaced(value)}
          placeholder={placeholder}
          onChange={(e) => onChange(digits(e.target.value))}
          autoComplete="off"
        />
        <span className="money-cur">{t("currency")}</span>
      </div>
      {hint && <small className="hint">{hint}</small>}
    </div>
  );
}

// Formulaire pour ajouter OU modifier un produit : photo, nom, prix, code-barres (optionnel)
export default function ProductForm({ initial, defaultBarcode = "", onSaved, onDeleted }) {
  const { t } = useLang();
  const editing = !!initial;
  const [name, setName] = useState(initial?.name || "");
  const [barcode, setBarcode] = useState(initial?.barcode || defaultBarcode || "");
  const [pack, setPack] = useState(initial?.pack_size ? String(initial.pack_size) : "1");
  const [buy, setBuy] = useState(initNum(initial?.buy_price));
  const [sell, setSell] = useState(initNum(initial?.sell_price));
  const [sellPiece, setSellPiece] = useState(initial?.sell_price_piece != null ? initNum(initial.sell_price_piece) : "");
  const [photoUrl] = useState(initial?.photo_url || "");
  const [newFile, setNewFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  const packN = Math.max(1, num(pack) || 1);
  const isPack = packN > 1;
  const autoPiece = num(sell) / packN;
  const piece = isPack && sellPiece !== "" ? num(sellPiece) : autoPiece;
  const profitPack = num(sell) - num(buy);
  const profitPiece = piece - num(buy) / packN;
  const showProfit = num(sell) > 0 || (isPack && num(sellPiece) > 0);

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
        // Photo en grand (~1000px), compressée pour ne pas consommer trop de données mobiles
        const blob = await compressImage(newFile, 1000, 0.72);
        const path = `${uid}/${uniqueId()}.jpg`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
        if (upErr) throw upErr;
        finalUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
        // L'ancienne photo est effacée : la place est libérée
        const old = photoPaths(photoUrl);
        if (old.length) await supabase.storage.from(BUCKET).remove(old);
      }

      const row = {
        name: cleanName,
        barcode: code,
        photo_url: finalUrl || null,
        pack_size: packN,
        buy_price: num(buy),
        sell_price: num(sell),
        sell_price_piece: isPack && sellPiece !== "" ? num(sellPiece) : null,
      };
      if (editing) {
        const { error: err } = await supabase.from("products").update(row).eq("id", initial.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from("products").insert(row);
        if (err) throw err;
      }
      if (onSaved) onSaved();
      setSaving(false);
    } catch (err) {
      console.error(err);
      setError(t("error_generic"));
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm(t("confirm_delete_card"))) return;
    setSaving(true);
    try {
      await deleteProduct(initial);
      if (onDeleted) onDeleted();
    } catch {
      setError(t("error_generic"));
      setSaving(false);
    }
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
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="off" />
      </div>

      <div className="price-block">
        <h3 className="block-title">
          <Icon name="coins" size={24} /> {t("prices")}
        </h3>

        <div className="field">
          <label>
            <Icon name="box" size={22} /> {t("pack_size_q")}
          </label>
          <div className="stepper">
            <button type="button" className="qty-btn sm" onClick={() => setPack(String(Math.max(1, packN - 1)))}>
              <Icon name="minus" size={28} stroke={3} />
            </button>
            <input
              className="input center big-num"
              inputMode="numeric"
              value={pack}
              onChange={(e) => setPack(digits(e.target.value).slice(0, 5))}
              onBlur={() => setPack(String(packN))}
            />
            <button type="button" className="qty-btn sm" onClick={() => setPack(String(packN + 1))}>
              <Icon name="plus" size={28} stroke={3} />
            </button>
          </div>
          <small className="hint">{t("pack_size_hint")}</small>
        </div>

        <MoneyInput
          label={isPack ? t("buy_price_q") : t("buy_price_one")}
          icon="download"
          tone="green"
          value={buy}
          onChange={setBuy}
          placeholder="0"
        />
        <MoneyInput
          label={isPack ? t("sell_price_q") : t("piece_price_q")}
          icon="cart"
          tone="red"
          value={sell}
          onChange={setSell}
          placeholder="0"
        />
        {isPack && (
          <MoneyInput
            label={t("piece_price_q")}
            icon="cart"
            tone="red"
            value={sellPiece}
            onChange={setSellPiece}
            placeholder={autoPiece ? String(Math.round(autoPiece)) : "0"}
            hint={t("piece_price_hint")}
          />
        )}

        {showProfit && (
          <div className="profit-preview">
            {isPack && (
              <div className={"pp " + (profitPack < 0 ? "neg" : "")}>
                <small>{t("profit_per_pack")}</small>
                <b>{fcfa(profitPack)}</b>
              </div>
            )}
            <div className={"pp " + (profitPiece < 0 ? "neg" : "")}>
              <small>{t("profit_per_piece")}</small>
              <b>{fcfa(profitPiece)}</b>
            </div>
          </div>
        )}
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
