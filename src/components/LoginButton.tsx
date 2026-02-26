"use client";

import { signIn } from "next-auth/react";

export default function LoginButton() {
  return (
    <button
      onClick={() => signIn("twitter", { callbackUrl: "/dashboard" })}
      className="group relative inline-flex items-center gap-3 rounded-full bg-white px-8 py-4 text-lg font-semibold text-black transition-all hover:bg-gray-100 hover:scale-105 active:scale-95"
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
      Connect with X
      <span className="absolute inset-0 -z-10 rounded-full bg-white/20 blur-xl transition-opacity group-hover:opacity-100 opacity-0" />
    </button>
  );
}
