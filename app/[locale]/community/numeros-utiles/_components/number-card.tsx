// Story 3.3 (AC1/AC2/AC3/AC5) — carte numéro : label (locale), numéro affiché en
// `dir="ltr"` (un numéro ne s'inverse pas en RTL, D3), note contextuelle (fallback
// FR), et bouton « Appeler » ≥ 56px (CallButton inline partagé). Style borderless v2.

import { useTranslations } from 'next-intl';
import { CallButton } from '@/components/content/call-button';
import { ReportButton } from '@/components/content/report-button';
import type { UsefulNumber } from '../data';

const MA_MOBILE = /^\+212(\d)(\d{2})(\d{2})(\d{2})(\d{2})$/;

function formatPhone(e164: string): string {
  const ma = e164.match(MA_MOBILE);
  if (ma) return `+212 ${ma[1]} ${ma[2]} ${ma[3]} ${ma[4]} ${ma[5]}`;
  return e164;
}

export function NumberCard({ number }: { number: UsefulNumber }) {
  const t = useTranslations('community.numerosUtiles');
  return (
    <div className="flex flex-col gap-2 rounded-[14px] bg-white p-4 shadow-xs">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-neutral-900">{number.label}</h3>
            {number.untranslated && (
              <span className="shrink-0 rounded-sm bg-bg-soft px-2 py-0.5 text-xs font-medium text-neutral-500">
                {t('notTranslatedBadge')}
              </span>
            )}
          </div>
          <span dir="ltr" className="w-fit text-sm tabular-nums tracking-wide text-neutral-600">
            {formatPhone(number.phoneE164)}
          </span>
          {number.notes && <span className="text-sm text-neutral-500">{number.notes}</span>}
        </div>
        <CallButton
          phoneE164={number.phoneE164}
          label={t('callAction')}
          ariaLabel={t('call', { label: number.label })}
          unavailableLabel={t('unavailable')}
          variant="inline"
        />
      </div>
      <ReportButton targetType="useful_number" targetId={number.id} />
    </div>
  );
}
