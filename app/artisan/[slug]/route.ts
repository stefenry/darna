// Story 6.1 — URL canonique courte `/artisan/<slug>` (locale-less, partageable).
// Coexiste avec la route littérale `/artisan/contact` (Next priorise le littéral).

import { type NextRequest } from 'next/server';
import { handleCanonical } from '@/lib/share/canonical-route';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  return handleCanonical(request, 'artisan', slug);
}
