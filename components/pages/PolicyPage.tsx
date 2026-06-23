"use client";

import LegalPageLayout from "./LegalPageLayout";
import MarketingOptOutForm from "@/components/forms/MarketingOptOutForm";
import PrivacyRequestForm from "@/components/forms/PrivacyRequestForm";

const sections = [
  {
    title: "Information we collect",
    body:
      "We collect information you provide directly to us when you create an account, place an order, subscribe to emails, or contact support. This can include your name, email address, phone number, shipping address, billing details, and the content of messages you send us.",
  },
  {
    title: "How we use information",
    body:
      "We use personal information to process orders, deliver products, manage accounts, send service messages, respond to enquiries, improve the website, prevent fraud, and comply with legal obligations.",
  },
  {
    title: "Sharing information",
    body:
      "We may share information with payment processors, logistics partners, email providers, analytics tools, and service providers that help us operate the website and fulfil orders. We may also disclose information when required by law or to protect our rights.",
  },
  {
    title: "Cookies and analytics",
    body:
      "We may use cookies and similar technologies to remember preferences, measure traffic, and improve site performance. You can manage cookies through your browser settings, but some parts of the site may not function as intended if cookies are disabled.",
  },
  {
    title: "Data retention and security",
    body:
      "We retain personal information only as long as needed for the purposes described in this policy or as required by law. We use reasonable administrative, technical, and physical safeguards to protect the information we store, but no online system is completely secure.",
  },
  {
    title: "Your choices",
    body:
      "You can request access, correction, or deletion of your personal information by contacting us. You may also opt out of marketing emails by using the unsubscribe link in those messages.",
  },
  {
    title: "Contact",
    body:
      "If you have questions about this Privacy Policy, contact us at hello@cevonne.com or visit the Contact page for our office details.",
  },
];

export default function PolicyPage() {
  return (
    <LegalPageLayout
      eyebrow="Privacy Policy"
      title="Privacy Policy"
      intro="This policy explains how Cevonne and Marvella Cosmetics OPC Pvt Ltd collect and use personal information on this website."
      updated="April 30, 2026"
    >
      <div className="space-y-8">
        {sections.map((section) => (
          <section key={section.title} className="space-y-3">
            <h2 className="text-xl font-semibold text-neutral-950">{section.title}</h2>
            <p className="text-sm leading-7 text-neutral-700 sm:text-base">{section.body}</p>
          </section>
        ))}

        <section id="privacy-actions" className="space-y-4 border-t border-neutral-200 pt-8">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-neutral-950">Privacy actions</h2>
            <p className="max-w-3xl text-sm leading-7 text-neutral-700 sm:text-base">
              Use these forms to request an export, request manual review for deletion, or unsubscribe from marketing emails. Destructive deletion remains manual-only until exact production mappings are confirmed.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <PrivacyRequestForm />
            <MarketingOptOutForm />
          </div>
        </section>
      </div>
    </LegalPageLayout>
  );
}
