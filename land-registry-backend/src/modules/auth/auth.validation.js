import { z } from 'zod';

const password = z.string().min(10, 'Password must contain at least 10 characters').max(128)
  .regex(/[a-z]/, 'Password must include a lowercase letter')
  .regex(/[A-Z]/, 'Password must include an uppercase letter')
  .regex(/[0-9]/, 'Password must include a number');
export const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(190).transform((v) => v.toLowerCase()),
  phone: z.string().trim().regex(/^\+?[0-9]{9,15}$/),
  accountType: z.enum(['buyer', 'seller', 'buyer_seller']),
  captchaToken: z.string().min(1).max(2048).optional(),
  password,
}).strict();
export const loginSchema = z.object({ email: z.string().trim().email().transform((v) => v.toLowerCase()), password: z.string().min(1).max(128), mfaCode: z.string().regex(/^\d{6}$/).optional(), captchaToken: z.string().min(1).max(2048).optional(), rememberMe: z.boolean().optional() }).strict();
export const googleAuthSchema = z.object({ credential: z.string().min(20).max(8192), accountType: z.enum(['buyer', 'seller', 'buyer_seller']).optional(), phone: z.string().trim().regex(/^\+?[0-9]{9,15}$/).optional(), captchaToken: z.string().min(1).max(2048).optional(), rememberMe: z.boolean().optional() }).strict();
export const mfaSetupSchema = z.object({ password: z.string().min(1).max(128) }).strict();
export const mfaCodeSchema = z.object({ code: z.string().regex(/^\d{6}$/) }).strict();
export const refreshSchema = z.object({ refreshToken: z.string().min(40).max(200) }).strict();
export const tokenSchema = z.object({ token: z.string().min(32).max(200) }).strict();
export const emailVerificationSchema = z.union([
  z.object({
    email: z.string().trim().email().max(190).transform((value) => value.toLowerCase()),
    code: z.string().regex(/^\d{6}$/),
  }).strict(),
  tokenSchema,
]);
export const resetPasswordSchema = z.object({ token: z.string().min(32).max(200), password }).strict();
export const passwordResetRequestSchema = z.object({ email: z.string().trim().email().max(190).transform((v) => v.toLowerCase()) }).strict();
export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().regex(/^\+?[0-9]{9,15}$/).nullable().optional(),
  walletAddress: z.string().trim().regex(/^0x[a-fA-F0-9]{40}$/, 'walletAddress must be a 0x-prefixed 20-byte address').nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'At least one profile field is required');
export const updateUserStatusSchema = z.object({ status: z.enum(['active','suspended','disabled']) }).strict();
export const updateUserRoleSchema = z.object({ role: z.enum(['landowner', 'registrar', 'investigator', 'auditor']) }).strict();
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required').max(128),
  newPassword: password,
}).strict();
export const reviewerAccessRequestSchema = z.object({
  county: z.enum(['Baringo', 'Bomet', 'Bungoma', 'Busia', 'Elgeyo-Marakwet', 'Embu', 'Garissa', 'Homa Bay', 'Isiolo', 'Kajiado', 'Kakamega', 'Kericho', 'Kiambu', 'Kilifi', 'Kirinyaga', 'Kisii', 'Kisumu', 'Kitui', 'Kwale', 'Laikipia', 'Lamu', 'Machakos', 'Makueni', 'Mandera', 'Marsabit', 'Meru', 'Migori', 'Mombasa', 'Murang’a', 'Nairobi', 'Nakuru', 'Nandi', 'Narok', 'Nyamira', 'Nyandarua', 'Nyeri', 'Samburu', 'Siaya', 'Taita-Taveta', 'Tana River', 'Tharaka-Nithi', 'Trans Nzoia', 'Turkana', 'Uasin Gishu', 'Vihiga', 'Wajir', 'West Pokot']),
  applicationType: z.enum(['platform_committee', 'statutory_lcb']),
  boardName: z.string().trim().min(3).max(160),
  appointingAuthority: z.string().trim().min(3).max(160),
  appointmentReference: z.string().trim().min(3).max(120),
  term: z.string().trim().min(3).max(120),
  experience: z.string().trim().min(50).max(1200),
  documentsReady: z.literal(true),
}).strict();
export const profileAvatarSchema = z.object({
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  contentBase64: z.string().min(1).max(700000),
}).strict();
