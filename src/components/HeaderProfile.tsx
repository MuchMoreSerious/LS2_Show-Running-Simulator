"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function HeaderProfile() {
  const router = useRouter();
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/profiles/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setName(d?.name ?? null))
      .catch(() => setName(null));
  }, []);

  const logout = async () => {
    await fetch("/api/profiles/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  if (!name) return null;

  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="text-ink-dim">{name}</span>
      <button onClick={logout} className="text-ink-dim hover:text-tally-red transition-colors">로그아웃</button>
    </div>
  );
}
