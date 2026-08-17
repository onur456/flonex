"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Sparkles, 
  Image as ImageIcon, 
  Layers, 
  Video, 
  Upload, 
  Sliders, 
  Store, 
  BarChart3, 
  Share2, 
  Settings, 
  Zap, 
  CheckCircle2, 
  ArrowRight,
  Loader2,
  Download,
  History,
  Wand2,
  ChevronDown,
  Check
} from "lucide-react";
import { uploadProductImage } from "@/lib/uploadImage";
import { supabase } from "@/lib/supabase";

export const CATEGORIES = [
  {
    id: "clothing",
    title: "Clothing & footwear",
    subtitle: "clothes, shoes, headwear",
    icon: "🧥",
  },
  {
    id: "accessories",
    title: "Accessories",
    subtitle: "bags, watches, eyewear, jewelry",
    icon: "👜",
  },
  {
    id: "food_drinks",
    title: "Food & drinks",
    subtitle: "products, dishes, drinks, packaging",
    icon: "🍽️",
  },
  {
    id: "cosmetics",
    title: "Cosmetics & skincare",
    subtitle: "jars, bottles, tubes",
    icon: "💄",
  },
  {
    id: "gadgets",
    title: "Gadgets & electronics",
    subtitle: "phones, audio, tech gadgets",
    icon: "📱",
  },
  {
    id: "home_furniture",
    title: "Home & furniture",
    subtitle: "furniture, decor, lighting, interior pieces",
    icon: "🛋️",
  },
  {
    id: "other",
    title: "Other",
    subtitle: "if no other category fits",
    icon: "📦",
  },
];

interface GenerationItem {
  id: string;
  original_image_url: string;
  result_image_url: string;
  created_at: string;
  product_name?: string | null;
}

export default function FlonexDashboard() {
  const [contentType, setContentType] = useState<"photo" | "card" | "video">("photo");
  const [aspectRatio, setAspectRatio] = useState("3:4");
  const [style, setStyle] = useState("commercial");
  
  // Кредиты
  const [credits, setCredits] = useState(20);

  // Данные товара
  const [productName, setProductName] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[2]); // Default: Food & drinks
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Состояния файлов
  const [uploadedPublicUrl, setUploadedPublicUrl] = useState<string | null>(null);
const [previewUrl, setPreviewUrl] = useState<string | null>(null);
const [isUploading, setIsUploading] = useState(false);
  // Состояния AI
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);

  // История генераций
  const [history, setHistory] = useState<GenerationItem[]>([]);

  // Промпт и AI Idea
  const [customPrompt, setCustomPrompt] = useState("");
  const [isSuggestingPrompt, setIsSuggestingPrompt] = useState(false);

  const handleGenerateIdea = async () => {
    setIsSuggestingPrompt(true);
    try {
      const res = await fetch("/api/suggest-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          contentType, 
          style,
          productName,
          category: selectedCategory.title
        }),
      });

      if (!res.ok) {
        throw new Error(`Server status: ${res.status}`);
      }

      const data = await res.json();
      if (data && data.prompt) {
        setCustomPrompt(data.prompt);
      }
    } catch (err) {
      console.error("Idea generation error:", err);
    } finally {
      setIsSuggestingPrompt(false);
    }
  };

  // Загружаем историю из Supabase при старте
  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    const { data, error } = await supabase
      .from("generations")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(12);

    if (error) {
      console.error("History fetch error:", error);
      return;
    }

    if (data) {
      setHistory(data);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file.");
      e.target.value = "";
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert("Image is too large. Maximum size is 10MB.");
      e.target.value = "";
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    const localPreviewUrl = URL.createObjectURL(file);
    setPreviewUrl(localPreviewUrl);
    setUploadedPublicUrl(null);
    setGeneratedImage(null);
    setIsUploading(true);
    setIsAnalyzing(true);

    try {
      const uploadResult: any = await uploadProductImage(file);
      const publicUrl =
        typeof uploadResult === "string"
          ? uploadResult
          : uploadResult?.publicUrl || uploadResult?.url || uploadResult?.data?.publicUrl;

      if (!publicUrl) {
        throw new Error("Image upload failed: public URL was not returned.");
      }

      setUploadedPublicUrl(publicUrl);

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/analyze-product", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Server status ${res.status}`);
      }

      if (data.productName) {
        setProductName(data.productName);
      }

      if (data.categoryId) {
        const foundCategory = CATEGORIES.find(
          (c) => c.id === data.categoryId
        );
        if (foundCategory) {
          setSelectedCategory(foundCategory);
        }
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown error";
      console.error("Image upload/analysis failed:", err);
      setUploadedPublicUrl(null);
      alert(`Ошибка загрузки/анализа: ${message}`);
    } finally {
      setIsUploading(false);
      setIsAnalyzing(false);
      e.target.value = "";
    }
  };

  const handleGenerate = async () => {
    if (!uploadedPublicUrl) {
      alert("Пожалуйста, сначала загрузите фото товара!");
      return;
    }

    if (credits <= 0) {
      alert("У вас закончились кредиты! Пополните баланс.");
      return;
    }

    setIsGenerating(true);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: uploadedPublicUrl,
          productName: productName,
          category: selectedCategory.id,
          prompt: customPrompt || `Commercial product presentation for ${productName || "product"}, style: ${style}, high quality studio lighting, 8k render`,
          style: style,
          aspectRatio: aspectRatio,
          contentType: contentType,
        }),
      });

      const data = await res.json();

      if (data.success && data.resultUrl) {
        setGeneratedImage(data.resultUrl);
        setCredits((prev) => Math.max(0, prev - 1));

        if (data.generation) {
          setHistory((prev) => {
            const exists = prev.some((item) => item.id === data.generation.id);
            if (exists) return prev;
            return [data.generation, ...prev].slice(0, 12);
          });
        } else {
          fetchHistory();
        }
      } else {
        alert("Ошибка генерации: " + (data.error || "Неизвестная ошибка"));
      }
    } catch (err) {
      console.error(err);
      alert("Произошла ошибка при отправке запроса на сервер");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans antialiased overflow-hidden">
      {/* SIDEBAR */}
      <aside className="w-64 border-r border-slate-800 bg-slate-900/50 flex flex-col justify-between p-4">
        <div>
          {/* LOGO */}
          <div className="flex items-center gap-3 px-2 py-3 mb-6">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
              F
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-wider bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                FLONEX
              </h1>
              <p className="text-[10px] text-indigo-400 font-medium tracking-widest uppercase">AI CMO Engine</p>
            </div>
          </div>

          {/* NAVIGATION */}
          <nav className="space-y-1">
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-indigo-600/10 text-indigo-400 font-medium text-sm border border-indigo-500/20">
              <Sparkles className="w-4 h-4" />
              Create Content
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 font-medium text-sm transition">
              <Store className="w-4 h-4" />
              Products & Stores
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 font-medium text-sm transition">
              <BarChart3 className="w-4 h-4" />
              A/B Tests & CTR
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 font-medium text-sm transition">
              <Share2 className="w-4 h-4" />
              Social Auto-Publish
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 font-medium text-sm transition">
              <Settings className="w-4 h-4" />
              Integrations API
            </button>
          </nav>
        </div>

        {/* CREDITS WIDGET */}
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-medium">Credits Balance</span>
            <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
              <Zap className="w-3 h-3 fill-amber-400" /> {credits} / 20
            </span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div 
              className="bg-gradient-to-r from-amber-500 to-indigo-500 h-full transition-all duration-300"
              style={{ width: `${(credits / 20) * 100}%` }}
            />
          </div>
        </div>
      </aside>

      {/* MAIN WORKSPACE */}
      <main className="flex-1 flex flex-col overflow-y-auto bg-slate-950">
        {/* HEADER */}
        <header className="h-16 border-b border-slate-800/80 px-8 flex items-center justify-between bg-slate-900/20 backdrop-blur-md sticky top-0 z-10">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Content Studio</h2>
            <p className="text-xs text-slate-400">Generate studio-quality media & publish in 1 click</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 transition"
            >
              Войти
            </Link>
            <Link
              href="/register"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition"
            >
              Регистрация
            </Link>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-3.5 h-3.5" /> Supabase Storage Connected
            </span>
          </div>
        </header>

        {/* WORKSPACE CONTENT */}
        <div className="p-8 max-w-6xl mx-auto w-full space-y-8">
          
          {/* TYPE SELECTOR TOGGLE */}
          <div className="flex justify-center">
            <div className="bg-slate-900 p-1.5 rounded-2xl border border-slate-800 flex gap-2">
              <button
                type="button"
                onClick={() => setContentType("photo")}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium text-sm transition ${
                  contentType === "photo"
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <ImageIcon className="w-4 h-4" /> AI Photo
              </button>
              <button
                type="button"
                onClick={() => setContentType("card")}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium text-sm transition ${
                  contentType === "card"
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Layers className="w-4 h-4" /> E-Com Card Mode
              </button>
              <button
                type="button"
                onClick={() => setContentType("video")}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium text-sm transition ${
                  contentType === "video"
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Video className="w-4 h-4" /> Motion Video
              </button>
            </div>
          </div>

          {/* MAIN GENERATOR GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* UPLOAD & CONTROLS (LEFT - 7 COLS) */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* UPLOAD BOX */}
              {/* UPLOAD BOX */}
<div className="border-2 border-dashed border-slate-800 hover:border-indigo-500/50 bg-slate-900/40 rounded-2xl p-6 text-center transition-colors">
  {isUploading ? (
    <div className="flex flex-col items-center gap-2 text-indigo-400">
      <Loader2 className="w-8 h-8 animate-spin" />
      <span className="text-sm font-medium">Uploading & Analyzing with AI...</span>
    </div>
  ) : previewUrl ? (
    <div className="relative w-full h-52 rounded-lg overflow-hidden group">
      <img
        src={previewUrl}
        alt="Product"
        className="w-full h-full object-contain"
      />

      {isAnalyzing && (
        <div className="absolute inset-0 bg-slate-950/70 flex items-center justify-center text-xs text-indigo-400 font-medium gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>AI is detecting product details...</span>
        </div>
      )}

      <label className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity text-sm text-white font-medium">
        Change Product Photo
        <input
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
        />
      </label>
    </div>
  ) : (
    <label className="flex flex-col items-center justify-center gap-2 cursor-pointer py-4">
      <div className="p-3 bg-slate-800/80 rounded-full text-indigo-400">
        <Upload className="w-6 h-6" />
      </div>
      <p className="text-sm font-medium text-slate-200">Drop product photo here</p>
      <p className="text-xs text-slate-500">PNG, JPG up to 10MB</p>
      <input
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
      />
    </label>
  )}
</div>

              {/* PRODUCT INFO BLOCK (THIS IS) */}
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 space-y-4">
                <div className="flex justify-between items-center border-b border-slate-800/80 pb-2">
                  <span className="text-xs italic text-slate-400 font-serif">This is</span>
                  <span className="text-xs font-mono text-slate-500">01</span>
                </div>

                <div className="space-y-3">
                  {/* НАЗВАНИЕ ТОВАРА */}
                  <div>
                    <label className="text-xs text-slate-400 font-medium block mb-1">Product Title</label>
                    <input
                      type="text"
                      value={productName}
                      onChange={(e) => setProductName(e.target.value)}
                      placeholder={isAnalyzing ? "AI is detecting title..." : "e.g. Premium Cold Brew Coffee"}
                      className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/80 transition"
                    />
                  </div>

                  {/* КНОПКА КАТЕГОРИИ И СПИСОК */}
                  <div>
                    <label className="text-xs text-slate-400 font-medium block mb-1">Category</label>
                    <button
                      type="button"
                      onClick={() => setIsDropdownOpen((prev) => !prev)}
                      className="w-full bg-slate-950/80 border border-slate-800 hover:border-slate-700 px-4 py-3 rounded-xl flex items-center justify-between text-left transition"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl leading-none">{selectedCategory.icon}</span>
                        <div>
                          <div className="text-sm font-semibold text-slate-100">{selectedCategory.title}</div>
                          <div className="text-[11px] text-slate-400">({selectedCategory.subtitle})</div>
                        </div>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} />
                    </button>

                    {/* СПИСОК КАТЕГОРИЙ (РАСКРЫВАЕТСЯ ВНУТРИ ПОТОКА) */}
                    {isDropdownOpen && (
                      <div className="mt-3 grid grid-cols-1 gap-2 p-2 bg-slate-950/90 border border-slate-800 rounded-xl max-h-64 overflow-y-auto">
                        {CATEGORIES.map((cat) => {
                          const isSelected = selectedCategory.id === cat.id;
                          return (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => {
                                setSelectedCategory(cat);
                                setIsDropdownOpen(false);
                              }}
                              className={`flex items-start justify-between p-2.5 rounded-lg text-left transition ${
                                isSelected
                                  ? "bg-indigo-600/20 border border-indigo-500/40 text-white"
                                  : "hover:bg-slate-800/50 text-slate-300"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-xl">{cat.icon}</span>
                                <div>
                                  <div className="text-xs font-semibold">{cat.title}</div>
                                  <div className="text-[10px] text-slate-400">({cat.subtitle})</div>
                                </div>
                              </div>
                              {isSelected && <Check className="w-4 h-4 text-indigo-400 mt-1" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ADVANCED SETTINGS WITH PROMPT FIELD & AI IDEA BUTTON */}
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                    <Sliders className="w-4 h-4 text-indigo-400" /> Advanced Parameters
                  </div>

                  {/* AI IDEA BUTTON */}
                  <button
                    type="button"
                    onClick={handleGenerateIdea}
                    disabled={isSuggestingPrompt}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-xs font-semibold transition active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    {isSuggestingPrompt ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Wand2 className="w-3.5 h-3.5" />
                    )}
                    AI Idea
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* ASPECT RATIO */}
                  <div>
                    <label className="text-xs text-slate-400 font-medium block mb-2">Aspect Ratio</label>
                    <div className="flex gap-2">
                      {["1:1", "3:4", "9:16"].map((ratio) => (
                        <button
                          key={ratio}
                          type="button"
                          onClick={() => setAspectRatio(ratio)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition ${
                            aspectRatio === ratio
                              ? "bg-indigo-600/20 border-indigo-500 text-indigo-300"
                              : "bg-slate-800/40 border-slate-700/60 text-slate-400 hover:bg-slate-800"
                          }`}
                        >
                          {ratio}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* STYLE */}
                  <div>
                    <label className="text-xs text-slate-400 font-medium block mb-2">Visual Style</label>
                    <div className="flex gap-2">
                      {["Commercial", "Home", "Creative"].map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setStyle(st.toLowerCase())}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition ${
                            style === st.toLowerCase()
                              ? "bg-indigo-600/20 border-indigo-500 text-indigo-300"
                              : "bg-slate-800/40 border-slate-700/60 text-slate-400 hover:bg-slate-800"
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* PROMPT DESCRIPTION TEXTAREA */}
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1.5">
                    Visual Description & Prompt ({contentType.toUpperCase()})
                  </label>
                  <textarea
                    rows={3}
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder={`Describe how you want your ${contentType} to look, or click 'AI Idea' above...`}
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/80 transition resize-none"
                  />
                </div>
              </div>

              {/* GENERATE BUTTON */}
              <button 
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating || isUploading || isAnalyzing}
                className={`w-full py-4 rounded-xl font-bold text-white shadow-xl transition flex items-center justify-center gap-2 group cursor-pointer ${
                  isGenerating 
                    ? "bg-indigo-800 opacity-75 cursor-not-allowed" 
                    : "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:opacity-95 shadow-indigo-500/20"
                }`}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Generating with AI Magic...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 fill-white" />
                    Generate {contentType.toUpperCase()} Magic
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
                  </>
                )}
              </button>
            </div>

            {/* PREVIEW CANVAS (RIGHT - 5 COLS) */}
            <div className="lg:col-span-5 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 min-h-[440px] flex flex-col items-center justify-center text-center relative overflow-hidden">
              {isGenerating ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="relative flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
                    <Sparkles className="w-6 h-6 text-indigo-400 absolute animate-pulse" />
                  </div>
                  <p className="text-sm font-medium text-slate-300">Creating Studio Visuals...</p>
                  <p className="text-xs text-slate-500">Fal.ai Flux engine in action</p>
                </div>
              ) : generatedImage ? (
                <div className="w-full h-full flex flex-col items-center gap-4">
                  <div className="relative w-full h-80 rounded-xl overflow-hidden border border-slate-800">
                    <img src={generatedImage} alt="Generated Visual" className="w-full h-full object-cover" />
                  </div>
                  <a 
                    href={generatedImage} 
                    target="_blank" 
                    download="flonex-render.png"
                    className="w-full py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center justify-center gap-2 border border-slate-700 transition"
                  >
                    <Download className="w-4 h-4" /> Download High-Res Result
                  </a>
                </div>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-500 mb-4 border border-slate-700/50">
                    <Sparkles className="w-7 h-7" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-300">Ready for Creation</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs">
                    Upload a product photo and click generate to see AI-powered visuals and conversion layouts here.
                  </p>
                </>
              )}
            </div>

          </div>

          {/* SAVED GENERATIONS PANEL — always visible */}
          <div className="pt-6 border-t border-slate-800/80">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                <History className="w-4 h-4 text-indigo-400" /> Saved Generations
              </div>
              <span className="text-xs text-slate-500">{history.length} saved</span>
            </div>

            {history.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {history.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setGeneratedImage(item.result_image_url)}
                    className={`group relative h-36 rounded-xl overflow-hidden border bg-slate-900 transition text-left ${
                      generatedImage === item.result_image_url
                        ? "border-indigo-500 ring-2 ring-indigo-500/30"
                        : "border-slate-800 hover:border-indigo-500/50"
                    }`}
                  >
                    <img
                      src={item.result_image_url}
                      alt={item.product_name || "Generation"}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 to-transparent p-2 opacity-0 group-hover:opacity-100 transition">
                      <p className="text-[10px] text-slate-300 truncate">
                        {item.product_name || "Untitled"}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/40 p-8 text-center">
                <History className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No saved images yet</p>
                <p className="text-xs text-slate-500 mt-1">
                  Generate a photo — it will appear here and stay after refresh
                </p>
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}