import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";

const API_BASE = (import.meta.env.VITE_APP_BACKEND_URL || "").trim().replace(/\/+$/, "");

export function useUserOrders() {
  const { authFetch, isAuthenticated } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(Boolean(isAuthenticated));
  const [error, setError] = useState("");

  const loadOrders = useCallback(async () => {
    if (!isAuthenticated) {
      setOrders([]);
      setLoading(false);
      return [];
    }
    setLoading(true);
    setError("");
    try {
      const response = await authFetch(`${API_BASE}/orders/my`);
      if (!response.ok) {
        const message = await response.text().catch(() => "");
        throw new Error(message || "Failed to load your orders");
      }
      const payload = await response.json();
      const records = Array.isArray(payload) ? payload : [];
      setOrders(records);
      return records;
    } catch (err) {
      setError(err?.message || "Unable to load orders");
      return [];
    } finally {
      setLoading(false);
    }
  }, [authFetch, isAuthenticated]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  return {
    orders,
    loading,
    error,
    refresh: loadOrders,
  };
}

export default useUserOrders;
