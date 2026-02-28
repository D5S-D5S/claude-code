"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Plus, Calendar, Clock, MapPin, User, Loader2, X, Check } from "lucide-react";
import { formatDate, getStatusColor } from "@/lib/utils";
import { Job } from "@/types";

const STATUS_OPTIONS = ["scheduled", "in_progress", "completed", "cancelled"] as const;

export default function CalendarPage() {
  const supabase = createClient();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [form, setForm] = useState({
    title: "",
    customer_id: "",
    scheduled_date: "",
    scheduled_time: "",
    end_time: "",
    address: "",
    team_notes: "",
  });

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: j }, { data: c }] = await Promise.all([
        supabase
          .from("jobs")
          .select("*, customer:customers(name)")
          .eq("profile_id", user.id)
          .order("scheduled_date", { ascending: true }),
        supabase.from("customers").select("id, name").eq("profile_id", user.id).order("name"),
      ]);

      setJobs(j || []);
      setCustomers(c || []);
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
      .from("jobs")
      .insert({
        profile_id: user.id,
        title: form.title || null,
        customer_id: form.customer_id || null,
        scheduled_date: form.scheduled_date || null,
        scheduled_time: form.scheduled_time || null,
        end_time: form.end_time || null,
        address: form.address || null,
        team_notes: form.team_notes || null,
        status: "scheduled",
      })
      .select("*, customer:customers(name)")
      .single();

    if (!error && data) {
      setJobs((prev) => [...prev, data as Job]);
      setShowModal(false);
      setForm({ title: "", customer_id: "", scheduled_date: "", scheduled_time: "", end_time: "", address: "", team_notes: "" });
    }
    setSaving(false);
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from("jobs").update({ status }).eq("id", id);
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, status: status as Job["status"] } : j)));
  }

  const filtered = filter === "all" ? jobs : jobs.filter((j) => j.status === filter);

  const today = new Date().toISOString().split("T")[0];
  const upcoming = jobs.filter((j) => j.scheduled_date && j.scheduled_date >= today && j.status === "scheduled");
  const todayJobs = jobs.filter((j) => j.scheduled_date === today);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
          <p className="text-gray-500 text-sm mt-1">Schedule and track balloon installs</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl px-4 py-2.5 text-sm transition-all"
        >
          <Plus className="w-4 h-4" /> Schedule Job
        </button>
      </div>

      {/* Today's jobs */}
      {todayJobs.length > 0 && (
        <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
            <span className="text-sm font-semibold text-orange-800">Today's Jobs</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {todayJobs.map((job) => (
              <div key={job.id} className="bg-white rounded-xl p-3 border border-orange-100">
                <p className="text-sm font-semibold text-gray-900">{job.title || job.customer?.name}</p>
                {job.scheduled_time && (
                  <p className="text-xs text-orange-600 mt-0.5">{job.scheduled_time}</p>
                )}
                {job.address && (
                  <p className="text-xs text-gray-400 mt-1">{job.address}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {["all", "scheduled", "in_progress", "completed", "cancelled"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all capitalize ${
              filter === f
                ? "bg-orange-500 text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:border-gray-300"
            }`}
          >
            {f === "all" ? `All (${jobs.length})` : f.replace("_", " ")}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
          <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium mb-1">No jobs scheduled</p>
          <button
            onClick={() => setShowModal(true)}
            className="text-orange-500 text-sm font-medium hover:text-orange-600"
          >
            Schedule your first job →
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((job) => (
            <div
              key={job.id}
              className="bg-white rounded-2xl border border-gray-100 p-4 flex items-start gap-4 hover:shadow-sm transition-all"
            >
              <div className="bg-orange-100 rounded-xl p-3 flex-shrink-0">
                <Calendar className="w-5 h-5 text-orange-500" />
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {job.title || job.customer?.name || "Unnamed Job"}
                    </h3>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {job.scheduled_date && (
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Calendar className="w-3 h-3" />
                          {formatDate(job.scheduled_date)}
                        </span>
                      )}
                      {job.scheduled_time && (
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Clock className="w-3 h-3" />
                          {job.scheduled_time}
                          {job.end_time && ` – ${job.end_time}`}
                        </span>
                      )}
                      {job.customer?.name && (
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <User className="w-3 h-3" />
                          {job.customer.name}
                        </span>
                      )}
                      {job.address && (
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <MapPin className="w-3 h-3" />
                          {job.address}
                        </span>
                      )}
                    </div>
                    {job.team_notes && (
                      <p className="text-xs text-gray-400 mt-1">{job.team_notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${getStatusColor(job.status)}`}>
                      {job.status.replace("_", " ")}
                    </span>
                    <select
                      value={job.status}
                      onChange={(e) => updateStatus(job.id, e.target.value)}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-orange-400"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s.replace("_", " ")}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Schedule Job</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Birthday Party Setup"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
                <select
                  value={form.customer_id}
                  onChange={(e) => setForm((f) => ({ ...f, customer_id: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                >
                  <option value="">Select customer...</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                  <input
                    required
                    type="date"
                    value={form.scheduled_date}
                    onChange={(e) => setForm((f) => ({ ...f, scheduled_date: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={form.scheduled_time}
                    onChange={(e) => setForm((f) => ({ ...f, scheduled_time: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                <input
                  type="time"
                  value={form.end_time}
                  onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="123 Event Venue, London"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Team Notes</label>
                <textarea
                  value={form.team_notes}
                  onChange={(e) => setForm((f) => ({ ...f, team_notes: e.target.value }))}
                  placeholder="Setup instructions, access codes, etc."
                  rows={2}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                />
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
                  Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
