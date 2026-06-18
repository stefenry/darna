import { PageContainer } from '@/components/layout/page-container';

// AR21 — skeleton screen, jamais de spinner (NFR40 règle Aïcha).
export default function Loading() {
  return (
    <PageContainer className="py-10" as="main">
      <section className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <div className="h-8 w-48 animate-pulse rounded-[14px] bg-bg-soft" />
          <div className="h-5 w-72 animate-pulse rounded-[14px] bg-bg-soft" />
        </div>
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-[14px] bg-bg-soft" />
          ))}
        </div>
      </section>
    </PageContainer>
  );
}
