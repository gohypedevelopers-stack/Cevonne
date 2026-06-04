"use client";

import React, { useState } from "react";
import { Link } from "@/lib/router";
import { useLanguage } from "@/context/LanguageContext";
import {
  Check,
  ChevronDown,
  Facebook,
  Globe,
  Instagram,
  MapPin,
  ShieldCheck,
  Youtube,
} from "lucide-react";
import { STATIC_ASSETS } from "@/lib/assets";

const footerPages = [
  { label: "Privacy Policy", to: "/privacy-policy" },
  { label: "Terms & Conditions", to: "/terms" },
  { label: "Shipping & Delivery", to: "/shipping-delivery" },
  { label: "Cancellation & Return", to: "/cancellation-return" },
  { label: "Contact", to: "/contact" },
];

const footerSocials = [
  { label: "Instagram", icon: Instagram },
  { label: "Facebook", icon: Facebook },
  { label: "YouTube", icon: Youtube },
];

export default function Footer() {
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const { language, setLanguage, supportedLanguages } = useLanguage();

  const currentLang = supportedLanguages.find((lang) => lang.code === language);

  const handleLanguageChange = (langCode) => {
    setLanguage(langCode);
    setShowLanguageDropdown(false);
  };

  return (
    <footer className="border-t border-neutral-200 bg-white text-neutral-900">
      <div className="mx-auto max-w-screen-2xl px-6 md:px-10 lg:px-14">
        <div className="grid gap-12 py-12 lg:grid-cols-[1.25fr_0.8fr_1fr] lg:gap-16 lg:py-14">
          <div className="space-y-5">
            <Link to="/" className="inline-flex items-center">
              <img
                src={STATIC_ASSETS.logoMain}
                alt="Cevonne"
                className="h-6 w-auto object-contain md:h-7 lg:h-8"
              />
            </Link>
            <p className="max-w-md text-sm leading-7 text-neutral-700">
              Cevonne is a brand owned and operated by Marvella Cosmetics OPC Pvt Ltd, India.
            </p>
            <div className="flex items-start gap-3 text-sm leading-7 text-neutral-700">
              <MapPin className="mt-1 h-4 w-4 shrink-0 text-neutral-500" />
              <address className="not-italic">
                190, First Floor, Pocket B, Paschim Puri Extension, West Delhi, New Delhi 110063
              </address>
            </div>
          </div>

          <div>
            <h6 className="mb-4 text-[10px] uppercase tracking-[0.28em] text-neutral-500">
              Pages
            </h6>
            <ul className="space-y-3 text-sm leading-7 text-neutral-700">
              {footerPages.map((page) => (
                <li key={page.to}>
                  <Link to={page.to} className="transition-colors hover:text-neutral-900 hover:underline underline-offset-2">
                    {page.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-5">
            <h6 className="mb-4 text-[10px] uppercase tracking-[0.28em] text-neutral-500">
              Contact
            </h6>
            <p className="text-sm leading-7 text-neutral-700">
              For order support and brand enquiries, email{" "}
              <a
                href="mailto:hello@cevonne.com"
                className="underline underline-offset-2 hover:no-underline"
              >
                hello@cevonne.com
              </a>
              .
            </p>
            <p className="text-sm leading-7 text-neutral-700">
              Use the Contact page for legal notices, partnership requests, and office details.
            </p>
            <div className="flex items-start gap-4 rounded-2xl border border-neutral-200 bg-neutral-50/80 px-4 py-4 shadow-[0_1px_0_rgba(17,24,39,0.02)]">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-neutral-500" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-neutral-900">Official company</p>
                <p className="text-sm leading-6 text-neutral-700">Marvella Cosmetics OPC Pvt Ltd</p>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-neutral-200 py-5">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="relative order-1">
              <button
                type="button"
                onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
                className="inline-flex items-center gap-2 text-sm text-neutral-700 transition-colors duration-200 hover:text-neutral-900"
                aria-label="Change language"
              >
                <Globe className="h-4 w-4" />
                <span>{currentLang?.nativeName || "English"}</span>
                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${showLanguageDropdown ? "rotate-180" : ""}`} />
              </button>

              {showLanguageDropdown ? (
                <div className="absolute bottom-full left-0 mb-2 min-w-[180px] overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200">
                  {supportedLanguages.map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => handleLanguageChange(lang.code)}
                      className={`flex w-full items-center justify-between px-4 py-3 text-sm transition-colors duration-150 ${
                        language === lang.code
                          ? "bg-neutral-50 text-neutral-900"
                          : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                      }`}
                    >
                      <span className="font-medium">{lang.nativeName}</span>
                      {language === lang.code ? <Check className="h-4 w-4 text-neutral-700" /> : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div
              className="order-2 text-sm leading-7 text-neutral-700 md:flex-1 md:text-center"
            >
              <p>© Marvella Cosmetics OPC Pvt Ltd</p>
            </div>

            <div className="order-3 flex items-center gap-5 text-neutral-700 md:justify-end">
              {footerSocials.map(({ label, icon: Icon }) => (
                <button
                  key={label}
                  type="button"
                  aria-label={label}
                  className="inline-flex items-center justify-center transition-colors duration-200 hover:text-neutral-900"
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
