"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/learn", label: "Canvas", icon: Pencil, testId: "nav-canvas" },
  {
    href: "/journey",
    label: "My Journey",
    icon: Compass,
    testId: "nav-journey",
  },
] as const;

export function AppNav({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        "flex items-center gap-1 rounded-full border border-white/80 bg-white/90 p-1 shadow-soft backdrop-blur-md",
        className
      )}
      data-testid="app-nav"
      aria-label="Main"
    >
      {links.map(({ href, label, icon: Icon, testId }) => {
        const active =
          pathname === href ||
          (href !== "/learn" && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            data-testid={testId}
            className={cn(
              "inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-mc-purple/30",
              active
                ? "bg-mc-purple text-white shadow-soft"
                : "text-mc-ink/75 hover:bg-mc-purple-soft hover:text-mc-purple"
            )}
            aria-current={active ? "page" : undefined}
          >
            <Icon className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{label === "My Journey" ? "Journey" : label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
