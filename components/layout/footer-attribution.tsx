import { getTranslations } from 'next-intl/server';

export async function FooterAttribution() {
  const t = await getTranslations('footer');

  return (
    <footer className="mt-auto border-t-0 py-6 text-center text-sm text-neutral-400">
      <p>{t('attribution')}</p>
    </footer>
  );
}
