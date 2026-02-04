export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface WorkshopOffering {
  id: string;
  offering: string;
  intake: string;
  yearGroup: string;
  subject: string;
  workshopDate: string;
  sessionTime: string;
  availability: string;
  price: number;
  priceLabel: string;
  zoomLink: string;
  stripePriceId?: string;
}

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  phone: string;
  tags?: string[];
  customFields?: CustomField[];
}

export interface CustomField {
  id: string;
  field_value: string;
}

export interface ContactInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export interface Booking {
  id: string;
  bookingId: string;
  parentContactId: string;
  studentContactId: string;
  workshopOfferingId: string;
  paymentStatus: string;
  pricePaid: number;
  webhookTriggered: boolean;
}

export interface BookingRequest {
  offeringId: string;
  parent: ContactInput;
  student: ContactInput;
}

export interface BookingResponse {
  bookingId: string;
  recordId: string;
  parentContactId: string;
  studentContactId: string;
  checkoutUrl: string;
}

export interface GHLRecordsResponse {
  records: GHLRecord[];
  meta?: {
    total: number;
    page: number;
    pageLimit: number;
  };
}

export interface GHLRecord {
  id: string;
  properties: Record<string, unknown>;
}

export interface GHLContactsResponse {
  contacts: GHLContact[];
  meta?: {
    total: number;
  };
}

export interface GHLContact {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  phone?: string;
  tags?: string[];
  customFields?: Array<{
    id: string;
    value: string;
  }>;
}

export interface GHLContactResponse {
  contact: GHLContact;
}

export interface GHLRecordResponse {
  record: GHLRecord;
}

export const OFFERING_FIELDS = {
  offering: 'offering',
  intake: 'intake',
  yearGroup: 'year_group',
  subject: 'subject',
  workshopDate: 'workshop_date',
  sessionTime: 'session_time',
  availability: 'availability',
  price: 'price',
  priceLabel: 'price_label',
  zoomLink: 'zoom_link',
  stripePriceId: 'stripe_price_id',
} as const;

export const BOOKING_FIELDS = {
  id: 'id',
  parentContactId: 'parent_contact_id',
  studentContactId: 'student_contact_id',
  workshopOfferingId: 'workshop_offering_id',
  paymentStatus: 'payment_status',
  pricePaid: 'price',
  webhookTriggered: 'webhook_triggered',
} as const;

export const CONTACT_CUSTOM_FIELDS = {
  contactType: 'Y78OZFHJ5tVCNyVble9a',
  parentContactId: 'EAfs2UwBSmgNDU89Yhlj',
  yearGroup: '6VQA8CZUWQOGjq3yspkl',
} as const;

export const AVAILABILITY = {
  AVAILABLE: 'available',
  FULL: 'full',
  INACTIVE: 'inactive',
} as const;

export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  OFFERING_NOT_FOUND: 'OFFERING_NOT_FOUND',
  OFFERING_UNAVAILABLE: 'OFFERING_UNAVAILABLE',
  OFFERING_PAST: 'OFFERING_PAST',
  DUPLICATE_BOOKING: 'DUPLICATE_BOOKING',
  CREATE_ERROR: 'CREATE_ERROR',
  FETCH_ERROR: 'FETCH_ERROR',
} as const;

export const STRIPE_ERROR_CODES = {
  VALIDATION_ERROR: 'STRIPE_VALIDATION_ERROR',
  SESSION_CREATE_FAILED: 'SESSION_CREATE_FAILED',
  CARD_ERROR: 'CARD_ERROR',
  WEBHOOK_SIGNATURE_MISSING: 'WEBHOOK_SIGNATURE_MISSING',
  WEBHOOK_SIGNATURE_INVALID: 'WEBHOOK_SIGNATURE_INVALID',
  WEBHOOK_PROCESSING_FAILED: 'WEBHOOK_PROCESSING_FAILED',
  BOOKING_NOT_FOUND: 'BOOKING_NOT_FOUND',
} as const;

export interface CreateCheckoutSessionRequest {
  bookingId: string;
  customerEmail: string;
  customerName: string;
  priceId?: string;
  amount?: number;
  description?: string;
}

export interface CheckoutSessionResponse {
  clientSecret: string;
  publishableKey: string;
}

export interface BookingWebhookPayload {
  booking: {
    bookingId: string;
    paymentStatus: string;
    pricePaid: number;
  };
  offering: {
    name: string;
    subject: string;
    workshopDate: string;
    sessionTime: string;
    yearGroup: string;
    zoomLink: string;
  };
  parent: {
    name: string;
    email: string;
    phone: string;
  };
  student: {
    name: string;
    email: string;
  };
  payment: {
    stripeSessionId: string;
    stripePaymentIntentId: string | null;
    amountTotal: number | null;
    currency: string | null;
  };
}
