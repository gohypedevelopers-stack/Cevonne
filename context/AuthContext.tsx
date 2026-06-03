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

const readStorage = (key: string) => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();

  const [user, setUser] = useState<PublicUser | null>(() => {
    const storedUser = readStorage("user");
    if (!storedUser) return null;
    try {
      return JSON.parse(storedUser) as PublicUser;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState<string | null>(() => readStorage("token"));
  const [isLoading, setIsLoading] = useState(true);

  const saveToken = (authToken: string | null) => {
    if (typeof window !== "undefined") {
      if (authToken) {
        window.localStorage.setItem("token", authToken);
      } else {
        window.localStorage.removeItem("token");
      }
    }
    setToken(authToken);
  };

  const saveUser = (userData: PublicUser | null) => {
    if (typeof window !== "undefined") {
      if (userData) {
        window.localStorage.setItem("user", JSON.stringify(userData));
      } else {
        window.localStorage.removeItem("user");
      }
    }
    setUser(userData);
  };

  const logout = useCallback(() => {
    saveToken(null);
    saveUser(null);
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

        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }

        const response = await fetch(url, {
          ...requestOptions,
          headers,
        });

        if (response.status === 401 && token) {
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
    [token, logout]
  );

  const verifyUser = useCallback(async () => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await authFetch(`${API_BASE}/users/me`, { silent: true });
      if (!response.ok) throw new Error("Token verification failed");
      const userData = (await response.json()) as PublicUser;
      saveUser(userData);
    } catch (error: any) {
      if (error?.message !== "Unauthorized") {
        // Keep existing local session state when the backend is unavailable.
      }
    } finally {
      setIsLoading(false);
    }
  }, [token, authFetch]);

  useEffect(() => {
    void verifyUser();
  }, [verifyUser]);

  const login = (userData: PublicUser | null, authToken: string | null) => {
    saveToken(authToken);
    saveUser(userData);
  };

  const authValue = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      login,
      logout,
      authFetch,
      refreshUser: verifyUser,
      isAdmin: user?.role === "ADMIN",
      isAuthenticated: !!user,
      isLoading,
    }),
    [user, token, logout, authFetch, verifyUser, isLoading]
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
