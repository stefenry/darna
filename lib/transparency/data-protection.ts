import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { log } from '@/lib/logger';

// Story 8.2 — chargement du texte éditorial « Comment vos données sont protégées ».
// Le contenu est versionné en git (content/transparence/data-protection.{locale}.md) :
// texte légal/CNDP → pas de CMS co_mod, le versioning et la revue de PR comptent.
// Lecture server-only (fs). Fallback FR si la locale demandée est absente.

const CONTENT_DIR = path.join(process.cwd(), 'content', 'transparence');

export async function loadDataProtection(locale: string): Promise<string> {
  const safe = locale === 'ar' ? 'ar' : 'fr';
  try {
    return await readFile(path.join(CONTENT_DIR, `data-protection.${safe}.md`), 'utf8');
  } catch {
    if (safe !== 'fr') {
      try {
        return await readFile(path.join(CONTENT_DIR, 'data-protection.fr.md'), 'utf8');
      } catch {
        /* fallthrough */
      }
    }
    log({
      level: 'error',
      event: 'transparency.data_protection_missing',
      user_id: null,
      residence_id: null,
      request_id: null,
      payload: { locale: safe },
    });
    return '';
  }
}
