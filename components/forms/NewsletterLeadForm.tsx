"use client";

import { useEffect, useState, type FormEvent } from "react";

import { Link, useSearchParams } from "@/lib/router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  buildAttributionSignature,
  getCevonneConsentState,
  getCevonneResponseMessage,
  hasCevonneUtmSignals,
  hasRecordedAttributionSignature,
  isEmailOptedOut,
  markRecordedAttributionSignature,
  postCevonneRoute,
  readCevonneUtmPayload,
  setCevonneConsentState,
} from "@/lib/cevonne/client";

const PRIVACY_POLICY_VERSION = "2026-website-v1";
const PRIVACY_ACTIONS_HREF = "/privacy-policy#privacy-actions";
const PRIVACY_UNSUBSCRIBE_HREF = "/privacy-policy#privacy-unsubscribe";

type NewsletterActionStatus = "SUBSCRIBED" | "VERIFICATION_NEEDED" | "OPTED_OUT";

type NewsletterActionSummary = {
  email: string;
  status: NewsletterActionStatus;
};

const createContactId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `cevonne-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export default function NewsletterLeadForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [emailConsent, setEmailConsent] = useState(false);
  const [trackingConsent, setTrackingConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [subscriptionSummary, setSubscriptionSummary] = useState<NewsletterActionSummary | null>(null);

  useEffect(() => {
    const state = getCevonneConsentState();
    if (state?.email) {
      setEmail((current) => current || state.email);
      setSubscriptionSummary({
        email: state.email,
        status: state.optedOut ? "OPTED_OUT" : state.marketingConsent ? "SUBSCRIBED" : "VERIFICATION_NEEDED",
      });
    }
  }, []);

  const utmPayload = readCevonneUtmPayload(searchParams.toString());
  const hasAttributionSignals = hasCevonneUtmSignals(utmPayload);
  const optedOutForEmail = isEmailOptedOut(email);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      toast.error("Enter an email address.");
      return;
    }

    if (optedOutForEmail) {
      toast.error("This address is already opted out of email updates.");
      return;
    }

    if (!emailConsent) {
      toast.error("Please confirm email consent before subscribing.");
      return;
    }

    setSubmitting(true);
    const storedConsent = getCevonneConsentState();
    const contactId =
      storedConsent?.email === trimmedEmail && storedConsent.contactId ? storedConsent.contactId : createContactId();
    const basePayload = {
      email: trimmedEmail,
      contact_id: contactId,
      channel: "EMAIL",
      consent_status: "YES",
      explicit_consent: true,
      consent_source: "website_form",
      source_event: "newsletter_signup",
      privacy_policy_version: PRIVACY_POLICY_VERSION,
      ...utmPayload,
    };

    try {
      const emailConsentResponse = await postCevonneRoute("/cevonne/consent", basePayload);

      if (emailConsentResponse.status === "BLOCK" || emailConsentResponse.status === "ERROR") {
        toast.error(getCevonneResponseMessage(emailConsentResponse));
        return;
      }

      let trackingRecorded = false;
      if (trackingConsent) {
        const trackingResponse = await postCevonneRoute("/cevonne/consent", {
          ...basePayload,
          channel: "TRACKING",
          source_event: "tracking_consent",
          consent_source: "website_form",
        });

        trackingRecorded =
          trackingResponse.status === "PASS" || trackingResponse.status === "MANUAL_ONLY";

        if (!trackingRecorded) {
          toast.info("Email signup was saved, but tracking consent could not be recorded.");
        }
      }

      setCevonneConsentState({
        email: trimmedEmail,
        contactId,
        marketingConsent: emailConsentResponse.status !== "MANUAL_ONLY",
        trackingConsent: trackingRecorded && emailConsentResponse.status !== "MANUAL_ONLY",
        optedOut: false,
        optedOutEmail: null,
        consentUpdatedAt: new Date().toISOString(),
        optedOutAt: null,
      });
      setSubscriptionSummary({
        email: trimmedEmail,
        status: emailConsentResponse.status === "MANUAL_ONLY" ? "VERIFICATION_NEEDED" : "SUBSCRIBED",
      });

      if (emailConsentResponse.status === "MANUAL_ONLY") {
        toast.info("Your signup was saved. Verification is still needed.");
      } else {
        toast.success("You're on the list.");
      }
      setEmail("");
      setEmailConsent(false);
      setTrackingConsent(false);

      if (trackingRecorded && hasAttributionSignals) {
        const attributionSignature = buildAttributionSignature({
          contactId,
          eventType: "LEAD",
          pathname: window.location.pathname,
          utm: utmPayload,
        });

        if (hasRecordedAttributionSignature(attributionSignature) || isEmailOptedOut(trimmedEmail)) {
          return;
        }

        try {
          const attributionResponse = await postCevonneRoute("/cevonne/attribution", {
            contact_id: contactId,
            event_type: "LEAD",
            event_name: "LEAD",
            tracking_consent_status: "YES",
            source_event: "newsletter_signup",
            ...utmPayload,
          });

          if (attributionResponse.status !== "ERROR") {
            markRecordedAttributionSignature(attributionSignature);
          }
        } catch (error) {
          console.warn("Lead attribution failed", error);
        }
      }
    } catch (error) {
      console.error("Newsletter lead form failed", error);
      toast.error(error instanceof Error ? error.message : "Unable to save your subscription.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-screen-2xl px-4 py-12 sm:px-6 lg:px-1">
      <div className="overflow-hidden rounded-[32px] border border-neutral-200 bg-[linear-gradient(135deg,#fffaf5_0%,#ffffff_56%,#f5efe7_100%)] shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
        <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="border-b border-neutral-200 px-6 py-8 sm:px-10 sm:py-10 lg:border-b-0 lg:border-r">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-500">
              Newsletter
            </p>
            <h2
              className="mt-4 max-w-xl text-3xl font-semibold text-neutral-950 sm:text-4xl"
              style={{
                fontFamily: '"Cormorant Garamond", Georgia, "Times New Roman", serif',
              }}
            >
              Receive launch notes, shade drops, and private access.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-neutral-700 sm:text-base">
              Subscribe with your email to receive product updates. If you opt into tracking, we will only send identifiable attribution after consent is recorded.
            </p>
            {hasAttributionSignals ? (
              <p className="mt-3 text-xs uppercase tracking-[0.25em] text-neutral-500">
                Campaign attribution is available for this page.
              </p>
            ) : null}
          </div>

          <form className="space-y-5 px-6 py-8 sm:px-10 sm:py-10" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="newsletter-email" className="text-sm font-medium text-neutral-900">
                Email address
              </Label>
              <Input
                id="newsletter-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                disabled={submitting}
                required
                className="h-12 rounded-xl border-neutral-300 bg-white/90 text-neutral-950 placeholder:text-neutral-400"
              />
            </div>

            <label className="flex items-start gap-3 rounded-2xl border border-neutral-200 bg-white/80 px-4 py-3">
              <Checkbox
                checked={emailConsent}
                onCheckedChange={(checked) => setEmailConsent(checked === true)}
                disabled={submitting}
                className="mt-0.5 border-neutral-300 data-[state=checked]:border-neutral-950 data-[state=checked]:bg-neutral-950"
              />
              <span className="text-sm leading-6 text-neutral-700">
                I agree to receive email updates from Cevonne and accept the{" "}
                <Link to="/privacy-policy" className="font-medium text-neutral-950 underline underline-offset-4">
                  Privacy Policy
                </Link>
                .
              </span>
            </label>

            <label className="flex items-start gap-3 rounded-2xl border border-neutral-200 bg-white/80 px-4 py-3">
              <Checkbox
                checked={trackingConsent}
                onCheckedChange={(checked) => setTrackingConsent(checked === true)}
                disabled={submitting}
                className="mt-0.5 border-neutral-300 data-[state=checked]:border-neutral-950 data-[state=checked]:bg-neutral-950"
              />
              <span className="text-sm leading-6 text-neutral-700">
                I agree to consented tracking for attribution and campaign measurement after signup.
              </span>
            </label>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                type="submit"
                disabled={submitting || !emailConsent || optedOutForEmail}
                className="h-12 rounded-full bg-neutral-950 px-6 text-sm font-semibold text-white hover:bg-neutral-800"
              >
                {submitting ? "Saving..." : "Subscribe"}
              </Button>
              <p className="text-xs leading-6 text-neutral-500">
                We keep the flow compliant. Manage preferences after signup from the privacy actions page.
              </p>
            </div>

            {subscriptionSummary ? (
              <div
                role="status"
                aria-live="polite"
                className="rounded-3xl border border-neutral-200 bg-white/90 p-4 shadow-sm"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-neutral-500">
                      Next step
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="break-all text-sm font-semibold text-neutral-950">{subscriptionSummary.email}</span>
                      <span
                        className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold ${
                          subscriptionSummary.status === "SUBSCRIBED"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : subscriptionSummary.status === "VERIFICATION_NEEDED"
                              ? "border-amber-200 bg-amber-50 text-amber-700"
                              : "border-rose-200 bg-rose-50 text-rose-700"
                        }`}
                      >
                        {subscriptionSummary.status === "SUBSCRIBED"
                          ? "Subscribed"
                          : subscriptionSummary.status === "VERIFICATION_NEEDED"
                            ? "Verification needed"
                            : "Unsubscribed"}
                      </span>
                    </div>
                    <p className="text-sm leading-6 text-neutral-700">
                      {subscriptionSummary.status === "SUBSCRIBED"
                        ? "Your email is on the list. Use the actions below to manage preferences."
                        : subscriptionSummary.status === "VERIFICATION_NEEDED"
                          ? "Your signup is saved, but verification is still required."
                          : "This email is opted out. Update preferences from the privacy actions page."}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {subscriptionSummary.status === "VERIFICATION_NEEDED" ? (
                      <Button
                        type="button"
                        disabled
                        className="h-11 rounded-full bg-neutral-200 px-5 text-sm font-semibold text-neutral-500"
                      >
                        Send Verification
                      </Button>
                    ) : (
                      <Button asChild className="h-11 rounded-full bg-neutral-950 px-5 text-sm font-semibold text-white hover:bg-neutral-800">
                        <Link to={PRIVACY_ACTIONS_HREF}>Manage Subscription</Link>
                      </Button>
                    )}

                    {subscriptionSummary.status === "SUBSCRIBED" ? (
                      <Button asChild variant="outline" className="h-11 rounded-full border-neutral-300 bg-white px-5 text-sm font-semibold text-neutral-900 hover:bg-neutral-50">
                        <Link to={PRIVACY_UNSUBSCRIBE_HREF}>Unsubscribe</Link>
                      </Button>
                    ) : null}
                  </div>
                </div>

                {subscriptionSummary.status === "VERIFICATION_NEEDED" ? (
                  <p className="mt-3 text-xs leading-5 text-neutral-500">Action not connected yet.</p>
                ) : null}
              </div>
            ) : optedOutForEmail ? (
              <p className="text-sm text-rose-700">
                This email address is already opted out. Use the privacy page unsubscribe form to update preferences.
              </p>
            ) : null}
          </form>
        </div>
      </div>
    </section>
  );
}
