import { z } from "zod";
import { UserRole } from "../enums.js";

export const UserProfileSchema = z.object({
  id: z.string().uuid(),
  authUserId: z.string().uuid(),
  organizationId: z.string().uuid().nullable(),
  organizationName: z.string().nullable().optional(),
  role: z.nativeEnum(UserRole),
  clientId: z.string().uuid().nullable(),
  clientName: z.string().nullable().optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  fullName: z.string().nullable().optional(),
  email: z.string().email(),
  isActive: z.boolean().default(true),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const BootstrapSuperAdminSchema = z.object({
  authUserId: z
    .string()
    .uuid({ message: "Valid Supabase auth UUID is required" }),
  email: z.string().email({ message: "Valid email is required" }),
  firstName: z.string().min(1, { message: "First name is required" }),
  lastName: z.string().min(1, { message: "Last name is required" }),
  bootstrapSecret: z
    .string()
    .min(8, { message: "Bootstrap secret is required" }),
});

export const CreateOrganizationSchema = z.object({
  name: z.string().min(2, { message: "Organization name is required" }),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, {
      message:
        "Slug must contain only lowercase alphanumeric characters and hyphens",
    }),
});

export const CreateClientSchema = z.object({
  organizationId: z.string().uuid().optional(), // Required if caller is super_admin; inferred if manager/recruiter
  name: z.string().min(2, { message: "Client name is required" }),
  contactEmail: z
    .string()
    .email({ message: "Valid contact email is required" }),
  contactPhone: z.string().max(50).optional(),
});

export const CreateUserSchema = z.object({
  authUserId: z
    .string()
    .uuid({ message: "Valid Supabase auth UUID is required" }),
  email: z.string().email({ message: "Valid email is required" }),
  firstName: z.string().min(1, { message: "First name is required" }),
  lastName: z.string().min(1, { message: "Last name is required" }),
  role: z.nativeEnum(UserRole),
  organizationId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
});

export const RegisterUserSchema = z.object({
  email: z
    .string()
    .email({ message: "Valid email address is required" })
    .trim()
    .toLowerCase(),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters long" })
    .max(128, { message: "Password cannot exceed 128 characters" })
    .refine((val) => val.trim().length >= 8, {
      message: "Password cannot consist solely of whitespace",
    }),
  firstName: z.string().min(1, { message: "First name is required" }).trim(),
  lastName: z.string().min(1, { message: "Last name is required" }).trim(),
  organizationName: z
    .string()
    .min(2, { message: "Agency or organization name is required" })
    .trim(),
});

export type UserProfileDto = z.infer<typeof UserProfileSchema>;
export type BootstrapSuperAdminInput = z.infer<
  typeof BootstrapSuperAdminSchema
>;
export type CreateOrganizationInput = z.infer<typeof CreateOrganizationSchema>;
export type CreateClientInput = z.infer<typeof CreateClientSchema>;
export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type RegisterUserInput = z.infer<typeof RegisterUserSchema>;
