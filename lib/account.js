"use client";
// Abonnement : état du commerçant connecté (essai, payé, bloqué) + réglages de l'app.
// Si la base n'a pas encore les tables d'abonnement, on laisse tout ouvert (l'app continue de marcher).
import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

let cache = null; // { at, value }
const listeners = new Set();

export async function loadStatus(force = false) {
  if (!force && cache && Date.now() - cache.at < 60_000) return cache.value;
  let value;
  try {
    const { data, error } = await supabase.rpc("ms_my_status");
    value = error || !data ? { access: true, unknown: true, settings: {} } : data;
  } catch {
    value = { access: true, unknown: true, settings: {} };
  }
  cache = { at: Date.now(), value };
  listeners.forEach((fn) => fn(value));
  return value;
}

export function clearStatus() {
  cache = null;
}

export function useAccountStatus(enabled = true) {
  const [status, setStatus] = useState(cache ? cache.value : null);
  useEffect(() => {
    if (!enabled) return;
    listeners.add(setStatus);
    loadStatus().then(setStatus);
    return () => listeners.delete(setStatus);
  }, [enabled]);
  return status;
}

// Réglages publics (page d'inscription, avant connexion)
export async function loadPublicSettings() {
  try {
    const { data, error } = await supabase.rpc("ms_public_settings");
    return error || !data ? {} : data;
  } catch {
    return {};
  }
}

export function daysLeft(paidUntil) {
  if (!paidUntil) return null;
  return Math.ceil((new Date(paidUntil).getTime() - Date.now()) / 86_400_000);
}

export function formatDay(value) {
  try {
    const d = new Date(value);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  } catch {
    return "";
  }
}

// Lien WhatsApp à partir d'un numéro écrit n'importe comment (+235 66 00 00 00, 0033…)
export function whatsappLink(number, text) {
  let digits = String(number || "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 8) digits = `235${digits}`; // numéro tchadien sans indicatif
  if (!digits) return null;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export function isOn(value) {
  return value !== "false";
}
