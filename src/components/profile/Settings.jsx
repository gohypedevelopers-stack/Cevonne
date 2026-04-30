import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useProfileUser } from "@/hooks/useProfileUser";
import { toast } from "sonner";
import { useLanguage } from "@/context/LanguageContext";
import { Globe, Check, ChevronDown } from "lucide-react";

export default function Settings() {
    const { profile, loading, updateProfile } = useProfileUser();
    const { t, language, setLanguage, supportedLanguages } = useLanguage();
    const [saving, setSaving] = useState(false);
    const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
    const [form, setForm] = useState({
        name: "",
        email: "",
        lastName: "",
        phone: "",
    });

    useEffect(() => {
        if (profile) {
            setForm((prev) => ({
                ...prev,
                name: profile.name || "",
                email: profile.email || "",
            }));
        }
    }, [profile]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setSaving(true);
            await updateProfile({
                name: form.name,
                email: form.email,
            });
            toast.success("Profile updated");
        } catch (err) {
            toast.error(err?.message || "Unable to update profile");
        } finally {
            setSaving(false);
        }
    };

    const handleLanguageChange = (langCode) => {
        setLanguage(langCode);
        setShowLanguageDropdown(false);
        const langName = supportedLanguages.find(l => l.code === langCode)?.nativeName;
        toast.success(`Language changed to ${langName}`);
    };

    const currentLang = supportedLanguages.find(l => l.code === language);

    return (
        <form className="space-y-8" onSubmit={handleSubmit}>
            <div className="border-b border-[var(--border)] pb-6">
                <h1 className="text-2xl font-bold text-[var(--primary)]">{t("settings.accountSettings")}</h1>
                <p className="text-sm text-[var(--muted-foreground)] mt-1">{t("profile.editPersonalInfo")}</p>
            </div>

            <div className="space-y-8 max-w-2xl">
                {/* Personal Information Section */}
                <div className="space-y-5">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[var(--primary-400)] to-[var(--primary)] text-white flex items-center justify-center shadow-sm">
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                        </div>
                        <h2 className="text-lg font-semibold text-[var(--primary)]">{t("settings.personalInfo")}</h2>
                    </div>

                    <div className="grid gap-5 md:grid-cols-2 bg-[var(--muted)]/50 rounded-2xl p-5 border border-[var(--border)]">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-[var(--foreground)]">{t("settings.firstName")}</label>
                            <input
                                type="text"
                                value={form.name}
                                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                disabled={loading || saving}
                                className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-400)] focus:border-transparent disabled:opacity-60 transition-all duration-200"
                                placeholder={t("settings.yourName")}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-[var(--foreground)]">{t("settings.lastName")}</label>
                            <input
                                type="text"
                                value={form.lastName || ""}
                                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                                disabled
                                className="w-full rounded-xl border border-[var(--border)] bg-[var(--secondary-100)] px-4 py-3 text-sm text-[var(--muted-foreground)] focus:outline-none cursor-not-allowed"
                                placeholder={t("settings.lastNamePlaceholder")}
                            />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <label className="text-sm font-medium text-[var(--foreground)]">{t("settings.emailAddress")}</label>
                            <input
                                type="email"
                                value={form.email}
                                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                                disabled={loading || saving}
                                className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-400)] focus:border-transparent disabled:opacity-60 transition-all duration-200"
                                placeholder={t("settings.emailPlaceholder")}
                                required
                            />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <label className="text-sm font-medium text-[var(--foreground)]">{t("settings.phoneNumber")}</label>
                            <input
                                type="tel"
                                value={form.phone}
                                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                                disabled
                                className="w-full rounded-xl border border-[var(--border)] bg-[var(--secondary-100)] px-4 py-3 text-sm text-[var(--muted-foreground)] focus:outline-none cursor-not-allowed"
                                placeholder={t("settings.phonePlaceholder")}
                            />
                        </div>
                    </div>

                    <Button
                        type="submit"
                        disabled={loading || saving}
                        className="rounded-xl bg-gradient-to-r from-[var(--sidebar-primary)] to-[var(--primary-700)] text-white hover:from-[var(--primary-700)] hover:to-[var(--primary)] px-6 py-2.5 font-medium shadow-md transition-all duration-200 hover:shadow-lg disabled:opacity-70"
                    >
                        {saving ? t("settings.saving") : t("settings.saveChanges")}
                    </Button>
                </div>

                {/* Language Settings Section */}
                <div className="pt-6 border-t border-[var(--border)] space-y-5">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[var(--primary-400)] to-[var(--primary)] text-white flex items-center justify-center shadow-sm">
                            <Globe className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-[var(--primary)]">{t("settings.languageSettings")}</h2>
                            <p className="text-xs text-[var(--muted-foreground)]">{t("settings.languageDescription")}</p>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-[var(--primary-100)] to-[var(--secondary-100)] rounded-2xl p-5 border border-[var(--border)]">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-[var(--foreground)]">{t("settings.preferredLanguage")}</label>
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
                                    className="w-full flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-400)] focus:border-transparent transition-all duration-200 hover:border-[var(--primary-300)]"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[var(--primary-400)] to-[var(--primary)] text-white flex items-center justify-center text-xs font-semibold">
                                            {language === 'hi' ? 'हि' : language.toUpperCase().slice(0, 2)}
                                        </div>
                                        <div className="text-left">
                                            <p className="font-medium text-[var(--primary)]">{currentLang?.nativeName}</p>
                                            <p className="text-xs text-[var(--muted-foreground)]">{currentLang?.name}</p>
                                        </div>
                                    </div>
                                    <ChevronDown className={`h-5 w-5 text-[var(--muted-foreground)] transition-transform duration-200 ${showLanguageDropdown ? 'rotate-180' : ''}`} />
                                </button>

                                {/* Dropdown */}
                                {showLanguageDropdown && (
                                    <div className="absolute z-10 mt-2 w-full bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                        {supportedLanguages.map((lang) => (
                                            <button
                                                key={lang.code}
                                                type="button"
                                                onClick={() => handleLanguageChange(lang.code)}
                                                className={`w-full flex items-center justify-between px-4 py-3 transition-colors duration-150 ${language === lang.code
                                                    ? 'bg-[var(--primary-100)]'
                                                    : 'hover:bg-[var(--accent)]'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-xs font-semibold ${language === lang.code
                                                        ? 'bg-gradient-to-br from-[var(--primary-400)] to-[var(--primary)] text-white'
                                                        : 'bg-[var(--muted)] text-[var(--muted-foreground)]'
                                                        }`}>
                                                        {lang.code === 'hi' ? 'हि' : lang.code.toUpperCase().slice(0, 2)}
                                                    </div>
                                                    <div className="text-left">
                                                        <p className={`font-medium ${language === lang.code ? 'text-[var(--primary-700)]' : 'text-[var(--foreground)]'}`}>
                                                            {lang.nativeName}
                                                        </p>
                                                        <p className="text-xs text-[var(--muted-foreground)]">{lang.name}</p>
                                                    </div>
                                                </div>
                                                {language === lang.code && (
                                                    <Check className="h-5 w-5 text-[var(--primary)]" />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Password Section */}
                <div className="pt-6 border-t border-[var(--border)] space-y-5">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[var(--primary-700)] to-[var(--primary)] text-white flex items-center justify-center shadow-sm">
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                        <h2 className="text-lg font-semibold text-[var(--primary)]">{t("settings.changePassword")}</h2>
                    </div>

                    <div className="bg-[var(--muted)]/50 rounded-2xl p-5 border border-[var(--border)] space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-[var(--foreground)]">{t("settings.currentPassword")}</label>
                            <input
                                type="password"
                                disabled
                                className="w-full rounded-xl border border-[var(--border)] bg-[var(--secondary-100)] px-4 py-3 text-sm text-[var(--muted-foreground)] focus:outline-none cursor-not-allowed"
                                placeholder={t("settings.currentPasswordPlaceholder")}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-[var(--foreground)]">{t("settings.newPassword")}</label>
                            <input
                                type="password"
                                disabled
                                className="w-full rounded-xl border border-[var(--border)] bg-[var(--secondary-100)] px-4 py-3 text-sm text-[var(--muted-foreground)] focus:outline-none cursor-not-allowed"
                                placeholder={t("settings.newPasswordPlaceholder")}
                            />
                        </div>
                    </div>

                    <Button
                        type="button"
                        variant="outline"
                        disabled
                        className="rounded-xl border-[var(--border)] text-[var(--muted-foreground)] px-6 py-2.5 font-medium opacity-60 cursor-not-allowed"
                    >
                        {t("settings.updatePassword")}
                    </Button>
                </div>
            </div>
        </form>
    );
}
