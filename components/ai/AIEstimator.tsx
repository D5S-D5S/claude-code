"use client";

import { useState, useRef } from "react";
import {
  Upload,
  Camera,
  Loader2,
  Ruler,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  X,
} from "lucide-react";
import { AIEstimateResult } from "@/types";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";

interface AIEstimatorProps {
  currency: string;
  symbol: string;
}

export default function AIEstimator({ currency, symbol }: AIEstimatorProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AIEstimateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  function handleFile(f: File) {
    if (!f.type.startsWith("image/")) {
      setError("Please upload an image file (JPG, PNG, WEBP)");
      return;
    }
    setFile(f);
    setResult(null);
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  async function analyzeImage() {
    if (!file) return;
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch("/api/ai/estimate", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Analysis failed");
      }

      const data = await res.json();
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to analyze image. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function clearImage() {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <div className="flex items-start gap-4 mb-6">
        <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center flex-shrink-0">
          <Camera className="w-6 h-6 text-orange-500" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">AI Length Estimator</h2>
          <p className="text-sm text-gray-500">
            Upload a photo your customer sent you. Claude Vision AI will analyse it and estimate
            the balloon length needed — then you can use it to auto-fill a quote.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Upload area */}
        <div>
          {!preview ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                dragging
                  ? "border-orange-400 bg-orange-50"
                  : "border-gray-200 hover:border-orange-300 hover:bg-orange-50"
              }`}
            >
              <Upload className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-600">
                Drop a photo here or click to browse
              </p>
              <p className="text-xs text-gray-400 mt-1">JPG, PNG, WEBP — max 10MB</p>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </div>
          ) : (
            <div className="relative">
              <img
                src={preview}
                alt="Uploaded balloon photo"
                className="w-full h-64 object-cover rounded-2xl"
              />
              <button
                onClick={clearImage}
                className="absolute top-2 right-2 w-7 h-7 bg-white rounded-full shadow flex items-center justify-center hover:bg-gray-50"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          )}

          {error && (
            <div className="mt-3 flex items-start gap-2 bg-red-50 text-red-700 text-sm rounded-xl p-3 border border-red-100">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {preview && !result && (
            <button
              onClick={analyzeImage}
              disabled={loading}
              className="mt-3 w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl py-3 text-sm transition-all disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analysing with Claude AI...
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4" />
                  Estimate Length
                </>
              )}
            </button>
          )}
        </div>

        {/* Results */}
        <div>
          {!result && !loading && (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <Ruler className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">
                  Upload a photo to see length estimate
                </p>
                <p className="text-xs text-gray-300 mt-1">
                  Works best with clear photos showing the full balloon area
                </p>
              </div>
            </div>
          )}

          {loading && (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                  <Camera className="w-8 h-8 text-orange-500" />
                </div>
                <p className="text-sm font-medium text-gray-600 mb-1">
                  Analysing with Claude Vision AI...
                </p>
                <p className="text-xs text-gray-400">This takes 5-10 seconds</p>
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <span className="text-sm font-semibold text-green-700">Analysis Complete</span>
              </div>

              {/* Length results */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-orange-50 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-orange-600">{result.length_feet}</p>
                  <p className="text-xs text-orange-500 font-medium mt-0.5">feet</p>
                </div>
                <div className="bg-orange-50 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-orange-600">{result.length_meters}</p>
                  <p className="text-xs text-orange-500 font-medium mt-0.5">meters</p>
                </div>
              </div>

              {/* Confidence */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500">AI Confidence</span>
                  <span className="text-xs font-semibold text-gray-700">
                    {Math.round(result.confidence * 100)}%
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-orange-500 h-2 rounded-full transition-all"
                    style={{ width: `${result.confidence * 100}%` }}
                  />
                </div>
              </div>

              {/* Description */}
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-600">{result.description}</p>
              </div>

              {/* Suggestions */}
              {result.suggestions && result.suggestions.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-2">AI Suggestions:</p>
                  <ul className="space-y-1">
                    {result.suggestions.map((s, i) => (
                      <li key={i} className="text-xs text-gray-500 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 bg-orange-400 rounded-full flex-shrink-0" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Use in quote CTA */}
              <Link
                href={`/quotes/new?length_feet=${result.length_feet}&ai=true`}
                className="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl py-2.5 text-sm transition-all"
              >
                Use in New Quote <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
