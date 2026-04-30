const STORAGE_KEY = "marvella:addresses";

const safeParse = (value) => {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn("Failed to parse addresses", err);
    return [];
  }
};

export const readAddresses = () => {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw ? safeParse(raw) : [];
};

export const writeAddresses = (addresses) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(addresses || []));
  } catch (err) {
    console.warn("Failed to persist addresses", err);
  }
};

const newId = () => `addr-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 6)}`;

export const addAddress = (address) => {
  const existing = readAddresses();
  const entry = {
    id: address?.id || newId(),
    type: address?.type || "Home",
    name: address?.name || "",
    address: address?.address || "",
    city: address?.city || "",
    state: address?.state || "",
    zip: address?.zip || "",
    phone: address?.phone || "",
    default: Boolean(address?.default),
  };

  let next = [entry, ...existing];
  if (entry.default) {
    next = next.map((addr) => ({ ...addr, default: addr.id === entry.id }));
  }
  writeAddresses(next);
  return next;
};

export const removeAddress = (id) => {
  if (!id) return readAddresses();
  const next = readAddresses().filter((addr) => addr.id !== id);
  writeAddresses(next);
  return next;
};

export const setDefaultAddress = (id) => {
  if (!id) return readAddresses();
  const next = readAddresses().map((addr) => ({ ...addr, default: addr.id === id }));
  writeAddresses(next);
  return next;
};
