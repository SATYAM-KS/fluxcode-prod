"use client";

import * as React from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

const CYCLE: Array<"light" | "dark" | "system"> = ["light", "dark", "system"];

export function ModeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  function cycleTheme() {
    const current = theme ?? resolvedTheme ?? "dark";
    const idx = CYCLE.indexOf(current as any);
    const next = CYCLE[(idx + 1) % CYCLE.length];
    setTheme(next);
  }

  const current = mounted ? (theme ?? "dark") : "dark";
  const Icon = current === "dark" ? Moon : current === "light" ? Sun : Monitor;

  return (
    <Button
      variant="outline"
      size="icon"
      aria-label="Toggle theme"
      className="relative"
      onClick={cycleTheme}
      title={`Theme: ${current} (click to cycle)`}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}
