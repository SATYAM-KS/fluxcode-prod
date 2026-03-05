import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDateTimeIST(input: string | Date) {
  const d = typeof input === "string" ? new Date(input) : input
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function formatDateIST(
  input: string | Date,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }
) {
  const d = typeof input === "string" ? new Date(input) : input
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleDateString("en-US", { timeZone: "Asia/Kolkata", ...options })
}
