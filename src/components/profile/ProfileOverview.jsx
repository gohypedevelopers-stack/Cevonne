import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Package, User, RotateCcw, Lock, Languages, Pencil, ChevronRight, Globe, Check, Activity } from "lucide-react";
import { useProfileUser } from "@/hooks/useProfileUser";
import { useUserOrders } from "@/hooks/useUserOrders";
import { readAddresses } from "@/lib/addressStorage";
import { useLanguage } from "@/context/LanguageContext";

export default function ProfileOverview() {
  const { profile } = useProfileUser();
  const { orders = [] } = useUserOrders();
  const [addresses, setAddresses] = useState([]);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const { t, language, setLanguage, supportedLanguages } = useLanguage();

  useEffect(() => {
    setAddresses(readAddresses());
  }, []);

  const totalOrders = Array.isArray(orders) ? orders.length : 0;
  const addressCount = Array.isArray(addresses) ? addresses.length : 0;
  const displayName = profile?.name || "Guest";
  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString()
    : null;

  const handleLanguageChange = (langCode) => {
    setLanguage(langCode);
    setShowLanguageModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Activity Status Header */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
        {/* Subtle gradient accent from palette */}
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--primary-100)] via-white to-[var(--secondary-100)] pointer-events-none opacity-50" />

        <div className="relative p-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="h-5 w-5 text-[var(--primary)]" />
              <h2 className="text-lg font-bold text-[var(--primary)]">{t("profile.activityStatus")}</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard
                label={t("profile.orders")}
                value={totalOrders}
                icon={<Package className="h-5 w-5 text-[var(--primary-400)]" />}
                gradient="from-[var(--primary-300)] to-[var(--primary)]"
                bg="bg-[var(--primary-100)]"
              />
              <StatCard
                label={t("profile.addresses")}
                value={addressCount}
                icon={<Globe className="h-5 w-5 text-[var(--secondary-400)]" />}
                gradient="from-[var(--secondary-300)] to-[var(--secondary)]"
                bg="bg-[var(--secondary-100)]"
              />
              <StatCard
                label={t("profile.status")}
                value={t("profile.active")}
                icon={<Check className="h-5 w-5 text-[var(--primary)]" />}
                gradient="from-[var(--primary-200)] to-[var(--primary-400)]"
                bg="bg-[var(--muted)]"
              />
            </div>

            {memberSince && (
              <p className="text-xs text-[var(--muted-foreground)] text-center md:text-right mt-2">
                {t("profile.memberSince", { date: memberSince })}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Actions Menu */}
      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
        <div className="px-6 py-4 border-b border-[var(--border)] bg-gradient-to-r from-[var(--accent)] to-white">
          <p className="text-sm font-bold text-[var(--primary)]">{t("profile.accountOverview")}</p>
        </div>
        <div className="divide-y divide-[var(--border)]">
          <ProfileRow
            to="/profile/settings"
            icon={<RotateCcw className="h-5 w-5" />}
            label={t("profile.refund")}
            helper={t("profile.requestSupport")}
            iconBg="bg-[var(--accent)] text-[var(--primary-400)]"
          />
          <ProfileRow
            to="/profile/settings"
            icon={<Lock className="h-5 w-5" />}
            label={t("profile.changePassword")}
            helper={t("profile.secureAccount")}
            iconBg="bg-[var(--accent)] text-[var(--primary-400)]"
          />

          {/* Language Row */}
          <button
            onClick={() => setShowLanguageModal(true)}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-[var(--accent)] transition-all duration-200 group"
          >
            <div className="flex items-center gap-4">
              <div className="h-11 w-11 rounded-2xl bg-[var(--primary-100)] text-[var(--primary)] flex items-center justify-center shadow-sm transition-transform duration-200 group-hover:scale-105">
                <Languages className="h-5 w-5" />
              </div>
              <div className="min-w-0 text-left">
                <p className="text-sm font-semibold text-[var(--primary)]">{t("profile.changeLanguage")}</p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {supportedLanguages.find(l => l.code === language)?.nativeName || "English"}
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-[var(--muted-foreground)] transition-transform duration-200 group-hover:translate-x-1" />
          </button>
        </div>
      </div>

      {/* Language Selection Modal */}
      {showLanguageModal && (
        <LanguageModal
          isOpen={showLanguageModal}
          onClose={() => setShowLanguageModal(false)}
          currentLanguage={language}
          languages={supportedLanguages}
          onSelect={handleLanguageChange}
          t={t}
        />
      )}
    </div>
  );
}

function ProfileRow({ to, icon, label, helper, iconBg = "bg-[var(--secondary-100)] text-[var(--secondary-foreground)]" }) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between px-6 py-4 hover:bg-[var(--accent)] transition-all duration-200 group"
    >
      <div className="flex items-center gap-4">
        <div className={`h-11 w-11 rounded-2xl ${iconBg} flex items-center justify-center shadow-sm transition-transform duration-200 group-hover:scale-105`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--primary)]">{label}</p>
          {helper && <p className="text-xs text-[var(--muted-foreground)]">{helper}</p>}
        </div>
      </div>
      <ChevronRight className="h-5 w-5 text-[var(--muted-foreground)] transition-transform duration-200 group-hover:translate-x-1" />
    </Link>
  );
}

function StatCard({ label, value, gradient, icon, bg }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 group">
      {/* Gradient accent bar */}
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${gradient}`} />

      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-[var(--primary)] mt-1">{value}</p>
        </div>
        <div className={`h-10 w-10 rounded-full ${bg} flex items-center justify-center transition-transform duration-300 group-hover:scale-110`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function LanguageModal({ isOpen, onClose, currentLanguage, languages, onSelect, t }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-[var(--card)] rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-[var(--border)]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border)] bg-gradient-to-r from-[var(--primary-100)] to-white">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[var(--primary-400)] to-[var(--primary)] text-white flex items-center justify-center">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[var(--primary)]">{t("profile.selectLanguage")}</h3>
              <p className="text-xs text-[var(--muted-foreground)]">{t("settings.languageDescription")}</p>
            </div>
          </div>
        </div>

        {/* Language Options */}
        <div className="py-2 max-h-[60vh] overflow-y-auto bg-white">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => onSelect(lang.code)}
              className={`w-full flex items-center justify-between px-6 py-4 transition-all duration-200 ${currentLanguage === lang.code
                  ? "bg-[var(--primary-100)]"
                  : "hover:bg-[var(--accent)]"
                }`}
            >
              <div className="flex items-center gap-4">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-lg font-semibold ${currentLanguage === lang.code
                    ? "bg-gradient-to-br from-[var(--primary-400)] to-[var(--primary)] text-white"
                    : "bg-[var(--muted)] text-[var(--muted-foreground)]"
                  }`}>
                  {lang.code.toUpperCase().slice(0, 2)}
                </div>
                <div className="text-left">
                  <p className={`text-sm font-semibold ${currentLanguage === lang.code ? "text-[var(--primary)]" : "text-[var(--foreground)]"
                    }`}>
                    {lang.nativeName}
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)]">{lang.name}</p>
                </div>
              </div>
              {currentLanguage === lang.code && (
                <div className="h-6 w-6 rounded-full bg-gradient-to-br from-[var(--primary-400)] to-[var(--primary)] text-white flex items-center justify-center">
                  <Check className="h-4 w-4" />
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--border)] bg-[var(--accent)]">
          <button
            onClick={onClose}
            className="w-full py-2.5 px-4 text-sm font-medium text-[var(--primary)] bg-[var(--card)] border border-[var(--border)] rounded-xl hover:bg-[var(--secondary-100)] transition-colors duration-200"
          >
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
