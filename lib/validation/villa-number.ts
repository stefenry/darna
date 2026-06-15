import { z } from 'zod';

export const zVillaNumber = z
  .number()
  .int('numero de villa entier')
  .min(1, 'numero de villa ≥1')
  .max(150, 'numero de villa ≤150');
export type VillaNumber = z.infer<typeof zVillaNumber>;
