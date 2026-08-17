import Link from "next/link";

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}

export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <Link href="/" className="flex items-center justify-center gap-3 mb-8">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
            F
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-wider bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              FLONEX
            </h1>
            <p className="text-[10px] text-indigo-400 font-medium tracking-widest uppercase text-center">
              AI CMO Engine
            </p>
          </div>
        </Link>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 shadow-2xl backdrop-blur-sm">
          <div className="mb-6 text-center">
            <h2 className="text-xl font-semibold text-slate-100">{title}</h2>
            <p className="text-sm text-slate-400 mt-1">{subtitle}</p>
          </div>

          {children}

          <div className="mt-6 text-center text-sm text-slate-400">{footer}</div>
        </div>
      </div>
    </div>
  );
}
