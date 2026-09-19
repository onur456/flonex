"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import dynamic from "next/dynamic";
import {
  AlertTriangle,
  Box,
  CheckCircle2,
  Download,
  Loader2,
  Send,
  Upload,
} from "lucide-react";
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
  const [userSelection, setUserSelection] = useState<string | null>(null);
  const selectedUrl = userSelection ?? latestImageUrl;
  const blobUrlRef = useRef<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void handleUpload(file);
  };

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    setError(null);
    setModelUrl(null);
    setSaved(false);

    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }

    const blobUrl = URL.createObjectURL(file);
    blobUrlRef.current = blobUrl;
    setUserSelection(blobUrl);

    try {
      const url = await uploadProductImage(file);
      setUserSelection(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : formatSupabaseError(err));
    } finally {
      setIsUploading(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedUrl) {
      setError("Сначала загрузите фото товара");
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

  const canGenerate =
    Boolean(selectedUrl?.startsWith("http")) &&
    !isGenerating &&
    !isUploading &&
    credits > 0;

  const fileInput = (
    <input
      type="file"
      accept="image/png,image/jpeg,image/webp,image/*"
      className="hidden"
      disabled={isUploading || isGenerating}
      onChange={handleFileChange}
    />
  );

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Box className="w-4 h-4 text-violet-400" /> Image to 3D
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Загрузи одно фото товара — справа появится 3D-модель.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-5 space-y-5">
          <div className="border-2 border-dashed border-slate-800 hover:border-indigo-500/50 bg-slate-900/40 rounded-2xl p-6 text-center transition-colors">
            {isUploading && !selectedUrl ? (
              <div className="flex flex-col items-center gap-2 text-indigo-400">
                <Loader2 className="w-8 h-8 animate-spin" />
                <span className="text-sm font-medium">Uploading photo...</span>
              </div>
            ) : selectedUrl ? (
              <div className="relative w-full h-52 rounded-lg overflow-hidden group">
                <img
                  src={selectedUrl}
                  alt="Product"
                  className="w-full h-full object-contain"
                />
                {isUploading && (
                  <div className="absolute inset-0 bg-slate-950/70 flex items-center justify-center text-xs text-indigo-400 font-medium gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Uploading photo...</span>
                  </div>
                )}
                <label className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity text-sm text-white font-medium">
                  Change Product Photo
                  {fileInput}
                </label>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-2 cursor-pointer py-4">
                <div className="p-3 bg-slate-800/80 rounded-full text-indigo-400">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="text-sm font-medium text-slate-200">Drop product photo here</p>
                <p className="text-xs text-slate-500">PNG, JPG up to 10MB</p>
                {fileInput}
              </label>
            )}
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
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
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
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
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
                className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
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
