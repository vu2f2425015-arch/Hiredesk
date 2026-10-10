import { z } from 'zod';
import { UserRole } from '../enums.js';

export const UserProfileSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid().nullable(),
  role: z.nativeEnum(UserRole),
  clientId: z.string().uuid().nullable(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  active: z.boolean().default(true),
});

export const AdminSetupSchema = z.object({
  organizationName: z.string().min(2, { message: 'Organization name is required' }),
  organizationSlug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, { message: 'Slug must contain only lowercase letters, numbers, and hyphens' }),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
});

export type UserProfileDto = z.infer<typeof UserProfileSchema>;
export type AdminSetupInput = z.infer<typeof AdminSetupSchema>;
