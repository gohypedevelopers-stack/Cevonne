"use client";

import LegalPageLayout from "./LegalPageLayout";

const sections = [
  {
    title: "Cancellation window",
    body:
      "You may request cancellation before the order is packed or shipped. Once an order has been processed for dispatch, cancellation may no longer be possible.",
  },
  {
    title: "Returns eligibility",
    body:
      "Returns are generally accepted for unused, unopened products in their original packaging, subject to inspection and the conditions shared by our support team. Certain hygiene-sensitive items may be non-returnable once opened.",
  },
  {
    title: "Damaged or incorrect items",
    body:
      "If you receive a damaged, defective, or incorrect item, contact us within 48 hours of delivery with your order number and clear photos of the product and packaging.",
  },
  {
    title: "Refunds and replacements",
    body:
      "Approved returns may be refunded to the original payment method or replaced, depending on the product condition and stock availability. Refund timelines may vary by payment provider and bank processing times.",
  },
  {
    title: "Return shipping",
    body:
      "Where a return is approved, we will share the return instructions and any applicable pickup or courier details. Please retain proof of handover until the return is completed.",
  },
  {
    title: "Non-returnable situations",
    body:
      "We may not accept returns for products that are opened, used, damaged after delivery, missing original packaging, or reported outside the stated support window.",
  },
  {
    title: "Contact",
    body:
      "To request a cancellation, return, or replacement, email hello@cevonne.com with your order number and a short description of the issue.",
  },
];

export default function CancellationReturn() {
  return (
    <LegalPageLayout
      eyebrow="Cancellation & Return"
      title="Cancellation & Return"
      intro="This page outlines the cancellation, return, refund, and replacement process for Cevonne orders."
      updated="April 30, 2026"
    >
      <div className="space-y-8">
        {sections.map((section) => (
          <section key={section.title} className="space-y-3">
            <h2 className="text-xl font-semibold text-neutral-950">{section.title}</h2>
            <p className="text-sm leading-7 text-neutral-700 sm:text-base">{section.body}</p>
          </section>
        ))}
      </div>
    </LegalPageLayout>
  );
}
