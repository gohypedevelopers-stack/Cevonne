"use client";

import { useEffect, useState, type FormEvent } from "react";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getCevonneConsentState,
  getCevonneResponseMessage,
  isEmailOptedOut,
  postCevonneRoute,
  setCevonneConsentState,
} from "@/lib/cevonne/client";

export default function MarketingOptOutForm() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const state = getCevonneConsentState();
    if (state?.email) {
      setEmail((current) => current || state.email);
    }
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      toast.error("Enter the email address to unsubscribe.");
      return;
    }

    if (isEmailOptedOut(trimmedEmail)) {
      toast.info("This email is already unsubscribed.");
      return;
    }

    setSubmitting(true);
    try {
      const consentState = getCevonneConsentState();
      const response = await postCevonneRoute("/cevonne/opt-out", {
        email: trimmedEmail,
        contact_id: consentState?.contactId || undefined,
        channel: "EMAIL",
        opt_out_source: "website_unsubscribe",
        source_event: "website_unsubscribe",
      });

      if (response.status === "BLOCK" || response.status === "ERROR") {
        toast.error(getCevonneResponseMessage(response));
        return;
      }

      setCevonneConsentState({
        email: trimmedEmail,
        marketingConsent: false,
        trackingConsent: false,
        optedOut: true,
        optedOutEmail: trimmedEmail,
        optedOutAt: new Date().toISOString(),
      });

      if (response.status === "MANUAL_ONLY") {
        toast.info("Your unsubscribe request was received for manual review.");
      } else {
        toast.success("You have been unsubscribed.");
      }
    } catch (error) {
      console.error("Opt-out form failed", error);
      toast.error(error instanceof Error ? error.message : "Unable to unsubscribe.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-[28px] border border-neutral-200 bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-neutral-500">
          Unsubscribe
        </p>
        <h3 className="text-xl font-semibold text-neutral-950">Stop marketing emails</h3>
        <p className="text-sm leading-7 text-neutral-700">
          Use this form to block future marketing messages for this email address. The G3 opt-out record will suppress future messages where applicable.
        </p>
      </div>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="unsubscribe-email" className="text-sm font-medium text-neutral-900">
            Email address
          </Label>
          <Input
            id="unsubscribe-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            disabled={submitting}
            required
            className="h-11 rounded-xl border-neutral-300 bg-white placeholder:text-neutral-400"
          />
        </div>

        <Button
          type="submit"
          disabled={submitting}
          className="h-11 rounded-full bg-neutral-950 px-5 text-sm font-semibold text-white hover:bg-neutral-800"
        >
          {submitting ? "Saving..." : "Unsubscribe"}
        </Button>
      </form>
    </section>
  );
}
