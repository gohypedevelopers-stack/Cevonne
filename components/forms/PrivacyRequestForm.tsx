"use client";

import { useEffect, useState, type FormEvent } from "react";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getCevonneConsentState,
  getCevonneResponseMessage,
  postCevonneRoute,
} from "@/lib/cevonne/client";

const REQUEST_TYPES = [
  { label: "Export my data", value: "EXPORT" },
  { label: "Delete my data", value: "DELETE" },
  { label: "Correct my data", value: "CORRECT" },
];

export default function PrivacyRequestForm() {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [requestType, setRequestType] = useState("EXPORT");
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
    const trimmedPhone = phone.trim();

    if (!trimmedEmail && !trimmedPhone) {
      toast.error("Add an email address or phone number.");
      return;
    }

    setSubmitting(true);
    try {
      const consentState = getCevonneConsentState();
      const response = await postCevonneRoute("/cevonne/privacy-request", {
        request_type: requestType,
        email: trimmedEmail || undefined,
        phone: trimmedPhone || undefined,
        contact_id: consentState?.contactId || undefined,
        source_event: "privacy_request_form",
      });

      if (response.status === "BLOCK" || response.status === "ERROR") {
        toast.error(getCevonneResponseMessage(response));
        return;
      }

      if (response.status === "MANUAL_ONLY") {
        toast.info("Your privacy request was received for manual review.");
      } else {
        toast.success("Your privacy request was submitted.");
      }
      setPhone("");
      setRequestType("EXPORT");
    } catch (error) {
      console.error("Privacy request form failed", error);
      toast.error(error instanceof Error ? error.message : "Unable to submit the privacy request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-[28px] border border-neutral-200 bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-neutral-500">
          Privacy request
        </p>
        <h3 className="text-xl font-semibold text-neutral-950">Request export or deletion review</h3>
        <p className="text-sm leading-7 text-neutral-700">
          Submit privacy support requests here. Destructive deletion stays manual-only until the exact production table mappings are confirmed.
        </p>
      </div>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="privacy-request-type" className="text-sm font-medium text-neutral-900">
            Request type
          </Label>
          <Select value={requestType} onValueChange={setRequestType}>
            <SelectTrigger
              id="privacy-request-type"
              className="h-11 !w-full rounded-xl border-neutral-300 bg-white"
            >
              <SelectValue placeholder="Choose a request type" />
            </SelectTrigger>
            <SelectContent>
              {REQUEST_TYPES.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="privacy-email" className="text-sm font-medium text-neutral-900">
              Email address
            </Label>
            <Input
              id="privacy-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              disabled={submitting}
              className="h-11 rounded-xl border-neutral-300 bg-white placeholder:text-neutral-400"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="privacy-phone" className="text-sm font-medium text-neutral-900">
              Phone number
            </Label>
            <Input
              id="privacy-phone"
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+91 98765 43210"
              disabled={submitting}
              className="h-11 rounded-xl border-neutral-300 bg-white placeholder:text-neutral-400"
            />
          </div>
        </div>

        <Button
          type="submit"
          disabled={submitting}
          className="h-11 rounded-full bg-neutral-950 px-5 text-sm font-semibold text-white hover:bg-neutral-800"
        >
          {submitting ? "Submitting..." : "Submit request"}
        </Button>
      </form>
    </section>
  );
}
