"use client";

import { useState } from "react";
import { Wand2, Loader2, Download, RefreshCw } from "lucide-react";

const BALLOON_COLORS = [
  { name: "Rose Gold", hex: "#B76E79" },
  { name: "Blush Pink", hex: "#FFB6C1" },
  { name: "Gold", hex: "#FFD700" },
  { name: "White", hex: "#FFFFFF" },
  { name: "Ivory", hex: "#FFFFF0" },
  { name: "Sage Green", hex: "#BCB88A" },
  { name: "Navy", hex: "#003153" },
  { name: "Burgundy", hex: "#800020" },
  { name: "Terracotta", hex: "#E2725B" },
  { name: "Sky Blue", hex: "#87CEEB" },
  { name: "Lavender", hex: "#E6E6FA" },
  { name: "Black", hex: "#000000" },
];

const ARCH_STYLES = [
  { id: "classic", label: "Classic Arch", desc: "Organic balloon garland" },
  { id: "wide", label: "Wide Arch", desc: "Full statement arch" },
  { id: "column", label: "Column Pair", desc: "Two balloon towers" },
  { id: "backdrop", label: "Balloon Backdrop", desc: "Full wall coverage" },
];

export default function MockupGenerator() {
  const [selectedColors, setSelectedColors] = useState<string[]>(["Rose Gold", "Gold", "White"]);
  const [archStyle, setArchStyle] = useState("classic");
  const [eventText, setEventText] = useState("");
  const [loading, setLoading] = useState(false);
  const [mockupUrl, setMockupUrl] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);

  function toggleColor(name: string) {
    setSelectedColors((prev) =>
      prev.includes(name)
        ? prev.filter((c) => c !== name)
        : prev.length < 4
        ? [...prev, name]
        : prev
    );
  }

  async function generateMockup() {
    setLoading(true);
    setMockupUrl(null);
    setDescription(null);

    try {
      const res = await fetch("/api/ai/mockup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          colors: selectedColors,
          style: archStyle,
          eventText: eventText || undefined,
        }),
      });

      if (!res.ok) throw new Error("Generation failed");
      const data = await res.json();
      setMockupUrl(data.image_url);
      setDescription(data.description);
    } catch {
      // Fallback: show a description without image (since we may not have DALL-E)
      setDescription(
        `A beautiful ${archStyle} balloon arrangement in ${selectedColors.join(", ")} tones${eventText ? ` with "${eventText}" signage` : ""}. Perfect for your event backdrop or entrance display.`
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <div className="flex items-start gap-4 mb-6">
        <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center flex-shrink-0">
          <Wand2 className="w-6 h-6 text-purple-500" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">AI Mockup Generator</h2>
          <p className="text-sm text-gray-500">
            Choose colours and style to generate a design preview to share with your customer.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Controls */}
        <div className="space-y-5">
          {/* Arch style */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Style</label>
            <div className="grid grid-cols-2 gap-2">
              {ARCH_STYLES.map((style) => (
                <button
                  key={style.id}
                  onClick={() => setArchStyle(style.id)}
                  className={`p-2.5 rounded-xl border-2 text-left transition-all ${
                    archStyle === style.id
                      ? "border-orange-500 bg-orange-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <p className="text-xs font-semibold text-gray-900">{style.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{style.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Color palette */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Colours <span className="text-gray-400">(select up to 4)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {BALLOON_COLORS.map((color) => {
                const isSelected = selectedColors.includes(color.name);
                return (
                  <button
                    key={color.name}
                    onClick={() => toggleColor(color.name)}
                    title={color.name}
                    className={`w-8 h-8 rounded-full border-3 transition-all ${
                      isSelected ? "scale-110 ring-2 ring-orange-500 ring-offset-1" : "hover:scale-105"
                    }`}
                    style={{
                      backgroundColor: color.hex,
                      border: `3px solid ${isSelected ? "#F97316" : "#E5E7EB"}`,
                    }}
                  />
                );
              })}
            </div>
            {selectedColors.length > 0 && (
              <p className="text-xs text-gray-400 mt-1">
                Selected: {selectedColors.join(", ")}
              </p>
            )}
          </div>

          {/* Event text */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Event text <span className="text-gray-400">(optional)</span>
            </label>
            <input
              value={eventText}
              onChange={(e) => setEventText(e.target.value)}
              placeholder="Happy 30th! · Forever & Always"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>

          <button
            onClick={generateMockup}
            disabled={loading || selectedColors.length === 0}
            className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl py-3 text-sm transition-all disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating mockup...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                Generate Mockup
              </>
            )}
          </button>
        </div>

        {/* Preview */}
        <div className="bg-gray-50 rounded-2xl flex items-center justify-center min-h-48 relative overflow-hidden">
          {loading && (
            <div className="text-center">
              <div className="w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3 animate-pulse">
                <Wand2 className="w-7 h-7 text-purple-500" />
              </div>
              <p className="text-sm text-gray-500">Creating your mockup...</p>
            </div>
          )}

          {!loading && !description && (
            <div className="text-center p-6">
              <div className="flex justify-center gap-1 mb-3">
                {["#FFD700", "#FFB6C1", "#FFFFFF"].map((c, i) => (
                  <div
                    key={i}
                    className="w-8 h-10 rounded-full opacity-40"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <p className="text-sm text-gray-400">
                Configure options and click Generate Mockup
              </p>
            </div>
          )}

          {!loading && mockupUrl && (
            <div className="w-full h-full">
              <img
                src={mockupUrl}
                alt="Generated balloon mockup"
                className="w-full h-full object-cover rounded-2xl"
              />
              <div className="absolute bottom-3 right-3 flex gap-2">
                <button
                  onClick={generateMockup}
                  className="w-8 h-8 bg-white rounded-full shadow flex items-center justify-center hover:bg-gray-50 transition-all"
                  title="Regenerate"
                >
                  <RefreshCw className="w-4 h-4 text-gray-600" />
                </button>
                <a
                  href={mockupUrl}
                  download="balloon-mockup.png"
                  className="w-8 h-8 bg-white rounded-full shadow flex items-center justify-center hover:bg-gray-50 transition-all"
                  title="Download"
                >
                  <Download className="w-4 h-4 text-gray-600" />
                </a>
              </div>
            </div>
          )}

          {!loading && !mockupUrl && description && (
            <div className="p-6 text-center">
              <div className="flex justify-center gap-1 mb-4">
                {selectedColors.slice(0, 4).map((name, i) => {
                  const color = BALLOON_COLORS.find((c) => c.name === name);
                  return (
                    <div
                      key={i}
                      className="w-10 h-12 rounded-full shadow-sm"
                      style={{ backgroundColor: color?.hex || "#ccc" }}
                    />
                  );
                })}
              </div>
              <p className="text-sm text-gray-600 italic">{description}</p>
              <p className="text-xs text-gray-400 mt-2">
                (Image generation requires a DALL-E API key — add OPENAI_API_KEY to .env)
              </p>
              <button
                onClick={generateMockup}
                className="mt-3 text-xs text-purple-600 font-medium flex items-center gap-1 mx-auto"
              >
                <RefreshCw className="w-3 h-3" /> Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
