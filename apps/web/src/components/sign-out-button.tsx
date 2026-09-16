"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton() {
  return (
    <button onClick={() => signOut({ callbackUrl: "/" })} className="text-white/50 hover:text-white underline">
      Sair
    </button>
  );
}
