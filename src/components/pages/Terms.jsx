import LegalPageLayout from "./LegalPageLayout";

const sections = [
  {
    title: "Acceptance of terms",
    body:
      "By accessing or using the Cevonne website, you agree to these Terms and to any additional policies or guidelines posted on the site. If you do not agree, please do not use the website.",
  },
  {
    title: "Products, pricing, and orders",
    body:
      "Product descriptions, images, pricing, and availability are provided for convenience and may change without notice. We reserve the right to cancel or refuse an order if there is a stock issue, pricing error, or suspected fraud.",
  },
  {
    title: "Payments, shipping, and returns",
    body:
      "Orders are subject to payment confirmation and shipping terms displayed at checkout. Shipping timelines are estimates, and returns or replacements are handled according to the return policy published on the site or shared by our support team.",
  },
  {
    title: "Account responsibility",
    body:
      "If you create an account, you are responsible for keeping your login details secure and for activity that happens under your account. Please notify us if you believe your account has been compromised.",
  },
  {
    title: "Intellectual property",
    body:
      "All content on this website, including product imagery, text, graphics, logos, and site design, is owned by or licensed to Cevonne and Marvella Cosmetics OPC Pvt Ltd unless stated otherwise. You may not copy, reproduce, or distribute content without permission.",
  },
  {
    title: "Prohibited use",
    body:
      "You agree not to misuse the website, interfere with its operation, attempt unauthorised access, or use the site for unlawful, deceptive, or harmful activity.",
  },
  {
    title: "Changes and contact",
    body:
      "We may update these Terms from time to time to reflect operational, legal, or regulatory changes. If you have questions, email hello@cevonne.com or use the Contact page.",
  },
];

export default function Terms() {
  return (
    <LegalPageLayout
      eyebrow="Terms"
      title="Terms and Conditions"
      intro="These terms govern your use of the Cevonne website and online store."
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
