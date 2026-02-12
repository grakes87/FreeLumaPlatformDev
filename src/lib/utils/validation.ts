import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  display_name: z
    .string()
    .min(3, 'Display name must be at least 3 characters')
    .max(100, 'Display name must be at most 100 characters'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(
      /^[a-z0-9_]+$/,
      'Username must be lowercase alphanumeric and underscores only'
    ),
  activation_code: z
    .string()
    .length(12, 'Activation code must be 12 characters'),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const activationCodeSchema = z.object({
  code: z.string().length(12, 'Activation code must be 12 characters'),
});

export type ActivationCodeInput = z.infer<typeof activationCodeSchema>;
