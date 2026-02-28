"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Plus, Package, Trash2, Edit, Loader2, X, Check } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { Package as PackageType } from "@/types";

export default function PackagesPage() {
  const supabase = createClient();
  const [packages, setPackages] = useState<PackageType[]>([]);
  const [addons, setAddons] = useState<{ id: string; name: string; price: number; unit: string }[]>([]);
  const [profile, setProfile] = useState<{ currency: string; currency_symbol: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", price: "" });

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: p }, { data: pkgs }, { data: ads }] = await Promise.all([
        supabase.from("profiles").select("currency, currency_symbol").eq("id", user.id).single(),
        supabase.from("packages").select("*").eq("profile_id", user.id).order("created_at"),
        supabase.from("addons").select("*").eq("profile_id", user.id).eq("is_active", true),
      ]);

      setProfile(p);
      setPackages(pkgs || []);
      setAddons(ads || []);
      setLoading(false);
    }
    load();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("packages")
      .insert({
        profile_id: user.id,
        name: form.name,
        description: form.description || null,
        price: parseFloat(form.price) || 0,
        items: [],
      })
      .select()
      .single();

    if (!error && data) {
      setPackages((prev) => [...prev, data as PackageType]);
      setShowModal(false);
      setForm({ name: "", description: "", price: "" });
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this package?")) return;
    await supabase.from("packages").delete().eq("id", id);
    setPackages((prev) => prev.filter((p) => p.id !== id));
  }

  async function toggleActive(pkg: PackageType) {
    await supabase.from("packages").update({ is_active: !pkg.is_active }).eq("id", pkg.id);
    setPackages((prev) =>
      prev.map((p) => (p.id === pkg.id ? { ...p, is_active: !p.is_active } : p))
    );
  }

  const currency = profile?.currency || "GBP";
  const symbol = profile?.currency_symbol || "£";

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Packages</h1>
          <p className="text-gray-500 text-sm mt-1">Pre-built service bundles for quick quoting</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl px-4 py-2.5 text-sm transition-all"
        >
          <Plus className="w-4 h-4" /> New Package
        </button>
      </div>

      {/* Add-ons section */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Add-ons Library</h2>
        <div className="grid grid-cols-4 gap-3">
          {addons.map((addon) => (
            <div key={addon.id} className="bg-gray-50 rounded-xl p-3">
              <p className="text-sm font-medium text-gray-800">{addon.name}</p>
              <p className="text-xs text-orange-600 font-semibold mt-0.5">
                {formatCurrency(addon.price, currency, symbol)}/{addon.unit === "item" ? "ea" : addon.unit}
              </p>
            </div>
          ))}
          <button
            onClick={() => {/* TODO: add addon modal */}}
            className="flex items-center justify-center gap-2 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-3 text-sm text-gray-400 hover:border-orange-300 hover:text-orange-500 transition-all"
          >
            <Plus className="w-4 h-4" /> Add item
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className={`bg-white rounded-2xl border p-5 transition-all ${
                pkg.is_active ? "border-gray-100" : "border-gray-100 opacity-60"
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                  <Package className="w-5 h-5 text-orange-500" />
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleActive(pkg)}
                    className={`w-8 h-4 rounded-full transition-all relative ${
                      pkg.is_active ? "bg-orange-500" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-all ${
                        pkg.is_active ? "left-4" : "left-0.5"
                      }`}
                    />
                  </button>
                  <button
                    onClick={() => handleDelete(pkg.id)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <h3 className="font-bold text-gray-900 mb-1">{pkg.name}</h3>
              {pkg.description && (
                <p className="text-sm text-gray-500 mb-3">{pkg.description}</p>
              )}
              <p className="text-2xl font-bold text-orange-600">
                {formatCurrency(pkg.price, currency, symbol)}
              </p>
              {pkg.items && pkg.items.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {pkg.items.map((item, i) => (
                    <li key={i} className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Check className="w-3 h-3 text-green-500" />
                      {item.quantity}× {item.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}

          {/* Empty + add new */}
          {packages.length === 0 && (
            <div className="col-span-3 text-center py-16 bg-white rounded-2xl border border-gray-100">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium mb-1">No packages yet</p>
              <p className="text-gray-400 text-sm mb-4">Create packages for quick quoting</p>
              <button
                onClick={() => setShowModal(true)}
                className="inline-flex items-center gap-2 bg-orange-500 text-white text-sm font-semibold rounded-xl px-4 py-2 hover:bg-orange-600 transition-all"
              >
                <Plus className="w-4 h-4" /> New Package
              </button>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">New Package</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Package Name *</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Deluxe Birthday Bundle"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="12ft garland + neon sign + foil balloons"
                  rows={2}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fixed Price ({symbol})
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  placeholder="350"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white rounded-xl py-2.5 text-sm font-semibold transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create Package
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
