"use client";

import { Facebook, Instagram, MapPin, ShieldCheck, Youtube } from "lucide-react";

import { Link } from "@/lib/router";
import { STATIC_ASSETS } from "@/lib/assets";

const pageLinks = [
  { label: "Privacy Policy", to: "/privacy-policy" },
  { label: "Terms & Conditions", to: "/terms" },
  { label: "Shipping & Delivery", to: "/shipping-delivery" },
  { label: "Cancellation & Return", to: "/cancellation-return" },
  { label: "Contact", to: "/contact" },
];

const helpLinks = [
  { label: "FAQs", to: "/contact" },
  { label: "Product Care", to: "/shipping-delivery" },
  { label: "Stores", to: "/search" },
];

const aboutLinks = [
  { label: "Our Story", to: "/contact" },
  { label: "Beauty & Culture", to: "/search" },
  { label: "La Maison", to: "/contact" },
  { label: "Sustainability", to: "/contact" },
  { label: "Latest News", to: "/search" },
  { label: "Ethics & Compliance", to: "/contact" },
  { label: "Careers", to: "/contact" },
];

const footerLegalLinks = [
  { label: "Sitemap", to: "/search" },
  { label: "Legal & privacy", to: "/privacy-policy" },
  { label: "Cookies", to: "/privacy-policy#cookies" },
];

const footerSocials = [
  { label: "Instagram", icon: Instagram },
  { label: "Facebook", icon: Facebook },
  { label: "YouTube", icon: Youtube },
];

const linkClass = "transition-colors hover:text-neutral-500";
const sectionTitleClass = "text-[9px] font-normal uppercase tracking-[0.2em] text-neutral-700";
const subheadingClass = "text-[9px] font-normal uppercase tracking-[0.2em] text-neutral-500";

export default function Footer() {
  return (
    <footer className="border-t border-neutral-200 bg-white text-[13px] text-neutral-950">
      <div className="mx-auto max-w-[1680px] px-6 sm:px-10 lg:px-14">
        <div className="grid gap-12 py-14 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1.35fr] lg:gap-x-16 lg:gap-y-0 lg:py-12">
          <div>
            <h2 className={sectionTitleClass}>Help</h2>
            <p className="mt-7 leading-6 text-neutral-950">
              You can <a className="underline underline-offset-4" href="tel:+911140000000">call</a> or{" "}
              <a className="underline underline-offset-4" href="mailto:hello@cevonne.com">email</a> us.
            </p>
            <ul className="mt-5 space-y-3.5 leading-6">
              {helpLinks.map((link) => (
                <li key={link.label}>
                  <Link className={linkClass} to={link.to}>{link.label}</Link>
                </li>
              ))}
            </ul>

            <div className="mt-8 border-t border-neutral-200 pt-5">
              <p className="max-w-[22rem] leading-6 text-neutral-600">
                Cevonne is a brand owned and operated by Marvella Cosmetics OPC Pvt Ltd, India.
              </p>
              <address className="mt-4 flex max-w-[24rem] items-start gap-3 not-italic leading-6 text-neutral-600">
                <MapPin className="mt-1 h-4 w-4 shrink-0 text-neutral-500" strokeWidth={1.5} aria-hidden="true" />
                <span>190, First Floor, Pocket B, Paschim Puri Extension, West Delhi, New Delhi 110063</span>
              </address>
            </div>
          </div>

          <div>
            <h2 className={sectionTitleClass}>Information</h2>
            <ul className="mt-7 space-y-3.5 leading-6">
              {pageLinks.map((link) => (
                <li key={link.label}>
                  <Link className={linkClass} to={link.to}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className={sectionTitleClass}>About Cevonne</h2>
            <ul className="mt-7 space-y-3.5 leading-6">
              {aboutLinks.map((link) => (
                <li key={link.label}>
                  <Link className={linkClass} to={link.to}>{link.label}</Link>
                </li>
              ))}
            </ul>

          </div>

          <div>
            <h2 className={sectionTitleClass}>Email sign-up</h2>
            <p className="mt-7 max-w-md leading-6">
              Sign up for Cevonne emails and receive the latest news from the Maison, including exclusive launches and new collections.
            </p>
            <p className="mt-7 leading-6">Follow Us</p>
            <div className="mt-3 flex items-center gap-5">
              {footerSocials.map(({ label, icon: Icon }) => (
                <a key={label} href="#" aria-label={label} className={linkClass}>
                  <Icon className="h-4 w-4" strokeWidth={1.5} />
                </a>
              ))}
            </div>

            <div className="mt-8 border-t border-neutral-200 pt-5">
              <h3 className={subheadingClass}>Contact</h3>
              <p className="mt-4 max-w-md leading-6 text-neutral-700">
                For order support and brand enquiries, email{" "}
                <a className="underline decoration-neutral-400 underline-offset-4 transition-colors hover:decoration-neutral-950" href="mailto:hello@cevonne.com">
                  hello@cevonne.com
                </a>
                .
              </p>
              <p className="mt-4 max-w-md leading-6 text-neutral-700">
                Use the <Link className="underline decoration-neutral-400 underline-offset-4 transition-colors hover:decoration-neutral-950" to="/contact">Contact page</Link> for legal notices, partnership requests, and office details.
              </p>

              <div className="mt-5 flex items-start gap-3 border border-neutral-200 p-4">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-neutral-500" strokeWidth={1.5} aria-hidden="true" />
                <div>
                  <p className="font-medium text-neutral-950">Official company</p>
                  <p className="mt-1 leading-6 text-neutral-700">Marvella Cosmetics OPC Pvt Ltd</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-neutral-200 py-7">
          <div className="flex flex-col gap-6 text-[12px] sm:flex-row sm:items-center sm:justify-between">
            <p className="text-neutral-700">© Marvella Cosmetics OPC Pvt Ltd</p>
            <nav className="flex flex-wrap items-center gap-x-6 gap-y-2" aria-label="Footer legal links">
              {footerLegalLinks.map((link) => (
                <Link key={link.label} to={link.to} className={linkClass}>{link.label}</Link>
              ))}
            </nav>
          </div>

          <div className="mt-9 flex justify-center">
            <Link to="/" aria-label="Cevonne home">
              <img
                src={STATIC_ASSETS.logoMain}
                alt="Cevonne"
                draggable={false}
                className="h-6 w-auto select-none object-contain sm:h-7"
              />
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
