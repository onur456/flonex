"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Mail, Lock } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthDivider, GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const authError = searchParams.get("error");
    if (authError) {
      setError(decodeURIComponent(authError));
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("Не удалось войти. Попробуйте снова.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell
      title="Вход"
      subtitle="Войдите в свой аккаунт Flonex"
      footer={
        <>
          Нет аккаунта?{" "}
          <Link href="/register" className="text-indigo-400 hover:text-indigo-300 font-medium">
            Зарегистрироваться
          </Link>
        </>
      }
    >
      <GoogleSignInButton onError={setError} />
      <AuthDivider />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="text-xs text-slate-400 font-medium block mb-1.5">
            Email
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/80 transition"
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="text-xs text-slate-400 font-medium block mb-1.5">
            Пароль
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ваш пароль"
              required
              autoComplete="current-password"
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/80 transition"
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:opacity-95 transition flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Входим...
            </>
          ) : (
            "Войти"
          )}
        </button>
      </form>
    </AuthShell>
  );
}
