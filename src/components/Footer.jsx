import React, { useState } from "react";
import logo from "@/assets/logos/cevonne_main_logo.png";
import { Link } from "react-router-dom";
import { useLanguage } from "@/context/LanguageContext";
import { Check, ChevronUp } from "lucide-react";

export default function Footer() {
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const { language, setLanguage, supportedLanguages } = useLanguage();

  const currentLang = supportedLanguages.find((lang) => lang.code === language);

  const handleLanguageChange = (langCode) => {
    setLanguage(langCode);
    setShowLanguageDropdown(false);
  };

  return (
    <footer className="border-t bg-white text-neutral-900">
      <div className="mx-auto max-w-screen-2xl px-6 md:px-10 lg:px-14">
        <div className="grid gap-10 py-14 lg:grid-cols-[1.25fr_0.7fr_1fr]">
          <div className="space-y-4">
            <Link to="/" className="inline-flex items-center">
              <img src={logo} alt="Cevonne" className="h-10 w-auto lg:h-12" />
            </Link>
            <p className="max-w-md text-sm leading-7 text-neutral-700">
              Cevonne is a brand owned and operated by Marvella Cosmetics OPC Pvt Ltd, India.
            </p>
            <div className="space-y-1 text-sm leading-7 text-neutral-700">
              <p className="font-medium text-neutral-900">Address</p>
              <address className="not-italic">
                190, First Floor, Pocket B, Paschim Puri Extension, West Delhi, New Delhi 110063
              </address>
            </div>
          </div>

          <div>
            <h6 className="mb-4 text-[10px] uppercase tracking-[0.22em] text-neutral-500">
              Pages
            </h6>
            <ul className="space-y-3 text-sm text-neutral-700">
              <li>
                <Link to="/privacy-policy" className="hover:underline underline-offset-2">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="hover:underline underline-offset-2">
                  Terms
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:underline underline-offset-2">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h6 className="mb-4 text-[10px] uppercase tracking-[0.22em] text-neutral-500">
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
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
              <p className="font-medium text-neutral-900">Official company</p>
              <p className="mt-2">Marvella Cosmetics OPC Pvt Ltd</p>
            </div>
          </div>
        </div>

        <div className="border-t py-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="order-2 relative md:order-1">
              <button
                type="button"
                onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
                className="inline-flex items-center gap-2 text-sm text-neutral-700 transition-colors duration-200 hover:text-black"
                style={{
                  fontFamily: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
                }}
                aria-label="Change language"
              >
                <GlobeIcon className="h-4 w-4" />
                <span>{currentLang?.nativeName || "English"}</span>
                <ChevronUp
                  className={`h-3 w-3 transition-transform duration-200 ${
                    showLanguageDropdown ? "" : "rotate-180"
                  }`}
                />
              </button>

              {showLanguageDropdown ? (
                <div className="absolute bottom-full left-0 mb-2 min-w-[180px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200">
                  {supportedLanguages.map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => handleLanguageChange(lang.code)}
                      className={`flex w-full items-center justify-between px-4 py-3 text-sm transition-colors duration-150 ${
                        language === lang.code
                          ? "bg-slate-50 text-slate-900"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                      style={{
                        fontFamily:
                          '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
                      }}
                    >
                      <span className="font-medium">{lang.nativeName}</span>
                      {language === lang.code ? <Check className="h-4 w-4 text-slate-700" /> : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div
              className="order-1 text-sm leading-7 text-neutral-700 md:order-2 md:text-center"
              style={{
                fontFamily: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
              }}
            >
              <p>© Marvella Cosmetics OPC Pvt Ltd</p>
              <p>190, First Floor, Pocket B, Paschim Puri Extension, West Delhi, New Delhi 110063</p>
            </div>

            <nav
              className="order-3 flex flex-wrap items-center gap-5 text-sm text-neutral-700 md:justify-end"
              style={{
                fontFamily: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
              }}
            >
              <Link to="/privacy-policy" className="hover:underline underline-offset-2">
                Privacy Policy
              </Link>
              <Link to="/terms" className="hover:underline underline-offset-2">
                Terms
              </Link>
              <Link to="/contact" className="hover:underline underline-offset-2">
                Contact
              </Link>
            </nav>
          </div>
        </div>
      </div>
    </footer>
  );
}

function GlobeIcon({ className = "h-4 w-4" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M3 12h18M12 3c2.5 2.8 3.75 6.2 3.75 9s-1.25 6.2-3.75 9c-2.5-2.8-3.75-6.2-3.75-9s1.25-6.2 3.75-9Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}
