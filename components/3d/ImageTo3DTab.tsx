"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  AlertTriangle,
  Box,
  CheckCircle2,
  Download,
  Image as ImageIcon,
  Loader2,
  Send,
  Upload,
} from "lucide-react";
import { fetchGenerationAssets, type GenerationAsset } from "@/lib/generations";
import { saveGeneratedModelRecord } from "@/lib/save3dModel";
import { formatSupabaseError } from "@/lib/supabase";
import { uploadProductImage } from "@/lib/uploadImage";
import type { PublishMedia } from "@/components/social/PublishModal";

const ModelViewer = dynamic(
  () => import("./ModelViewer").then((mod) => mod.ModelViewer),
  {
    ssr: false,
    loading: () => (
      <div className="h-[28rem] rounded-2xl border border-slate-800 bg-slate-950/60 flex items-center justify-center gap-2 text-xs text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
        Loading 3D viewer...
      </div>
    ),
  }
);

interface ImageTo3DTabProps {
  latestImageUrl?: string | null;
  productName?: string;
  credits: number;
  onCreditSpent: () => Promise<void>;
  onPublish: (media: PublishMedia) => void;
}

export function ImageTo3DTab({
  latestImageUrl = null,
  productName,
  credits,
  onCreditSpent,
  onPublish,
}: ImageTo3DTabProps) {
  const [assets, setAssets] = useState<GenerationAsset[]>([]);
  const [localAssets, setLocalAssets] = useState<GenerationAsset[]>([]);
  const [isLoadingAssets, setIsLoadingAssets] = useState(true);
  const [userSelection, setUserSelection] = useState<string | null>(null);
  const selectedUrl = userSelection ?? latestImageUrl;
  const blobUrlsRef = useRef<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      await Promise.resolve();
      try {
        const loaded = await fetchGenerationAssets(24);
        if (cancelled) return;
        setAssets(loaded.filter((asset) => asset.type === "image"));
      } catch (err) {
        if (cancelled) return;
        console.error("3D asset fetch error:", err);
        setError(err instanceof Error ? err.message : "Не удалось загрузить историю");
      } finally {
        if (!cancelled) setIsLoadingAssets(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    setError(null);
    setModelUrl(null);
    setSaved(false);

    const blobUrl = URL.createObjectURL(file);
    blobUrlsRef.current.push(blobUrl);
    const localId = `upload-${Date.now()}`;

    setLocalAssets((prev) => [
      {
        id: localId,
        url: blobUrl,
        type: "image",
        productName: file.name.replace(/\.[^.]+$/, "") || "Upload",
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
    setUserSelection(blobUrl);

    try {
      const url = await uploadProductImage(file);
      setLocalAssets((prev) =>
        prev.map((item) => (item.id === localId ? { ...item, url } : item))
      );
      setUserSelection(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : formatSupabaseError(err));
    } finally {
      setIsUploading(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedUrl) {
      setError("Сначала выберите или загрузите фото товара");
      return;
    }

    if (credits <= 0) {
      setError("У вас закончились кредиты");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setSaved(false);

    try {
      const res = await fetch("/api/generate-3d", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: selectedUrl }),
      });

      const data = (await res.json()) as {
        success?: boolean;
        modelUrl?: string;
        error?: string;
      };

      if (!res.ok || !data.success || !data.modelUrl) {
        throw new Error(data.error || `Status ${res.status}`);
      }

      setModelUrl(data.modelUrl);
      await onCreditSpent();
    } catch (err) {
      console.error("generate-3d error:", err);
      setError(err instanceof Error ? err.message : "Не удалось сгенерировать 3D");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async () => {
    if (!modelUrl) return;

    setIsDownloading(true);
    try {
      const res = await fetch(modelUrl);
      if (!res.ok) throw new Error(`Не удалось скачать GLB (${res.status})`);

      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = `flonex-3d-${Date.now()}.glb`;
      link.click();
      URL.revokeObjectURL(href);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось скачать модель");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSave = async () => {
    if (!modelUrl || !selectedUrl) return;

    setIsSaving(true);
    setError(null);

    try {
      const record = await saveGeneratedModelRecord({
        sourceImageUrl: selectedUrl,
        modelUrl,
        productName,
      });

      if (!record) {
        throw new Error(
          "Не удалось сохранить запись. Выполните supabase/setup.sql — нужна таблица generated_models."
        );
      }

      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : formatSupabaseError(err));
    } finally {
      setIsSaving(false);
    }
  };

  const pickerItems: GenerationAsset[] = [];
  const seenUrls = new Set<string>();
  const pushItem = (item: GenerationAsset) => {
    if (!item.url || seenUrls.has(item.url)) return;
    seenUrls.add(item.url);
    pickerItems.push(item);
  };

  localAssets.forEach(pushItem);
  if (latestImageUrl) {
    pushItem({
      id: "latest",
      url: latestImageUrl,
      type: "image",
      productName: productName ?? "Latest generation",
      createdAt: new Date().toISOString(),
    });
  }
  assets.forEach(pushItem);

  const canGenerate =
    Boolean(selectedUrl?.startsWith("http")) &&
    !isGenerating &&
    !isUploading &&
    credits > 0;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Box className="w-4 h-4 text-violet-400" /> Image to 3D
          </div>
          <p className="text-xs text-slate-400 mt-1">
            TripoSR превращает фото товара в GLB — крутите модель мышью после генерации.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-5 space-y-5">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-medium text-slate-400">Source image</h3>
              <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-semibold text-slate-200 cursor-pointer transition">
                {isUploading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                Upload
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  disabled={isUploading || isGenerating}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) void handleUpload(file);
                  }}
                />
              </label>
            </div>

            {selectedUrl && (
              <div className="relative w-full h-52 rounded-xl overflow-hidden border border-violet-500/40 bg-slate-950">
                <img
                  src={selectedUrl}
                  alt="Selected product"
                  className="w-full h-full object-contain"
                />
                {isUploading && (
                  <div className="absolute inset-0 bg-slate-950/70 flex items-center justify-center gap-2 text-xs text-violet-300 font-medium">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading photo...
                  </div>
                )}
              </div>
            )}

            {isLoadingAssets && pickerItems.length === 0 && !selectedUrl ? (
              <div className="flex items-center justify-center gap-2 py-10 text-xs text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
                Загружаем генерации...
              </div>
            ) : pickerItems.length === 0 && !selectedUrl ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <ImageIcon className="w-6 h-6 text-slate-600" />
                <p className="text-xs text-slate-400">Нет сохранённых фото</p>
                <p className="text-[11px] text-slate-500">Загрузите файл или сначала сгенерируйте AI Photo</p>
              </div>
            ) : pickerItems.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {pickerItems.map((item) => {
                  const selected = selectedUrl === item.url;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setUserSelection(item.url);
                        setModelUrl(null);
                        setSaved(false);
                      }}
                      disabled={isGenerating || isUploading}
                      className={`relative aspect-square rounded-xl overflow-hidden border bg-slate-950 transition ${
                        selected
                          ? "border-violet-500 ring-2 ring-violet-500/30"
                          : "border-slate-800 hover:border-slate-600"
                      }`}
                    >
                      <img
                        src={item.url}
                        alt={item.productName || "Product"}
                        className="w-full h-full object-cover"
                      />
                      {selected && (
                        <span className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-violet-500 text-white flex items-center justify-center">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="w-full py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-violet-600 via-indigo-500 to-fuchsia-500 hover:opacity-95 transition inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating 3D mesh...
              </>
            ) : (
              <>
                <Box className="w-4 h-4" />
                Generate 3D
              </>
            )}
          </button>
        </div>

        <div className="lg:col-span-7 space-y-4">
          <ModelViewer modelUrl={modelUrl} className="h-[28rem] w-full" />

          {modelUrl && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleDownload}
                disabled={isDownloading}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                {isDownloading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                Download .GLB
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || saved}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : saved ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                {saved ? "Saved" : "Save to Supabase"}
              </button>

              <button
                type="button"
                onClick={() =>
                  selectedUrl && onPublish({ url: selectedUrl, type: "image" })
                }
                disabled={!selectedUrl}
                className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                Publish to Social
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5">
          <AlertTriangle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
          <p className="text-xs text-rose-200 break-words">{error}</p>
        </div>
      )}
    </div>
  );
}
