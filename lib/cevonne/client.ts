"use client";

import { API_BASE } from "@/lib/api";
import {
  getCevonneResponseMessage as sharedGetCevonneResponseMessage,
  type CevonneResponse,
  type CevonneResponseStatus,
} from "@/lib/cevonne/response";

export type CevonneStatus = CevonneResponseStatus;

export type CevonneApiResponse = CevonneResponse;

export type CevonneConsentState = {
  email: string;
  contactId: string;
  marketingConsent: boolean;
  trackingConsent: boolean;
  optedOut: boolean;
  optedOutEmail: string | null;
  consentUpdatedAt: string;
  optedOutAt: string | null;
};

export type CevonneUtmPayload = {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  gclid?: string | null;
  fbclid?: string | null;
  meta_event_id?: string | null;
};

const CONSENT_STATE_KEY = "cevonne:g3:consent-state";
const ATTRIBUTION_SIGNATURES_KEY = "cevonne:g3:attribution-signatures";
const PURCHASE_SIGNATURES_KEY = "cevonne:g3:purchase-signatures";
const MAX_SIGNATURE_HISTORY = 30;

const isBrowser = () => typeof window !== "undefined";

const normalizeEmail = (value?: string | null) => {
  const email = value?.trim().toLowerCase() || "";
  return email;
};

const readJsonStorage = <T,>(key: string, fallback: T): T => {
  if (!isBrowser()) {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const writeJsonStorage = <T,>(key: string, value: T) => {
  if (!isBrowser()) return;

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage failures in private mode / quota-exceeded cases.
  }
};

const readStringSet = (key: string) => {
  return new Set(readJsonStorage<string[]>(key, []));
};

const writeStringSet = (key: string, values: Set<string>) => {
  writeJsonStorage(key, Array.from(values).slice(-MAX_SIGNATURE_HISTORY));
};

const markSignature = (key: string, signature: string) => {
  if (!signature.trim()) return;
  const values = readStringSet(key);
  values.add(signature);
  writeStringSet(key, values);
};

const hasSignature = (key: string, signature: string) => {
  if (!signature.trim()) return false;
  return readStringSet(key).has(signature);
};

const createEmptyConsentState = (): CevonneConsentState => ({
  email: "",
  contactId: "",
  marketingConsent: false,
  trackingConsent: false,
  optedOut: false,
  optedOutEmail: null,
  consentUpdatedAt: "",
  optedOutAt: null,
});

const normalizeConsentState = (
  state: Partial<CevonneConsentState> | null | undefined,
): CevonneConsentState => ({
  ...createEmptyConsentState(),
  ...state,
  email: normalizeEmail(state?.email),
  contactId: state?.contactId?.trim() || "",
  optedOutEmail: state?.optedOutEmail ? normalizeEmail(state.optedOutEmail) : null,
  consentUpdatedAt: state?.consentUpdatedAt?.trim() || "",
  optedOutAt: state?.optedOutAt?.trim() || null,
  marketingConsent: Boolean(state?.marketingConsent),
  trackingConsent: Boolean(state?.trackingConsent),
  optedOut: Boolean(state?.optedOut),
});

export const getCevonneConsentState = () => {
  if (!isBrowser()) {
    return null;
  }

  const stored = readJsonStorage<Partial<CevonneConsentState> | null>(CONSENT_STATE_KEY, null);
  if (!stored) return null;
  return normalizeConsentState(stored);
};

export const setCevonneConsentState = (state: Partial<CevonneConsentState>) => {
  const current = getCevonneConsentState();
  const merged = normalizeConsentState({
    ...current,
    ...state,
  });

  writeJsonStorage(CONSENT_STATE_KEY, merged);
  return merged;
};

export const clearCevonneConsentState = () => {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(CONSENT_STATE_KEY);
  } catch {
    // ignore
  }
};

export const isEmailOptedOut = (email?: string | null) => {
  const current = getCevonneConsentState();
  if (!current) return false;

  return current.optedOut && current.optedOutEmail === normalizeEmail(email);
};

export const readCevonneUtmPayload = (search: string | URLSearchParams) => {
  const params =
    typeof search === "string" ? new URLSearchParams(search.replace(/^\?/, "")) : search;

  const utm_source = params.get("utm_source")?.trim() || null;
  const utm_medium = params.get("utm_medium")?.trim() || null;
  const utm_campaign = params.get("utm_campaign")?.trim() || null;
  const gclid = params.get("gclid")?.trim() || null;
  const fbclid = params.get("fbclid")?.trim() || null;
  const meta_event_id = params.get("meta_event_id")?.trim() || null;

  return { utm_source, utm_medium, utm_campaign, gclid, fbclid, meta_event_id };
};

export const hasCevonneUtmSignals = (payload: CevonneUtmPayload) => {
  return Boolean(payload.utm_source || payload.utm_medium || payload.utm_campaign || payload.gclid || payload.fbclid || payload.meta_event_id);
};

export async function postCevonneRoute<TResponse extends CevonneApiResponse>(
  route: `/cevonne/${string}` | string,
  payload: Record<string, unknown>,
): Promise<TResponse> {
  const normalizedRoute = route.startsWith("/") ? route : `/${route}`;
  const response = await fetch(`${API_BASE}${normalizedRoute}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  let parsed: unknown = null;
  try {
    parsed = await response.json();
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    const message = (parsed as Record<string, unknown> | null)?.message;
    throw new Error(typeof message === "string" && message.trim() ? message : `Request failed with status ${response.status}.`);
  }

  if (!parsed || typeof parsed !== "object" || !("status" in parsed)) {
    throw new Error("Invalid response from server.");
  }

  return parsed as TResponse;
}

const buildSignature = (parts: Array<string | null | undefined>) => {
  return parts
    .map((part) => (part || "").trim())
    .join("|");
};

export const buildAttributionSignature = (payload: {
  contactId?: string | null;
  eventType?: string | null;
  pathname?: string | null;
  utm: CevonneUtmPayload;
}) => {
  return buildSignature([
    "ATTRIBUTION",
    payload.contactId,
    payload.eventType,
    payload.pathname,
    payload.utm.utm_source,
    payload.utm.utm_medium,
    payload.utm.utm_campaign,
    payload.utm.gclid,
    payload.utm.fbclid,
    payload.utm.meta_event_id,
  ]);
};

export const buildPurchaseSignature = (orderId?: string | null) => buildSignature(["PURCHASE", orderId]);

export const hasRecordedAttributionSignature = (signature: string) => hasSignature(ATTRIBUTION_SIGNATURES_KEY, signature);
export const markRecordedAttributionSignature = (signature: string) => markSignature(ATTRIBUTION_SIGNATURES_KEY, signature);

export const hasRecordedPurchaseSignature = (signature: string) => hasSignature(PURCHASE_SIGNATURES_KEY, signature);
export const markRecordedPurchaseSignature = (signature: string) => markSignature(PURCHASE_SIGNATURES_KEY, signature);

export const getCevonneResponseMessage = sharedGetCevonneResponseMessage;
