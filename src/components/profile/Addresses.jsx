import React, { useEffect, useState } from "react";
import { Plus, MapPin, Pencil, Trash2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { readAddresses, addAddress, removeAddress, setDefaultAddress } from "@/lib/addressStorage";

export default function Addresses() {
  const [addresses, setAddresses] = useState([]);
  const [form, setForm] = useState({
    type: "Home",
    name: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    phone: "",
    default: false,
  });

  useEffect(() => {
    setAddresses(readAddresses());
  }, []);

  const handleAdd = (e) => {
    e.preventDefault();
    if (!form.name || !form.address) return;
    const next = addAddress(form);
    setAddresses(next);
    setForm({
      type: "Home",
      name: "",
      address: "",
      city: "",
      state: "",
      zip: "",
      phone: "",
      default: false,
    });
  };

  const handleRemove = (id) => {
    const next = removeAddress(id);
    setAddresses(next);
  };

  const handleSetDefault = (id) => {
    const next = setDefaultAddress(id);
    setAddresses(next);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--primary)]">Saved Addresses</h1>
      </div>

      <form onSubmit={handleAdd} className="grid gap-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 sm:grid-cols-2 lg:grid-cols-3">
        <Input
          placeholder="Full name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          required
        />
        <Input
          placeholder="Phone"
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
        />
        <Input
          placeholder="Label (Home/Work)"
          value={form.type}
          onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
        />
        <Input
          placeholder="Street address"
          value={form.address}
          onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          className="sm:col-span-2 lg:col-span-3"
          required
        />
        <Input
          placeholder="City"
          value={form.city}
          onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
        />
        <Input
          placeholder="State"
          value={form.state}
          onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
        />
        <Input
          placeholder="ZIP / Postal"
          value={form.zip}
          onChange={(e) => setForm((f) => ({ ...f, zip: e.target.value }))}
        />
        <label className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
          <input
            type="checkbox"
            checked={form.default}
            onChange={(e) => setForm((f) => ({ ...f, default: e.target.checked }))}
            className="h-4 w-4"
          />
          Set as default
        </label>
        <div className="sm:col-span-2 lg:col-span-3">
          <Button type="submit" className="rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary-700)]">
            <Plus className="mr-2 h-4 w-4" /> Add Address
          </Button>
        </div>
      </form>

      {addresses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)] p-6 text-sm text-[var(--muted-foreground)]">
          No addresses yet. Add one to speed up checkout.
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {addresses.map((addr) => (
            <div
              key={addr.id}
              className="relative p-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)] transition-colors group"
            >
              {addr.default && (
                <span className="absolute top-4 right-4 px-2 py-1 rounded-full bg-[var(--secondary-100)] text-[10px] font-bold uppercase tracking-wider text-[var(--secondary-400)]">
                  Default
                </span>
              )}
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="h-5 w-5 text-[var(--muted-foreground)]" />
                <span className="font-semibold text-[var(--primary)]">{addr.type || "Address"}</span>
              </div>
              <div className="space-y-1 text-sm text-[var(--muted-foreground)]">
                <p className="font-medium text-[var(--primary)]">{addr.name}</p>
                <p>{addr.address}</p>
                <p>
                  {addr.city}, {addr.state} - {addr.zip}
                </p>
                <p className="pt-2">{addr.phone}</p>
              </div>
              <div className="mt-6 flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full border-[var(--border)] text-[var(--primary)]"
                  onClick={() => handleSetDefault(addr.id)}
                >
                  <Star className="mr-2 h-3 w-3" /> Set default
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="rounded-full text-[var(--destructive)] hover:bg-rose-50"
                  onClick={() => handleRemove(addr.id)}
                >
                  <Trash2 className="mr-2 h-3 w-3" /> Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
