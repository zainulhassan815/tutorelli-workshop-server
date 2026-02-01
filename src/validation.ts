import { z } from 'zod';

// Query parameter schemas
export const offeringsQuerySchema = z.object({
  yearGroup: z.enum(['gcse', 'alevel']),
});

// UK mobile regex: +44 followed by 10 digits (7xxxxxxxxx)
const UK_MOBILE_REGEX = /^\+44[0-9]{10}$/;

/**
 * Normalizes a phone number to E.164 format for UK numbers.
 * - Strips all non-digit characters (except leading +)
 * - Converts UK local format (07...) to international (+447...)
 * - Returns null if the result is invalid
 */
export function normalizePhoneNumber(phone: string): string | null {
  // Preserve leading + if present, then strip all non-digits
  const hasPlus = phone.trim().startsWith('+');
  const digitsOnly = phone.replace(/\D/g, '');

  if (!digitsOnly) return null;

  let normalized: string;

  if (hasPlus) {
    // Already has country code - reconstruct with +
    normalized = `+${digitsOnly}`;
  } else if (digitsOnly.startsWith('44') && digitsOnly.length === 12) {
    // UK number without + (e.g., 447123456789)
    normalized = `+${digitsOnly}`;
  } else if (digitsOnly.startsWith('0') && digitsOnly.length === 11) {
    // UK local format (e.g., 07123456789) - convert to +44
    normalized = `+44${digitsOnly.slice(1)}`;
  } else {
    // Unknown format - return as-is with + prefix if it looks international
    if (digitsOnly.length >= 10 && digitsOnly.length <= 15) {
      normalized = hasPlus ? `+${digitsOnly}` : digitsOnly;
    } else {
      return null;
    }
  }

  return normalized;
}

// Phone schema with normalization and validation
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

// Contact input schema (reusable)
const contactInputSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  email: z.string().email('Invalid email format'),
  phone: phoneSchema,
});

// New comprehensive booking request schema
export const bookingRequestSchema = z.object({
  offeringId: z.string().min(1, 'Offering ID is required'),
  parent: contactInputSchema,
  student: contactInputSchema,
});

// Type exports
export type OfferingsQuery = z.infer<typeof offeringsQuerySchema>;
export type ContactInput = z.infer<typeof contactInputSchema>;
export type BookingRequest = z.infer<typeof bookingRequestSchema>;
