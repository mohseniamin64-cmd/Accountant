import {z} from 'zod';

export const listQuerySchema = z.object({
  q: z.string().trim().max(160).default(''),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  offset: z.coerce.number().int().min(0).default(0),
  active: z
    .enum(['true', 'false', 'all'])
    .default('true'),
});

export function activeFilter(value: 'true' | 'false' | 'all'): boolean | null {
  if (value === 'all') return null;
  return value === 'true';
}
