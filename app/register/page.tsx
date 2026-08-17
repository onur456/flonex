"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Mail, Lock, User } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthDivider, GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { supabase } from "@/lib/supabase";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (password.length < 6) {
      setError("Пароль должен быть не менее 6 символов.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Пароли не совпадают.");
      return;
    }

    setIsLoading(true);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: name.trim() },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      if (data.session) {
        router.push("/");
        router.refresh();
        return;
      }

      setSuccess(
        "Аккаунт создан! Проверьте почту и подтвердите email, затем войдите."
      );
    } catch {
      setError("Не удалось создать аккаунт. Попробуйте снова.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell
      title="Регистрация"
      subtitle="Создайте аккаунт Flonex"
      footer={
        <>
          Уже есть аккаунт?{" "}
          <Link href="/login" className="text-indigo-400 hover:text-indigo-300 font-medium">
            Войти
          </Link>
        </>
      }
    >
      <GoogleSignInButton label="Зарегистрироваться через Google" onError={setError} />
      <AuthDivider />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="text-xs text-slate-400 font-medium block mb-1.5">
            Имя
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ваше имя"
              required
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/80 transition"
            />
          </div>
        </div>

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
              placeholder="Минимум 6 символов"
              required
              minLength={6}
              autoComplete="new-password"
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/80 transition"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="text-xs text-slate-400 font-medium block mb-1.5"
          >
            Подтвердите пароль
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Повторите пароль"
              required
              minLength={6}
              autoComplete="new-password"
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/80 transition"
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {success && (
          <p className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
            {success}
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
              Создаём аккаунт...
            </>
          ) : (
            "Зарегистрироваться"
          )}
        </button>
      </form>
    </AuthShell>
  );
}
