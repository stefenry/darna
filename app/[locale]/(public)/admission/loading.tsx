// Skeleton screen — pas de spinner (NFR40 règle Aïcha, AR21).
export default function AdmissionLoading() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="animate-pulse space-y-6">
        <div className="space-y-3">
          <div className="h-8 w-2/3 rounded-[10px] bg-bg-soft" />
          <div className="h-4 w-full rounded-[10px] bg-bg-soft" />
        </div>
        <div className="space-y-4">
          <div className="h-12 w-full rounded-[14px] bg-bg-soft" />
          <div className="h-12 w-full rounded-[14px] bg-bg-soft" />
          <div className="h-12 w-full rounded-[14px] bg-bg-soft" />
          <div className="h-12 w-full rounded-[14px] bg-bg-soft" />
        </div>
        <div className="h-12 w-full rounded-[14px] bg-bg-soft" />
      </div>
    </main>
  );
}
