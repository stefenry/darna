import { z } from 'zod';

export const zEmail = z.email();
export type Email = z.infer<typeof zEmail>;
