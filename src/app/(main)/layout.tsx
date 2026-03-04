import Link from "next/link";
import { NavHeader } from "@/components/nav-header";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <NavHeader />
      {children}
      <footer className="border-t border-border bg-muted/30 py-10">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-sm font-bold">
              Flux<span className="text-primary">Code</span>
            </p>
            <p className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} FluxCode. All rights reserved.
            </p>
            <nav className="flex gap-4 text-xs text-muted-foreground">
              <Link href="/courses" className="hover:text-foreground">Courses</Link>
              <Link href="/login" className="hover:text-foreground">Sign in</Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
