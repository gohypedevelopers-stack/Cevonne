"use client";

import { useEffect } from "react";

import { useLocation } from "@/lib/router";

import {
  buildAttributionSignature,
  getCevonneConsentState,
  hasCevonneUtmSignals,
  hasRecordedAttributionSignature,
  markRecordedAttributionSignature,
  postCevonneRoute,
  readCevonneUtmPayload,
} from "@/lib/cevonne/client";

export default function CevonneAttributionTracker() {
  const location = useLocation();

  useEffect(() => {
    const consentState = getCevonneConsentState();
    if (!consentState || !consentState.trackingConsent || consentState.optedOut || !consentState.contactId) {
      return;
    }

    const utmPayload = readCevonneUtmPayload(location.search);
    if (!hasCevonneUtmSignals(utmPayload)) {
      return;
    }

    const signature = buildAttributionSignature({
      contactId: consentState.contactId,
      eventType: "PAGE_VIEW",
      pathname: location.pathname,
      utm: utmPayload,
    });

    if (hasRecordedAttributionSignature(signature)) {
      return;
    }

    let cancelled = false;
    const run = async () => {
      try {
        const response = await postCevonneRoute("/cevonne/attribution", {
          contact_id: consentState.contactId,
          event_type: "PAGE_VIEW",
          event_name: "PAGE_VIEW",
          tracking_consent_status: "YES",
          source_event: "page_view",
          ...utmPayload,
        });

        if (!cancelled && response.status !== "ERROR") {
          markRecordedAttributionSignature(signature);
        }
      } catch (error) {
        console.warn("Cevonne attribution tracking failed", error);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [location.pathname, location.search]);

  return null;
}
