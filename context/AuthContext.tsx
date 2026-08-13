"use client";

import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { useNavigate } from "@/lib/router";
import { toast } from "sonner";
import { API_BASE } from "@/lib/api";
import type { PublicUser } from "@/types/user";

type AuthFetchOptions = RequestInit & { silent?: boolean };

export interface AuthContextValue {
  user: PublicUser | null;
  token: string | null;
  login: (userData: PublicUser | null, authToken: string | null) => void;
  logout: () => void;
  authFetch: (url: string, options?: AuthFetchOptions) => Promise<Response>;
  refreshUser: () => Promise<void>;
  isAdmin: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    void fetch(`${API_BASE}/users/signout`, { method: "POST", credentials: "same-origin" }).catch(() => undefined);
    setUser(null);
    toast.success("You have been logged out.");
    navigate("/login");
  }, [navigate]);

  const authFetch = useCallback(
    async (url: string, options: AuthFetchOptions = {}) => {
      const { silent = false, ...requestOptions } = options;
      try {
        const isFormData = requestOptions.body instanceof FormData;
        const headers: Record<string, string> = {
          ...(isFormData ? {} : { "Content-Type": "application/json" }),
          ...(requestOptions.headers as Record<string, string> | undefined),
        };

        const response = await fetch(url, {
          ...requestOptions,
          headers,
          credentials: "same-origin",
        });

        if (response.status === 401 && user) {
          if (!silent) {
            toast.error("Session expired. Please log in again.");
          }
          logout();
          throw new Error("Unauthorized");
        }

        return response;
      } catch (err: any) {
        if (!silent && err?.message !== "Failed to fetch") {
          toast.error("Network error. Please try again.");
        }
        throw err;
      }
    },
    [user, logout]
  );

  const verifyUser = useCallback(async () => {
    try {
      const response = await authFetch(`${API_BASE}/users/me`, { silent: true });
      if (!response.ok) throw new Error("Token verification failed");
      const userData = (await response.json()) as PublicUser;
      setUser(userData);
    } catch (error: any) {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void verifyUser();
  }, [verifyUser]);

  const login = useCallback(
    (userData: PublicUser | null, authToken: string | null) => {
      void authToken;
      setUser(userData);
    },
    []
  );

  const authValue = useMemo<AuthContextValue>(
    () => ({
      user,
      token: null,
      login,
      logout,
      authFetch,
      refreshUser: verifyUser,
      isAdmin: user?.role === "ADMIN",
      isAuthenticated: !!user,
      isLoading,
    }),
    [user, login, logout, authFetch, verifyUser, isLoading]
  );

  return (
    <AuthContext.Provider value={authValue}>
      {isLoading ? (
        <div className="flex min-h-screen items-center justify-center">
          <span className="loading loading-spinner text-primary" />
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
