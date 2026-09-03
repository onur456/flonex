"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Finishing Google sign-in...");

  useEffect(() => {
    let isMounted = true;

    const finishAuth = async () => {
      const params = new URLSearchParams(window.location.search);
      const authError = params.get("error_description") || params.get("error");

      if (authError) {
        if (isMounted) {
          setMessage("Could not sign in with Google.");
        }
        setTimeout(() => router.replace(`/login?error=${encodeURIComponent(authError)}`), 1500);
        return;
      }

      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        if (isMounted) {
          setMessage("Authorization error.");
        }
        setTimeout(() => router.replace("/login?error=auth"), 1500);
        return;
      }

      if (session) {
        router.replace("/");
        return;
      }

      const code = params.get("code");
      if (code) {
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          if (isMounted) {
            setMessage("Could not save session.");
          }
          setTimeout(
            () => router.replace(`/login?error=${encodeURIComponent(exchangeError.message)}`),
            1500
          );
          return;
        }
        if (data.session) {
          router.replace("/");
          return;
        }
      }

      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
        if (event === "SIGNED_IN" && newSession) {
          router.replace("/");
        }
      });

      setTimeout(async () => {
        subscription.unsubscribe();
        const { data: { session: retrySession } } = await supabase.auth.getSession();
        if (!retrySession && isMounted) {
          router.replace("/login?error=auth");
        }
      }, 8000);
    };

    finishAuth();

    return () => {
      isMounted = false;
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center gap-4">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
      <p className="text-sm text-slate-400">{message}</p>
    </div>
  );
}
