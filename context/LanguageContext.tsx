"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { translations, SUPPORTED_LANGUAGES } from "@/data/translations";

type TranslationParams = Record<string, string | number>;
type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

interface LanguageContextValue {
  language: string;
  setLanguage: (newLang: string) => void;
  t: (key: string, params?: TranslationParams) => string;
  supportedLanguages: SupportedLanguage[];
}

const STORAGE_KEY = "marvella_language";
const DEFAULT_LANGUAGE = "en";

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && saved in translations) {
        return saved;
      }
    }
    return DEFAULT_LANGUAGE;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, language);
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((newLang: string) => {
    if (newLang in translations) {
      setLanguageState(newLang);
    } else {
      console.warn(`Language "${newLang}" not supported. Falling back to ${DEFAULT_LANGUAGE}`);
      setLanguageState(DEFAULT_LANGUAGE);
    }
  }, []);

  const t = useCallback(
    (key: string, params: TranslationParams = {}) => {
      const keys = key.split(".");
      let value: unknown = translations[language as keyof typeof translations];

      for (const k of keys) {
        if (value && typeof value === "object" && k in value) {
          value = (value as Record<string, unknown>)[k];
        } else {
          value = translations[DEFAULT_LANGUAGE];
          for (const fallbackKey of keys) {
            if (value && typeof value === "object" && fallbackKey in value) {
              value = (value as Record<string, unknown>)[fallbackKey];
            } else {
              console.warn(`Translation key "${key}" not found`);
              return key;
            }
          }
          break;
        }
      }

      if (typeof value === "string" && Object.keys(params).length > 0) {
        return value.replace(/\{(\w+)\}/g, (_, paramName: string) => {
          return params[paramName] !== undefined ? String(params[paramName]) : `{${paramName}}`;
        });
      }

      return typeof value === "string" ? value : key;
    },
    [language]
  );

  const value: LanguageContextValue = {
    language,
    setLanguage,
    t,
    supportedLanguages: SUPPORTED_LANGUAGES,
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}

export default LanguageContext;
