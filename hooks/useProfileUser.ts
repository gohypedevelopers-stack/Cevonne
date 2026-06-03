import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/api";
import type { PublicUser } from "@/types/user";

type FetchProfileOptions = {
  background?: boolean;
};

export function useProfileUser() {
  const { user, refreshUser, authFetch, isAuthenticated, isLoading: authLoading } = useAuth();
  const [profile, setProfile] = useState<PublicUser | null>(user);
  const [loading, setLoading] = useState(authLoading);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    setProfile(user);
  }, [user]);

  const fetchProfile = useCallback(async ({ background = false }: FetchProfileOptions = {}) => {
    if (!isAuthenticated) {
      setProfile(null);
      return null;
    }
    if (!background) {
      setLoading(true);
    }
    setError("");
    try {
      const res = await authFetch(`${API_BASE}/users/me`);
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        let message = "Failed to load profile";
        if (text) {
          try {
            const parsed = JSON.parse(text);
            message = parsed?.message || message;
          } catch {
            message = text;
          }
        }
        throw new Error(message);
      }
      const data = await res.json();
      setProfile(data);
      return data;
    } catch (err: any) {
      setError(err?.message || "Failed to load profile");
      throw err;
    } finally {
      if (!background) {
        setLoading(false);
      }
    }
  }, [authFetch, isAuthenticated]);

  const updateProfile = useCallback(
    async (payload: Record<string, unknown> = {}) => {
      if (!isAuthenticated) {
        throw new Error("Not authenticated");
      }
      setLoading(true);
      setError("");
    try {
      const res = await authFetch(`${API_BASE}/users/me`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        let message = "Failed to update profile";
        if (text) {
          try {
            const parsed = JSON.parse(text);
            message = parsed?.message || message;
          } catch {
            message = text;
          }
        }
        throw new Error(message);
      }
      const data = await res.json();
      setProfile(data);
      await refreshUser?.();
      return data;
      } catch (err: any) {
        setError(err?.message || "Failed to update profile");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [authFetch, isAuthenticated, refreshUser]
  );

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setProfile(user);
    setLoading(false);
    void fetchProfile({ background: true }).catch(() => { });
  }, [authLoading, isAuthenticated, user, fetchProfile]);

  return {
    profile,
    loading,
    error,
    refresh: fetchProfile,
    updateProfile,
  };
}

export default useProfileUser;
