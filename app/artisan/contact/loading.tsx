// Story 2.8 — skeleton page contact artisan (jamais de spinner, motion-safe).
export default function Loading() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-10">
      <div className="h-8 w-2/3 motion-safe:animate-pulse rounded-[14px] bg-bg-soft" />
      <div className="h-12 motion-safe:animate-pulse rounded-[14px] bg-bg-soft" />
      <div className="h-14 motion-safe:animate-pulse rounded-[14px] bg-bg-soft" />
    </main>
  );
}
