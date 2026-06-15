export default function PublicLoading() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 rounded-[10px] bg-bg-soft" />
        <div className="space-y-3">
          <div className="h-4 w-full rounded-[10px] bg-bg-soft" />
          <div className="h-4 w-3/4 rounded-[10px] bg-bg-soft" />
          <div className="h-4 w-5/6 rounded-[10px] bg-bg-soft" />
        </div>
      </div>
    </main>
  );
}
