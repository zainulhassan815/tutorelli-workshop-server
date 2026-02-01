// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

// Offering Types
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
  productId: string; // GHL product ID for checkout
}

// Contact Types
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

// Booking Types
export interface Booking {
  id: string;
  bookingId: string;
  parentContactId: string;
  studentContactId: string;
  workshopOfferingId: string;
  paymentStatus: string;
  pricePaid: number;
}

// New comprehensive booking request (from frontend)
export interface BookingRequest {
  offeringId: string;
  parent: ContactInput;
  student: ContactInput;
}

// Booking response with checkout URL
export interface BookingResponse {
  bookingId: string;
  recordId: string;
  parentContactId: string;
  studentContactId: string;
  checkoutUrl: string;
}

// GHL API Response Types
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

// Field mappings
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
  productId: 'product_id',
} as const;

export const BOOKING_FIELDS = {
  id: 'id',
  parentContactId: 'parent_contact_id',
  studentContactId: 'student_contact_id',
  workshopOfferingId: 'workshop_offering_id',
  paymentStatus: 'payment_status',
  pricePaid: 'price',
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

// Error codes
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  OFFERING_NOT_FOUND: 'OFFERING_NOT_FOUND',
  OFFERING_UNAVAILABLE: 'OFFERING_UNAVAILABLE',
  OFFERING_PAST: 'OFFERING_PAST',
  OFFERING_NO_PRODUCT: 'OFFERING_NO_PRODUCT',
  DUPLICATE_BOOKING: 'DUPLICATE_BOOKING',
  CREATE_ERROR: 'CREATE_ERROR',
  FETCH_ERROR: 'FETCH_ERROR',
} as const;
