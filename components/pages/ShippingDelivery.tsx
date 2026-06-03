"use client";

import LegalPageLayout from "./LegalPageLayout";

const sections = [
  {
    title: "Processing time",
    body:
      "Orders are usually processed within 1 to 2 business days after payment confirmation. During launches, sale periods, or high-volume weekends, processing may take a little longer.",
  },
  {
    title: "Shipping methods",
    body:
      "We ship through trusted courier partners selected for speed, tracking, and service reliability. The delivery method shown at checkout may vary based on your location and the products in your cart.",
  },
  {
    title: "Delivery estimates",
    body:
      "Estimated delivery times are shown during checkout and may vary by city, state, public holidays, weather, or courier delays. Delivery windows are estimates, not guarantees.",
  },
  {
    title: "Tracking",
    body:
      "Once your order ships, you will receive tracking details by email or SMS. You can use the tracking link to monitor the shipment status and estimated arrival date.",
  },
  {
    title: "Address accuracy",
    body:
      "Please ensure your shipping address, phone number, and landmark details are complete and accurate before placing the order. We are not responsible for delays caused by incomplete or incorrect address information.",
  },
  {
    title: "Undeliverable or delayed orders",
    body:
      "If a shipment cannot be delivered because of repeated failed delivery attempts, refusal, or address issues, it may be returned to us. In such cases, support can help you with the next steps depending on the courier status.",
  },
  {
    title: "Contact",
    body:
      "For shipping help, tracking issues, or delivery concerns, contact hello@cevonne.com and share your order number so we can assist faster.",
  },
];

export default function ShippingDelivery() {
  return (
    <LegalPageLayout
      eyebrow="Shipping & Delivery"
      title="Shipping & Delivery"
      intro="This page explains how orders are processed, shipped, and delivered by Cevonne."
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
