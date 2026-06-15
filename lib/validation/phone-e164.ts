import { z } from 'zod';

// E.164 Maroc : +212 suivi du préfixe national sans le 0.
//   - 5xxxxxxxx (fixe), 6xxxxxxxx ou 7xxxxxxxx (mobile)
export const zPhoneMaroc = z
  .string()
  .regex(/^\+212[567]\d{8}$/, 'E.164 Maroc requis (+212 + [5|6|7] + 8 chiffres)');
export type PhoneMaroc = z.infer<typeof zPhoneMaroc>;
