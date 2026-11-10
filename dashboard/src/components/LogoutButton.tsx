"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    router.push("/login");
  }

  return (
    <button
      onClick={handleLogout}
      className="text-gray-400 hover:text-white text-sm transition-colors"
    >
      로그아웃
    </button>
  );
}
