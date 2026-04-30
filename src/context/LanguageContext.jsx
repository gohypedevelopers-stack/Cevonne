import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { translations, SUPPORTED_LANGUAGES } from "@/data/translations";

const STORAGE_KEY = "marvella_language";
const DEFAULT_LANGUAGE = "en";

const LanguageContext = createContext(null);

/**
 * LanguageProvider - Context provider for multi-language support
 * Stores preference in localStorage for persistence
 */
export function LanguageProvider({ children }) {
    const [language, setLanguageState] = useState(() => {
        // Initialize from localStorage or use default
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved && translations[saved]) {
                return saved;
            }
        }
        return DEFAULT_LANGUAGE;
    });

    // Persist language preference
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, language);
        // Update document lang attribute for accessibility
        document.documentElement.lang = language;
    }, [language]);

    // Set language with validation
    const setLanguage = useCallback((newLang) => {
        if (translations[newLang]) {
            setLanguageState(newLang);
        } else {
            console.warn(`Language "${newLang}" not supported. Falling back to ${DEFAULT_LANGUAGE}`);
            setLanguageState(DEFAULT_LANGUAGE);
        }
    }, []);

    /**
     * Translation function with support for nested keys and interpolation
     * @param {string} key - Dot-notation key like "profile.myOrders"
     * @param {object} params - Optional interpolation params like { count: 5 }
     * @returns {string} Translated string or key if not found
     */
    const t = useCallback(
        (key, params = {}) => {
            const keys = key.split(".");
            let value = translations[language];

            for (const k of keys) {
                if (value && typeof value === "object" && k in value) {
                    value = value[k];
                } else {
                    // Fallback to English if key not found in current language
                    value = translations[DEFAULT_LANGUAGE];
                    for (const fallbackKey of keys) {
                        if (value && typeof value === "object" && fallbackKey in value) {
                            value = value[fallbackKey];
                        } else {
                            console.warn(`Translation key "${key}" not found`);
                            return key;
                        }
                    }
                    break;
                }
            }

            // Handle interpolation: replace {param} with actual values
            if (typeof value === "string" && Object.keys(params).length > 0) {
                return value.replace(/\{(\w+)\}/g, (_, paramName) => {
                    return params[paramName] !== undefined ? params[paramName] : `{${paramName}}`;
                });
            }

            return typeof value === "string" ? value : key;
        },
        [language]
    );

    const value = {
        language,
        setLanguage,
        t,
        supportedLanguages: SUPPORTED_LANGUAGES,
    };

    return (
        <LanguageContext.Provider value={value}>
            {children}
        </LanguageContext.Provider>
    );
}

/**
 * Custom hook to access language context
 */
export function useLanguage() {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error("useLanguage must be used within a LanguageProvider");
    }
    return context;
}

export default LanguageContext;
