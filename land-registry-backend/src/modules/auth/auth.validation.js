import { z } from 'zod';

const password = z.string().min(10, 'Password must contain at least 10 characters').max(128)
  .regex(/[a-z]/, 'Password must include a lowercase letter')
  .regex(/[A-Z]/, 'Password must include an uppercase letter')
  .regex(/[0-9]/, 'Password must include a number');
export const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(190).transform((v) => v.toLowerCase()),
  phone: z.string().trim().regex(/^\+?[0-9]{9,15}$/).optional(),
  password,
}).strict();
export const loginSchema = z.object({ email: z.string().trim().email().transform((v) => v.toLowerCase()), password: z.string().min(1).max(128) }).strict();
export const refreshSchema = z.object({ refreshToken: z.string().min(40).max(200) }).strict();
export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().regex(/^\+?[0-9]{9,15}$/).nullable().optional(),
  walletAddress: z.string().trim().regex(/^0x[a-fA-F0-9]{40}$/, 'walletAddress must be a 0x-prefixed 20-byte address').nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'At least one profile field is required');
export const updateUserStatusSchema = z.object({ status: z.enum(['active','suspended','disabled']) }).strict();
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required').max(128),
  newPassword: password,
}).strict();
