"use client";

import { useState } from "react";
import { authClient } from "@/app/lib/auth-client";

export function GuestSignInButton() {
  const [loading, setLoading] = useState(false);

  const handleGuestSignIn = async () => {
    setLoading(true);
    await authClient.signIn.anonymous();
    setLoading(false);
  };

  return (
    <button
      type="button"
      onClick={handleGuestSignIn}
      disabled={loading}
      className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:cursor-wait disabled:opacity-60"
    >
      {loading ? "Signing in..." : "Continue as Guest"}
    </button>
  );
}
