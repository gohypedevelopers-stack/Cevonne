import { Mail, MapPin } from "lucide-react";
import LegalPageLayout from "./LegalPageLayout";

const address =
  "190, First Floor, Pocket B, Paschim Puri Extension, West Delhi, New Delhi 110063";

export default function Contact() {
  return (
    <LegalPageLayout
      eyebrow="Contact"
      title="Contact Cevonne"
      intro="Reach us for order support, brand enquiries, partnership requests, or legal notices."
      updated="April 30, 2026"
    >
      <div className="grid gap-6 md:grid-cols-2">
        <article className="rounded-[28px] border border-neutral-200 bg-neutral-50 p-6">
          <div className="flex items-center gap-3">
            <MapPin className="h-5 w-5 text-neutral-900" />
            <h2 className="text-lg font-semibold text-neutral-950">Office address</h2>
          </div>
          <p className="mt-4 text-sm leading-7 text-neutral-700 sm:text-base">{address}</p>
        </article>

        <article className="rounded-[28px] border border-neutral-200 bg-neutral-50 p-6">
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-neutral-900" />
            <h2 className="text-lg font-semibold text-neutral-950">Email</h2>
          </div>
          <a
            href="mailto:hello@cevonne.com"
            className="mt-4 inline-block text-sm font-medium text-neutral-900 underline underline-offset-4 hover:text-neutral-600 sm:text-base"
          >
            hello@cevonne.com
          </a>
          <p className="mt-3 text-sm leading-7 text-neutral-700 sm:text-base">
            Use this address for general enquiries, order support, and partnership requests.
          </p>
        </article>
      </div>

      <section className="mt-6 rounded-[28px] border border-neutral-200 p-6">
        <h2 className="text-lg font-semibold text-neutral-950">Business information</h2>
        <p className="mt-4 text-sm leading-7 text-neutral-700 sm:text-base">
          Cevonne is a brand owned and operated by Marvella Cosmetics OPC Pvt Ltd, India.
        </p>
      </section>
    </LegalPageLayout>
  );
}
