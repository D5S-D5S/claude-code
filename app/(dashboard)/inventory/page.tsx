"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Plus, Boxes, AlertTriangle, Loader2, X, Search } from "lucide-react";
import { InventoryItem } from "@/types";

const CATEGORIES = ["Latex", "Foil", "Accessories", "Equipment", "Other"];
const SIZES = ["5\"", "11\"", "16\"", "24\"", "36\"", "N/A"];

export default function InventoryPage() {
  const supabase = createClient();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    category: "Latex",
    color: "",
    size: "11\"",
    quantity_in_stock: "",
    low_stock_threshold: "10",
    unit_cost: "",
    supplier: "",
    sku: "",
  });

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("inventory")
        .select("*")
        .eq("profile_id", user.id)
        .order("name");
      setItems(data || []);
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
      .from("inventory")
      .insert({
        profile_id: user.id,
        name: form.name,
        category: form.category,
        color: form.color || null,
        size: form.size || null,
        quantity_in_stock: parseInt(form.quantity_in_stock) || 0,
        low_stock_threshold: parseInt(form.low_stock_threshold) || 10,
        unit_cost: form.unit_cost ? parseFloat(form.unit_cost) : null,
        supplier: form.supplier || null,
        sku: form.sku || null,
      })
      .select()
      .single();

    if (!error && data) {
      setItems((prev) => [...prev, data as InventoryItem].sort((a, b) => a.name.localeCompare(b.name)));
      setShowModal(false);
      setForm({ name: "", category: "Latex", color: "", size: "11\"", quantity_in_stock: "", low_stock_threshold: "10", unit_cost: "", supplier: "", sku: "" });
    }
    setSaving(false);
  }

  async function adjustQuantity(id: string, delta: number) {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const newQty = Math.max(0, item.quantity_in_stock + delta);
    await supabase.from("inventory").update({ quantity_in_stock: newQty }).eq("id", id);
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, quantity_in_stock: newQty } : i)));
  }

  const filtered = items.filter(
    (i) =>
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.color?.toLowerCase().includes(search.toLowerCase()) ||
      i.category?.toLowerCase().includes(search.toLowerCase())
  );

  const lowStock = items.filter((i) => i.quantity_in_stock <= i.low_stock_threshold);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="text-gray-500 text-sm mt-1">{items.length} items tracked</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl px-4 py-2.5 text-sm transition-all"
        >
          <Plus className="w-4 h-4" /> Add Item
        </button>
      </div>

      {/* Low stock alert */}
      {lowStock.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              {lowStock.length} item{lowStock.length !== 1 ? "s" : ""} running low
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              {lowStock.map((i) => `${i.name} (${i.quantity_in_stock})`).join(", ")}
            </p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, color or category..."
          className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {filtered.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Item</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Category</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Size</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Color</th>
                  <th className="text-center text-xs font-semibold text-gray-500 px-4 py-3">In Stock</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">SKU</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Supplier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((item) => {
                  const isLow = item.quantity_in_stock <= item.low_stock_threshold;
                  return (
                    <tr key={item.id} className="hover:bg-gray-50 transition-all">
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          {item.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{item.size || "—"}</td>
                      <td className="px-4 py-3">
                        {item.color ? (
                          <div className="flex items-center gap-1.5">
                            <div
                              className="w-4 h-4 rounded-full border border-gray-200"
                              style={{ backgroundColor: item.color.toLowerCase() }}
                            />
                            <span className="text-sm text-gray-600">{item.color}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => adjustQuantity(item.id, -1)}
                            className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition-all text-xs font-bold"
                          >
                            −
                          </button>
                          <span className={`text-sm font-bold min-w-[2rem] text-center ${isLow ? "text-red-600" : "text-gray-900"}`}>
                            {item.quantity_in_stock}
                          </span>
                          <button
                            onClick={() => adjustQuantity(item.id, 1)}
                            className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition-all text-xs font-bold"
                          >
                            +
                          </button>
                          {isLow && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{item.sku || "—"}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{item.supplier || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-16">
              <Boxes className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium mb-1">No inventory items</p>
              <button
                onClick={() => setShowModal(true)}
                className="text-orange-500 text-sm font-medium hover:text-orange-600"
              >
                Add your first item →
              </button>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Add Inventory Item</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Item Name *</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="11\" Latex Balloons"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  >
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Size</label>
                  <select
                    value={form.size}
                    onChange={(e) => setForm((f) => ({ ...f, size: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  >
                    {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                  <input
                    value={form.color}
                    onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                    placeholder="Rose Gold"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Qty in Stock</label>
                  <input
                    type="number"
                    min="0"
                    value={form.quantity_in_stock}
                    onChange={(e) => setForm((f) => ({ ...f, quantity_in_stock: e.target.value }))}
                    placeholder="100"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Low Stock Alert</label>
                  <input
                    type="number"
                    min="0"
                    value={form.low_stock_threshold}
                    onChange={(e) => setForm((f) => ({ ...f, low_stock_threshold: e.target.value }))}
                    placeholder="10"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit Cost</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.unit_cost}
                    onChange={(e) => setForm((f) => ({ ...f, unit_cost: e.target.value }))}
                    placeholder="0.25"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                  <input
                    value={form.sku}
                    onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                    placeholder="LAT-11-RG"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                  <input
                    value={form.supplier}
                    onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))}
                    placeholder="Balloon Supplies Co"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Add Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
