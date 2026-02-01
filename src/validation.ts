import { z } from 'zod';

export const offeringsQuerySchema = z.object({
  yearGroup: z.enum(['gcse', 'alevel']),
});

const UK_MOBILE_REGEX = /^\+44[0-9]{10}$/;

/** Normalizes phone numbers to E.164 format, converting UK local format (07...) to international (+447...) */
export function normalizePhoneNumber(phone: string): string | null {
  const hasPlus = phone.trim().startsWith('+');
  const digitsOnly = phone.replace(/\D/g, '');

  if (!digitsOnly) return null;

  let normalized: string;

  if (hasPlus) {
    normalized = `+${digitsOnly}`;
  } else if (digitsOnly.startsWith('44') && digitsOnly.length === 12) {
    normalized = `+${digitsOnly}`;
  } else if (digitsOnly.startsWith('0') && digitsOnly.length === 11) {
    normalized = `+44${digitsOnly.slice(1)}`;
  } else {
    if (digitsOnly.length >= 10 && digitsOnly.length <= 15) {
      normalized = hasPlus ? `+${digitsOnly}` : digitsOnly;
    } else {
      return null;
    }
  }

  return normalized;
}

const phoneSchema = z
  .string()
  .min(1, 'Phone is required')
  .max(20)
  .transform((val) => normalizePhoneNumber(val))
  .refine((val): val is string => val !== null, {
    message: 'Invalid phone number format',
  })
  .refine((val) => UK_MOBILE_REGEX.test(val) || val.startsWith('+'), {
    message: 'Please enter a valid UK mobile number',
  });

const contactInputSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  email: z.string().email('Invalid email format'),
  phone: phoneSchema,
});

export const bookingRequestSchema = z.object({
  offeringId: z.string().min(1, 'Offering ID is required'),
  parent: contactInputSchema,
  student: contactInputSchema,
});

export const createCheckoutSessionSchema = z.object({
  bookingId: z.string().min(1, 'Booking ID is required'),
  customerEmail: z.string().email('Invalid email format'),
  customerName: z.string().min(1, 'Customer name is required'),
  priceId: z.string().optional(),
  amount: z.number().int().positive('Amount must be a positive integer (in pence)').optional(),
  description: z.string().optional(),
}).refine(
  (data) => data.priceId || (data.amount && data.description),
  { message: 'Either priceId or both amount and description are required' }
);

export type OfferingsQuery = z.infer<typeof offeringsQuerySchema>;
export type ContactInput = z.infer<typeof contactInputSchema>;
export type BookingRequest = z.infer<typeof bookingRequestSchema>;
export type CreateCheckoutSessionRequest = z.infer<typeof createCheckoutSessionSchema>;
