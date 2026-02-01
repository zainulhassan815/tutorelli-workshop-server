import { ghl } from './ghl-client';
import { config } from './config';
import type {
  WorkshopOffering,
  Contact,
  Booking,
  CustomField,
} from './types';
import { OFFERING_FIELDS, BOOKING_FIELDS, AVAILABILITY, CONTACT_CUSTOM_FIELDS } from './types';

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function getTodayDateString(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parsePrice(priceField: unknown): number {
  if (!priceField) return 0;
  if (typeof priceField === 'number') return priceField;
  if (typeof priceField === 'object' && priceField !== null && 'value' in priceField) {
    return Number((priceField as { value: unknown }).value) || 0;
  }
  return parseFloat(String(priceField)) || 0;
}

function parseOfferingFromRecord(record: { id: string; properties: Record<string, unknown> }): WorkshopOffering {
  const props = record.properties || {};
  return {
    id: record.id,
    offering: String(props[OFFERING_FIELDS.offering] || ''),
    intake: String(props[OFFERING_FIELDS.intake] || ''),
    yearGroup: String(props[OFFERING_FIELDS.yearGroup] || ''),
    subject: String(props[OFFERING_FIELDS.subject] || ''),
    workshopDate: String(props[OFFERING_FIELDS.workshopDate] || ''),
    sessionTime: String(props[OFFERING_FIELDS.sessionTime] || ''),
    availability: String(props[OFFERING_FIELDS.availability] || '').toLowerCase(),
    price: parsePrice(props[OFFERING_FIELDS.price]),
    priceLabel: String(props[OFFERING_FIELDS.priceLabel] || ''),
    zoomLink: String(props[OFFERING_FIELDS.zoomLink] || ''),
    productId: String(props[OFFERING_FIELDS.productId] || ''),
  };
}

function parseBookingFromRecord(record: { id: string; properties: Record<string, unknown> }): Booking {
  const props = record.properties || {};
  return {
    id: record.id,
    bookingId: String(props[BOOKING_FIELDS.id] || ''),
    parentContactId: String(props[BOOKING_FIELDS.parentContactId] || ''),
    studentContactId: String(props[BOOKING_FIELDS.studentContactId] || ''),
    workshopOfferingId: String(props[BOOKING_FIELDS.workshopOfferingId] || ''),
    paymentStatus: String(props[BOOKING_FIELDS.paymentStatus] || ''),
    pricePaid: parsePrice(props[BOOKING_FIELDS.pricePaid]),
  };
}

// ============================================================
// OFFERINGS
// ============================================================

export async function fetchOfferings(yearGroup: string): Promise<WorkshopOffering[]> {
  const today = getTodayDateString();

  const response = await ghl.objects.searchObjectRecords(
    { schemaKey: config.schemas.workshopOfferings },
    {
      locationId: config.ghl.locationId,
      page: 1,
      pageLimit: config.request.pageLimit,
      query: '',
      filters: [
        {
          group: 'AND',
          filters: [
            {
              field: `properties.${OFFERING_FIELDS.yearGroup}`,
              operator: 'eq',
              value: yearGroup,
            },
          ],
        },
      ],
      sort: [{ field: 'updatedAt', direction: 'asc' }],
    } as any
  );

  const records = (response.records || []) as unknown as Array<{ id: string; properties: Record<string, unknown> }>;
  const offerings = records.map(parseOfferingFromRecord);

  // Filter: available, not full, not past (done in JS since GHL doesn't support gte for dates)
  return offerings.filter(
    (o) =>
      o.availability !== AVAILABILITY.INACTIVE &&
      o.availability !== AVAILABILITY.FULL &&
      o.workshopDate >= today
  );
}

export async function fetchOfferingById(offeringId: string): Promise<WorkshopOffering | null> {
  try {
    const response = await ghl.objects.getRecordById({
      schemaKey: config.schemas.workshopOfferings,
      id: offeringId,
    });

    if (!response.record) return null;

    const record = response.record as unknown as { id: string; properties: Record<string, unknown> };
    return parseOfferingFromRecord(record);
  } catch (error: any) {
    if (error?.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

// ============================================================
// BOOKINGS
// ============================================================

export async function findBookingByStudentAndOffering(
  studentContactId: string,
  offeringId: string
): Promise<Booking | null> {
  const response = await ghl.objects.searchObjectRecords(
    { schemaKey: config.schemas.bookings },
    {
      locationId: config.ghl.locationId,
      page: 1,
      pageLimit: 1,
      query: '',
      filters: [
        {
          group: 'AND',
          filters: [
            {
              field: `properties.${BOOKING_FIELDS.studentContactId}`,
              operator: 'eq',
              value: studentContactId,
            },
            {
              field: `properties.${BOOKING_FIELDS.workshopOfferingId}`,
              operator: 'eq',
              value: offeringId,
            },
          ],
        },
      ],
    } as any
  );

  const records = (response.records || []) as unknown as Array<{ id: string; properties: Record<string, unknown> }>;
  if (records.length === 0) {
    return null;
  }

  return parseBookingFromRecord(records[0]);
}

function generateBookingId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `BK-${timestamp}-${random}`.toUpperCase();
}

export async function createBookingRecord(input: {
  parentContactId: string;
  studentContactId: string;
  workshopOfferingId: string;
  pricePaid: number;
}): Promise<{ recordId: string; bookingId: string }> {
  const bookingId = generateBookingId();

  const properties: Record<string, unknown> = {
    [BOOKING_FIELDS.id]: bookingId,
    [BOOKING_FIELDS.parentContactId]: input.parentContactId,
    [BOOKING_FIELDS.studentContactId]: input.studentContactId,
    [BOOKING_FIELDS.workshopOfferingId]: input.workshopOfferingId,
    [BOOKING_FIELDS.paymentStatus]: 'pending',
    [BOOKING_FIELDS.pricePaid]: input.pricePaid,
  };

  const response = await ghl.objects.createObjectRecord(
    { schemaKey: config.schemas.bookings },
    {
      locationId: config.ghl.locationId,
      properties,
    } as any
  );

  const record = response.record as unknown as { id: string };

  return {
    recordId: record.id,
    bookingId,
  };
}

// ============================================================
// CONTACTS
// ============================================================

export async function getOrCreateParentContact(input: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  workshopTag: string;
}): Promise<Contact> {
  // Use upsert - creates if not exists, updates if exists
  const response = await ghl.contacts.upsertContact({
    locationId: config.ghl.locationId,
    firstName: input.firstName,
    lastName: input.lastName,
    name: `${input.firstName} ${input.lastName}`,
    email: input.email,
    phone: input.phone,
    tags: ['parent', input.workshopTag],
    source: 'Workshop Booking Form',
    customFields: [
      { id: CONTACT_CUSTOM_FIELDS.contactType, field_value: 'parent' },
    ],
  } as any);

  const contact = response.contact as any;

  return {
    id: contact.id,
    firstName: contact.firstName || '',
    lastName: contact.lastName || '',
    name: contact.name || '',
    email: contact.email || '',
    phone: contact.phone || '',
    tags: contact.tags || [],
  };
}

export async function getOrCreateStudentContact(input: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  workshopTag: string;
  parentContactId: string;
  yearGroup: string;
}): Promise<Contact> {
  // Use upsert - creates if not exists, updates if exists
  const response = await ghl.contacts.upsertContact({
    locationId: config.ghl.locationId,
    firstName: input.firstName,
    lastName: input.lastName,
    name: `${input.firstName} ${input.lastName}`,
    email: input.email,
    phone: input.phone,
    tags: ['student', input.workshopTag],
    source: 'Workshop Booking Form',
    customFields: [
      { id: CONTACT_CUSTOM_FIELDS.contactType, field_value: 'student' },
      { id: CONTACT_CUSTOM_FIELDS.parentContactId, field_value: input.parentContactId },
      { id: CONTACT_CUSTOM_FIELDS.yearGroup, field_value: input.yearGroup },
    ],
  } as any);

  const contact = response.contact as any;

  return {
    id: contact.id,
    firstName: contact.firstName || '',
    lastName: contact.lastName || '',
    name: contact.name || '',
    email: contact.email || '',
    phone: contact.phone || '',
    tags: contact.tags || [],
  };
}
