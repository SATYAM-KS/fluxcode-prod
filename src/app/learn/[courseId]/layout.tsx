export default function LearnLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-zinc-950">
      {children}
    </div>
  );
}
