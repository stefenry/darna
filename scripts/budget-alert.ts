/* eslint-disable no-console */
interface ProviderCost {
  name: string;
  estimated_eur: number;
  details: Record<string, string>;
}

const BUDGET_THRESHOLD = Number(process.env.BUDGET_THRESHOLD_MVP || '15');
const ALERT_EMAIL = process.env.ALERT_EMAIL || 'henry.stephane@gmail.com';

async function fetchJson<T>(url: string, headers: Record<string, string>): Promise<T> {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`${url} → ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

async function getSupabaseCost(): Promise<ProviderCost> {
  const ref = process.env.SUPABASE_PROJECT_REF!;
  const token = process.env.SUPABASE_ACCESS_TOKEN!;
  const data = await fetchJson<{ total_storage_size_bytes?: number; total_egress_bytes?: number }>(
    `https://api.supabase.com/v1/projects/${ref}/usage`,
    { Authorization: `Bearer ${token}` },
  );
  const storageGb = (data.total_storage_size_bytes ?? 0) / 1e9;
  const bandwidthGb = (data.total_egress_bytes ?? 0) / 1e9;
  const estimated = storageGb * 0.021 + bandwidthGb * 0.09;
  return {
    name: 'Supabase',
    estimated_eur: estimated,
    details: { storage: `${storageGb.toFixed(2)} GB`, bandwidth: `${bandwidthGb.toFixed(2)} GB` },
  };
}

async function getVercelCost(): Promise<ProviderCost> {
  const token = process.env.VERCEL_TOKEN!;
  const teamId = process.env.VERCEL_ORG_ID || '';
  const qs = teamId ? `?teamId=${teamId}` : '';
  const data = await fetchJson<{
    usage?: { bandwidth?: number; serverlessFunctionInvocations?: number };
  }>(`https://api.vercel.com/v1/usage${qs}`, { Authorization: `Bearer ${token}` });
  const bandwidth = (data.usage?.bandwidth ?? 0) / 1e9;
  const invocations = data.usage?.serverlessFunctionInvocations ?? 0;
  const estimated = bandwidth * 0.15 + invocations * 0.000002;
  return {
    name: 'Vercel',
    estimated_eur: estimated,
    details: {
      bandwidth: `${bandwidth.toFixed(2)} GB`,
      invocations: String(invocations),
    },
  };
}

async function getR2Cost(): Promise<ProviderCost> {
  const accountId = process.env.R2_ACCOUNT_ID!;
  const token = process.env.R2_API_TOKEN!;
  const data = await fetchJson<{ result?: Array<{ name: string }> }>(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets`,
    { Authorization: `Bearer ${token}` },
  );
  const bucketCount = data.result?.length ?? 0;
  const estimated = bucketCount * 0.015;
  return {
    name: 'R2',
    estimated_eur: estimated,
    details: { buckets: String(bucketCount) },
  };
}

async function getBrevoCost(): Promise<ProviderCost> {
  const apiKey = process.env.BREVO_API_KEY!;
  const data = await fetchJson<{
    plan?: Array<{ credits?: number; type?: string }>;
    email?: { count?: number };
  }>('https://api.brevo.com/v3/account', { 'api-key': apiKey });
  const credits = data.plan?.[0]?.credits ?? 0;
  const emailsSent = data.email?.count ?? 0;
  return {
    name: 'Brevo',
    estimated_eur: 0,
    details: {
      emails_sent: String(emailsSent),
      credits_remaining: String(credits),
    },
  };
}

async function sendBrevoAlert(subject: string, body: string): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY!;
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: { name: 'Darna Budget', email: 'noreply@darna.app' },
      to: [{ email: ALERT_EMAIL }],
      subject,
      textContent: body,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Brevo send failed: ${res.status} ${text}`);
  }
}

const REQUIRED_ENV = [
  'SUPABASE_PROJECT_REF',
  'SUPABASE_ACCESS_TOKEN',
  'VERCEL_TOKEN',
  'R2_ACCOUNT_ID',
  'R2_API_TOKEN',
  'BREVO_API_KEY',
] as const;

async function main(): Promise<void> {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(`Missing required env vars: ${missing.join(', ')}`);
    process.exit(1);
  }

  const providers = await Promise.allSettled([
    getSupabaseCost(),
    getVercelCost(),
    getR2Cost(),
    getBrevoCost(),
  ]);

  const costs: ProviderCost[] = [];
  for (const result of providers) {
    if (result.status === 'fulfilled') {
      costs.push(result.value);
    } else {
      console.error(`Provider fetch failed: ${result.reason}`);
    }
  }

  const total = costs.reduce((sum, c) => sum + c.estimated_eur, 0);
  const dayOfMonth = new Date().getDate();
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const projected = (total / dayOfMonth) * daysInMonth;

  console.log(
    `Projected monthly cost: ${projected.toFixed(2)} EUR (threshold: ${BUDGET_THRESHOLD} EUR)`,
  );

  for (const c of costs) {
    console.log(`  ${c.name}: ${c.estimated_eur.toFixed(2)} EUR — ${JSON.stringify(c.details)}`);
  }

  if (projected > BUDGET_THRESHOLD) {
    const lines = costs.map(
      (c) =>
        `  ${c.name}: ${c.estimated_eur.toFixed(2)} EUR (${Object.entries(c.details)
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ')})`,
    );
    const body = [
      ...lines,
      `  TOTAL ESTIME: ${projected.toFixed(2)} EUR/mois`,
      `  Seuil actuel: ${BUDGET_THRESHOLD} EUR`,
    ].join('\n');

    const subject = `[Darna] Alerte budget — coût estimé ${projected.toFixed(0)} EUR/mois`;
    try {
      await sendBrevoAlert(subject, body);
      console.log('Alert email sent.');
    } catch (err) {
      console.error(`::warning::Failed to send budget alert email: ${err}`);
    }
  } else {
    console.log('Under budget threshold — no alert sent.');
  }
}

main().catch((err) => {
  console.error('Budget alert script failed:', err);
  process.exit(1);
});
