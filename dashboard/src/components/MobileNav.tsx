"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";

const LINKS = [
  { href: "/", label: "Jobs" },
  { href: "/library", label: "Library" },
  { href: "/voices", label: "Voices" },
  { href: "/personas", label: "Personas" },
  { href: "/report", label: "Report" },
];

export default function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const linkClass = (href: string) => {
    const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
    return `text-sm transition-colors ${active ? "text-white" : "text-gray-400 hover:text-white"}`;
  };

  return (
    <nav className="border-b border-gray-800">
      {/* Desktop: horizontal nav (unchanged) */}
      <div className="hidden sm:flex gap-6 items-center px-6 py-3">
        <span className="font-bold text-white text-lg">Reels Automation</span>
        {LINKS.map((l) => (
          <a key={l.href} href={l.href} className={linkClass(l.href)}>
            {l.label}
          </a>
        ))}
        <div className="ml-auto">
          <LogoutButton />
        </div>
      </div>

      {/* Mobile: logo + hamburger toggle */}
      <div className="sm:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="font-bold text-white text-lg">Reels Automation</span>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="Open menu"
            aria-expanded={open}
            className="text-gray-300 hover:text-white text-2xl leading-none px-2 -mr-2"
          >
            {open ? "✕" : "☰"}
          </button>
        </div>
        {open && (
          <div className="flex flex-col gap-1 px-4 pb-3 border-t border-gray-800">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={`${linkClass(l.href)} py-2`}
              >
                {l.label}
              </a>
            ))}
            <div className="py-2">
              <LogoutButton />
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
