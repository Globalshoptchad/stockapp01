"use client";
// Espace administrateur : comptes des commerçants, réglages de l'app, équipe.
// Chaque action est vérifiée par la base (droits de la personne connectée).
import { useCallback, useEffect, useState } from "react";
import Shell from "../../components/Shell";
import Icon from "../../components/Icons";
import { useRequireAuth } from "../../lib/useRequireAuth";
import { supabase } from "../../lib/supabaseClient";
import { daysLeft, formatDay, loadStatus, useAccountStatus } from "../../lib/account";

const fcfa = (n) => `${Number(n || 0).toLocaleString("fr-FR").replace(/ | /g, " ")} FCFA`;

function badge(a) {
  if (a.blocked) return { cls: "off", text: "Bloqué" };
  if (!a.paid_until) return { cls: "wait", text: "Essai pas encore commencé" };
  const left = daysLeft(a.paid_until);
  if (left <= 0) return { cls: "off", text: a.has_paid ? "Abonnement fini" : "Essai fini" };
  return a.has_paid
    ? { cls: "ok", text: `Payé · ${left} j` }
    : { cls: left <= 7 ? "warn" : "trial", text: `Essai · ${left} j` };
}

/* ------------------------------ Comptes ------------------------------ */
function Accounts() {
  const [q, setQ] = useState("");
  const [list, setList] = useState(null);
  const [stats, setStats] = useState(null);
  const [open, setOpen] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async (search) => {
    setError("");
    const [{ data, error: e1 }, { data: st }] = await Promise.all([
      supabase.rpc("ms_admin_accounts", { p_search: search || "" }),
      supabase.rpc("ms_admin_stats"),
    ]);
    if (e1) setError("Impossible de charger les comptes.");
    setList(data || []);
    setStats(st || null);
  }, []);

  useEffect(() => {
    const id = setTimeout(() => load(q), 300);
    return () => clearTimeout(id);
  }, [q, load]);

  return (
    <>
      {stats && (
        <div className="summary admin-stats">
          <div className="sum"><small>Comptes</small><b>{stats.accounts}</b></div>
          <div className="sum green"><small>Actifs</small><b>{stats.active}</b></div>
          <div className="sum"><small>Payants</small><b>{stats.paying}</b></div>
          <div className="sum red"><small>Finis</small><b>{stats.expired}</b></div>
          <div className="sum wide"><small>Encaissé ce mois</small><b>{fcfa(stats.month_amount)}</b></div>
        </div>
      )}
      <div className="search">
        <Icon name="search" size={22} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Numéro ou nom du commerce"
          inputMode="search"
        />
      </div>
      {error && <div className="error">{error}</div>}
      {list === null ? (
        <p className="muted">Chargement…</p>
      ) : list.length === 0 ? (
        <p className="muted">Aucun compte trouvé.</p>
      ) : (
        <ul className="acc-list">
          {list.map((a) => (
            <AccountRow
              key={a.user_id}
              a={a}
              open={open === a.user_id}
              onToggle={() => setOpen(open === a.user_id ? null : a.user_id)}
              onChanged={() => load(q)}
            />
          ))}
        </ul>
      )}
    </>
  );
}

function AccountRow({ a, open, onToggle, onChanged }) {
  const [op, setOp] = useState("airtel");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [history, setHistory] = useState(null);
  const b = badge(a);

  useEffect(() => {
    if (!open) return;
    supabase.rpc("ms_admin_payments", { p_user: a.user_id }).then(({ data }) => setHistory(data || []));
  }, [open, a.user_id]);

  async function activate(months) {
    const who = a.shop_name ? `${a.shop_name} (${a.phone})` : a.phone;
    if (!window.confirm(`Activer ${months} mois pour ${who} ?`)) return;
    setBusy(true);
    setMsg("");
    const { data, error } = await supabase.rpc("ms_admin_activate", {
      p_user: a.user_id,
      p_months: months,
      p_operator: op,
    });
    setBusy(false);
    if (error) return setMsg("Erreur : activation impossible.");
    setMsg(`Activé jusqu'au ${formatDay(data)}.`);
    onChanged();
  }

  async function setBlocked(v) {
    if (!window.confirm(v ? "Bloquer ce compte ?" : "Débloquer ce compte ?")) return;
    setBusy(true);
    const { error } = await supabase.rpc("ms_admin_set_blocked", { p_user: a.user_id, p_blocked: v });
    setBusy(false);
    if (error) return setMsg("Erreur.");
    onChanged();
  }

  return (
    <li className={`acc ${open ? "open" : ""}`}>
      <button type="button" className="acc-head" onClick={onToggle}>
        <div className="acc-main">
          <b>{a.shop_name || "Sans nom"}</b>
          <span dir="ltr">{a.phone}</span>
        </div>
        <span className={`badge ${b.cls}`}>{b.text}</span>
      </button>
      {open && (
        <div className="acc-body">
          <div className="acc-info">
            Inscrit le {formatDay(a.created_at)} · {a.products} produit(s)
            {a.last_activity ? ` · dernière vente/entrée le ${formatDay(a.last_activity)}` : " · aucune vente/entrée"}
            {a.paid_until && <> · accès jusqu'au {formatDay(a.paid_until)}</>}
          </div>

          <div className="acc-label">Paiement reçu par :</div>
          <div className="chips">
            {[
              ["airtel", "Airtel Money"],
              ["moov", "Moov Money"],
              ["cash", "Espèces"],
            ].map(([k, l]) => (
              <button key={k} type="button" className={`chip ${op === k ? "on" : ""}`} onClick={() => setOp(k)}>
                {l}
              </button>
            ))}
          </div>
          <div className="acc-actions">
            {[1, 3, 6, 12].map((m) => (
              <button key={m} className="btn green small" disabled={busy} onClick={() => activate(m)}>
                +{m} mois
              </button>
            ))}
          </div>
          {msg && <div className="notice">{msg}</div>}
          <button className={`btn small ${a.blocked ? "ghost" : "danger"}`} disabled={busy} onClick={() => setBlocked(!a.blocked)}>
            <Icon name="lock" size={20} /> {a.blocked ? "Débloquer" : "Bloquer ce compte"}
          </button>

          {history && history.length > 0 && (
            <>
              <div className="acc-label">Paiements validés</div>
              <ul className="acc-pay">
                {history.map((p, i) => (
                  <li key={i}>
                    {formatDay(p.created_at)} · {p.months} mois · {fcfa(p.amount)}
                    {p.operator ? ` · ${p.operator === "cash" ? "espèces" : p.operator === "moov" ? "Moov" : "Airtel"}` : ""}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </li>
  );
}

/* ------------------------------ Réglages ----------------------------- */
const TEXT_SETTINGS = [
  ["price_month", "Prix d'un mois (FCFA)", "numeric"],
  ["trial_days", "Jours d'essai gratuit (nouveaux comptes)", "numeric"],
  ["airtel_number", "Numéro Airtel Money qui reçoit les paiements", "tel"],
  ["moov_number", "Numéro Moov Money qui reçoit les paiements", "tel"],
  ["whatsapp_number", "Numéro WhatsApp où le client signale son paiement", "tel"],
];
const SWITCHES = [
  ["signup_open", "Nouvelles inscriptions ouvertes"],
  ["feature_scan", "Bouton « scanner le code-barres »"],
];

function Settings({ initial }) {
  const [vals, setVals] = useState(initial || {});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  async function save() {
    setSaving(true);
    setMsg("");
    const keys = [...TEXT_SETTINGS.map((x) => x[0]), ...SWITCHES.map((x) => x[0]), "announcement"];
    for (const k of keys) {
      if ((vals[k] ?? "") === ((initial || {})[k] ?? "")) continue;
      const { error } = await supabase.rpc("ms_admin_set_setting", { p_key: k, p_value: String(vals[k] ?? "") });
      if (error) {
        setSaving(false);
        return setMsg("Erreur : réglage non enregistré.");
      }
    }
    await loadStatus(true);
    setSaving(false);
    setMsg("Réglages enregistrés.");
  }

  const set = (k, v) => setVals((o) => ({ ...o, [k]: v }));

  return (
    <div>
      {TEXT_SETTINGS.map(([k, label, mode]) => (
        <div className="field" key={k}>
          <label>{label}</label>
          <input className="input" inputMode={mode} value={vals[k] || ""} onChange={(e) => set(k, e.target.value)} />
        </div>
      ))}
      <div className="field">
        <label>Message affiché en haut de l'app pour tous (vide = rien)</label>
        <textarea className="input" rows={3} value={vals.announcement || ""} maxLength={300} onChange={(e) => set("announcement", e.target.value)} />
      </div>
      {SWITCHES.map(([k, label]) => (
        <label className="switch-row" key={k}>
          <input type="checkbox" checked={vals[k] !== "false"} onChange={(e) => set(k, e.target.checked ? "true" : "false")} />
          <span>{label}</span>
        </label>
      ))}
      {msg && <div className="notice">{msg}</div>}
      <button className="btn green spaced" disabled={saving} onClick={save}>
        <Icon name="check" size={24} /> {saving ? "Enregistrement…" : "Enregistrer"}
      </button>
    </div>
  );
}

/* ------------------------------- Équipe ------------------------------ */
function Team() {
  const [list, setList] = useState(null);
  const [phone, setPhone] = useState("");
  const [pAcc, setPAcc] = useState(true);
  const [pSet, setPSet] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("ms_admin_team");
    setList(data || []);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function add(e) {
    e.preventDefault();
    setMsg("");
    const { data, error } = await supabase.rpc("ms_admin_set_staff", { p_phone: phone, p_accounts: pAcc, p_settings: pSet });
    if (error) return setMsg("Erreur.");
    const texts = {
      ok: "Membre ajouté (ou ses droits mis à jour).",
      introuvable: "Aucun compte Mon Stock avec ce numéro. La personne doit d'abord créer son compte.",
      numero_invalide: "Numéro invalide.",
      proprietaire: "C'est le compte du propriétaire.",
    };
    setMsg(texts[data] || "Erreur.");
    if (data === "ok") {
      setPhone("");
      load();
    }
  }

  async function remove(m) {
    if (!window.confirm(`Retirer ${m.shop_name || m.phone} de l'équipe ?`)) return;
    await supabase.rpc("ms_admin_remove_staff", { p_user: m.user_id });
    load();
  }

  return (
    <div>
      <p className="hint">
        Donne une partie du travail à une personne de confiance. Elle se connecte à Mon Stock avec son propre numéro et
        voit le bouton d'administration.
      </p>
      {list === null ? (
        <p className="muted">Chargement…</p>
      ) : (
        <ul className="acc-list">
          {list.map((m) => (
            <li className="acc" key={m.user_id}>
              <div className="acc-head static">
                <div className="acc-main">
                  <b>{m.shop_name || "Sans nom"}</b>
                  <span dir="ltr">{m.phone}</span>
                  <small>
                    {m.is_owner
                      ? "Propriétaire : tous les droits"
                      : [m.perm_accounts && "Comptes et paiements", m.perm_settings && "Réglages"].filter(Boolean).join(" · ") ||
                        "Aucun droit"}
                  </small>
                </div>
                {!m.is_owner && (
                  <button className="icon-btn" onClick={() => remove(m)} aria-label="Retirer">
                    <Icon name="trash" size={22} />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <h3 className="section">Ajouter un membre</h3>
      <form onSubmit={add}>
        <div className="field">
          <label>Son numéro d'inscription Mon Stock</label>
          <input className="input" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <label className="switch-row">
          <input type="checkbox" checked={pAcc} onChange={(e) => setPAcc(e.target.checked)} />
          <span>Comptes : voir les commerçants, activer après paiement, bloquer</span>
        </label>
        <label className="switch-row">
          <input type="checkbox" checked={pSet} onChange={(e) => setPSet(e.target.checked)} />
          <span>Réglages : prix, numéros de paiement, fonctionnalités</span>
        </label>
        {msg && <div className="notice">{msg}</div>}
        <button className="btn green spaced">
          <Icon name="plus" size={24} /> Ajouter / mettre à jour
        </button>
      </form>
    </div>
  );
}

/* -------------------------------- Page ------------------------------- */
export default function AdminPage() {
  const { ready } = useRequireAuth();
  const status = useAccountStatus(ready);
  const [tab, setTab] = useState("accounts");

  if (!ready || !status) return <div className="center-screen">…</div>;
  const staff = status.staff;

  if (!staff) {
    return (
      <Shell title="Administration" backHref="/catalogue" gate={false}>
        <div className="empty">
          <Icon name="lock" size={56} />
          <p>Accès réservé à l'équipe Mon Stock.</p>
        </div>
      </Shell>
    );
  }

  const tabs = [
    staff.accounts && ["accounts", "Comptes", "users"],
    staff.settings && ["settings", "Réglages", "gear"],
    staff.owner && ["team", "Équipe", "hand"],
  ].filter(Boolean);
  const current = tabs.find((x) => x[0] === tab) ? tab : tabs[0] && tabs[0][0];

  return (
    <Shell title="Administration" backHref="/catalogue" gate={false}>
      <div className="chips">
        {tabs.map(([k, label, icon]) => (
          <button key={k} type="button" className={`chip ${current === k ? "on" : ""}`} onClick={() => setTab(k)}>
            <Icon name={icon} size={18} /> {label}
          </button>
        ))}
      </div>
      {current === "accounts" && <Accounts />}
      {current === "settings" && <Settings initial={status.settings} />}
      {current === "team" && <Team />}
    </Shell>
  );
}
