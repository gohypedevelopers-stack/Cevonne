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
    <section className="w-full px-5 py-20 sm:px-8 sm:py-24 lg:px-10 lg:py-28">
      <div className="mx-auto max-w-[1680px]">
        <div className="grid gap-16 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-24">
          <div className="px-0 sm:px-4 lg:px-8">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[10px] uppercase tracking-[0.28em] text-neutral-500">
              <span>The Cevonne edit</span>
              <span>Newsletter</span>
            </div>
            <h2 className="mt-8 max-w-[32rem] font-serif text-[clamp(1.875rem,2.6vw,3rem)] font-normal leading-[1.04] tracking-[-0.02em] text-neutral-950">
              Receive launch notes, shade drops, and private access.
            </h2>
            <p className="mt-8 max-w-[34rem] text-[14px] leading-7 text-neutral-600 sm:text-[15px]">
              A considered note from Cevonne, with new releases, colour stories, and invitations reserved for our community.
            </p>
            {hasAttributionSignals ? (
              <p className="mt-10 border-l border-neutral-950 pl-4 text-[10px] uppercase tracking-[0.2em] text-neutral-600">
                Campaign attribution is available for this page.
              </p>
            ) : null}
          </div>

          <form className="px-0 sm:px-4 lg:px-8" onSubmit={handleSubmit}>
            <div>
              <Label htmlFor="newsletter-email" className="text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-700">
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
                aria-describedby="newsletter-email-note"
                className="mt-3 h-14 rounded-none border-0 border-b border-neutral-400 bg-transparent px-0 text-base text-neutral-950 shadow-none placeholder:text-neutral-400 focus-visible:border-neutral-950 focus-visible:ring-0"
              />
              <p id="newsletter-email-note" className="mt-3 text-xs leading-5 text-neutral-500">
                Join for product news and quiet moments of inspiration. Unsubscribe whenever you wish.
              </p>
            </div>

            <fieldset className="mt-14 space-y-7 border-0 p-0">
              <legend className="sr-only">Newsletter preferences</legend>
              <label className="flex items-start gap-3 text-sm leading-6 text-neutral-700 transition-colors hover:text-neutral-950 focus-within:text-neutral-950">
                <Checkbox
                  checked={emailConsent}
                  onCheckedChange={(checked) => setEmailConsent(checked === true)}
                  disabled={submitting}
                  className="mt-1 border-neutral-400 shadow-none data-[state=checked]:border-neutral-950 data-[state=checked]:bg-neutral-950"
                />
                <span>
                  I agree to receive email updates from Cevonne and accept the{" "}
                  <Link to="/privacy-policy" className="font-medium text-neutral-950 underline decoration-neutral-400 underline-offset-4 transition-colors hover:decoration-neutral-950">
                    Privacy Policy
                  </Link>
                  .
                </span>
              </label>

              <label className="flex items-start gap-3 text-sm leading-6 text-neutral-700 transition-colors hover:text-neutral-950 focus-within:text-neutral-950">
                <Checkbox
                  checked={trackingConsent}
                  onCheckedChange={(checked) => setTrackingConsent(checked === true)}
                  disabled={submitting}
                  className="mt-1 border-neutral-400 shadow-none data-[state=checked]:border-neutral-950 data-[state=checked]:bg-neutral-950"
                />
                <span>I agree to consented tracking for attribution and campaign measurement after signup.</span>
              </label>
            </fieldset>

            <div className="mt-14 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-start sm:gap-8">
              <Button
                type="submit"
                disabled={submitting || !emailConsent || optedOutForEmail}
                className="h-12 rounded-none bg-neutral-950 px-7 text-sm font-normal text-white shadow-none transition-colors hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-500"
              >
                {submitting ? "Saving..." : "Subscribe"}
              </Button>
              <p className="max-w-[22rem] text-xs leading-5 text-neutral-500">
                Your details stay in Cevonne&apos;s care. Manage preferences from the privacy actions page after signup.
              </p>
            </div>

            {subscriptionSummary ? (
              <div role="status" aria-live="polite" className="mt-12 border-l border-neutral-300 pl-5 sm:pl-6">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-3">
                    <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-neutral-500">Next step</p>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="break-all text-sm text-neutral-950">{subscriptionSummary.email}</span>
                      <span
                        className={`inline-flex items-center border px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] ${
                          subscriptionSummary.status === "SUBSCRIBED"
                            ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                            : subscriptionSummary.status === "VERIFICATION_NEEDED"
                              ? "border-amber-300 bg-amber-50 text-amber-800"
                              : "border-rose-300 bg-rose-50 text-rose-800"
                        }`}
                      >
                        {subscriptionSummary.status === "SUBSCRIBED"
                          ? "Subscribed"
                          : subscriptionSummary.status === "VERIFICATION_NEEDED"
                            ? "Verification needed"
                            : "Unsubscribed"}
                      </span>
                    </div>
                    <p className="max-w-[34rem] text-sm leading-6 text-neutral-600">
                      {subscriptionSummary.status === "SUBSCRIBED"
                        ? "Your email is on the list. Use the actions below to manage preferences."
                        : subscriptionSummary.status === "VERIFICATION_NEEDED"
                          ? "Your signup is saved, but verification is still required."
                          : "This email is opted out. Update preferences from the privacy actions page."}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {subscriptionSummary.status === "VERIFICATION_NEEDED" ? (
                      <Button type="button" disabled className="h-11 rounded-none bg-neutral-200 px-5 text-sm font-normal text-neutral-500 shadow-none">
                        Send Verification
                      </Button>
                    ) : (
                      <Button asChild className="h-11 rounded-none bg-neutral-950 px-5 text-sm font-normal text-white shadow-none hover:bg-neutral-800">
                        <Link to={PRIVACY_ACTIONS_HREF}>Manage Subscription</Link>
                      </Button>
                    )}

                    {subscriptionSummary.status === "SUBSCRIBED" ? (
                      <Button asChild variant="outline" className="h-11 rounded-none border-neutral-300 bg-white px-5 text-sm font-normal text-neutral-900 shadow-none hover:bg-neutral-50">
                        <Link to={PRIVACY_UNSUBSCRIBE_HREF}>Unsubscribe</Link>
                      </Button>
                    ) : null}
                  </div>
                </div>

                {subscriptionSummary.status === "VERIFICATION_NEEDED" ? (
                  <p className="mt-4 text-xs leading-5 text-neutral-500">Action not connected yet.</p>
                ) : null}
              </div>
            ) : optedOutForEmail ? (
              <p className="mt-8 border-l border-rose-500 pl-4 text-sm leading-6 text-rose-700">
                This email address is already opted out. Use the privacy page unsubscribe form to update preferences.
              </p>
            ) : null}
          </form>
        </div>
      </div>
    </section>
  );
}
