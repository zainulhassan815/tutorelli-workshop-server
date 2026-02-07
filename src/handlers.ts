import { ZodError } from 'zod';
import { config } from './config';
import { offeringsQuerySchema, bookingRequestSchema } from './validation';
import {
  fetchOfferings,
  fetchOfferingById,
  getOrCreateParentContact,
  getOrCreateStudentContact,
  findBookingByStudentAndOffering,
  createBookingRecord,
} from './ghl';
import type { ApiResponse, BookingResponse } from './types';
import { AVAILABILITY, ERROR_CODES } from './types';

function successResponse<T>(data: T): Response {
  const body: ApiResponse<T> = { success: true, data };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function errorResponse(code: string, message: string, status = 400): Response {
  const body: ApiResponse<never> = {
    success: false,
    error: { code, message },
  };
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function formatZodError(error: ZodError): string {
  return error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
}

function getTodayDateString(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildCheckoutUrl(params: {
  bookingId: string;
  parentEmail: string;
  parentName: string;
  parentPhone: string;
  studentName: string;
  studentEmail: string;
  offeringId: string;
  offeringName: string;
  subject: string;
  workshopDate: string;
  sessionTime: string;
  yearGroup: string;
  zoomLink: string;
  price: number;
}): string {
  const queryParams = new URLSearchParams({
    booking_id: params.bookingId,
    parent_name: params.parentName,
    parent_email: params.parentEmail,
    parent_phone: params.parentPhone,
    student_name: params.studentName,
    student_email: params.studentEmail,
    offering_id: params.offeringId,
    offering_name: params.offeringName,
    offering_subject: params.subject,
    offering_date: params.workshopDate,
    offering_time: params.sessionTime,
    offering_year_group: params.yearGroup,
    offering_zoom_link: params.zoomLink,
    offering_price: String(params.price),
  });

  return `${config.checkoutBaseUrl}?${queryParams.toString()}`;
}

export async function handleHealth(): Promise<Response> {
  return successResponse({ status: 'ok', timestamp: new Date().toISOString() });
}

export async function handleGetOfferings(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const yearGroup = url.searchParams.get('yearGroup');

    const parsed = offeringsQuerySchema.safeParse({ yearGroup });
    if (!parsed.success) {
      return errorResponse(ERROR_CODES.VALIDATION_ERROR, formatZodError(parsed.error));
    }

    const offerings = await fetchOfferings(parsed.data.yearGroup);

    return successResponse(offerings);
  } catch (error) {
    console.error('Error fetching offerings:', error);
    return errorResponse(
      ERROR_CODES.FETCH_ERROR,
      error instanceof Error ? error.message : 'Failed to fetch offerings',
      500
    );
  }
}

export async function handleCreateBooking(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const parsed = bookingRequestSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(ERROR_CODES.VALIDATION_ERROR, formatZodError(parsed.error));
    }

    const { offeringId, parent, student } = parsed.data;

    const offering = await fetchOfferingById(offeringId);

    if (!offering) {
      return errorResponse(ERROR_CODES.OFFERING_NOT_FOUND, 'Offering not found', 404);
    }

    if (offering.availability === AVAILABILITY.INACTIVE) {
      return errorResponse(ERROR_CODES.OFFERING_UNAVAILABLE, 'Workshop is no longer available');
    }

    if (offering.availability === AVAILABILITY.FULL) {
      return errorResponse(ERROR_CODES.OFFERING_UNAVAILABLE, 'Workshop is full');
    }

    const today = getTodayDateString();
    if (offering.workshopDate < today) {
      return errorResponse(ERROR_CODES.OFFERING_PAST, 'Workshop date has passed');
    }

    const workshopTag = `workshop-${offering.yearGroup}-${offering.subject}-${offering.workshopDate}`
      .toLowerCase()
      .replace(/\s+/g, '-');

    const parentContact = await getOrCreateParentContact({
      firstName: parent.firstName,
      lastName: parent.lastName,
      email: parent.email,
      phone: parent.phone,
      workshopTag,
    });

    const studentContact = await getOrCreateStudentContact({
      firstName: student.firstName,
      lastName: student.lastName,
      email: student.email,
      phone: student.phone,
      workshopTag,
      parentContactId: parentContact.id,
      yearGroup: offering.yearGroup,
    });

    const existingBooking = await findBookingByStudentAndOffering(studentContact.id, offeringId);

    if (existingBooking) {
      if (existingBooking.paymentStatus === 'pending') {
        const checkoutUrl = buildCheckoutUrl({
          bookingId: existingBooking.bookingId,
          parentEmail: parent.email,
          parentName: `${parent.firstName} ${parent.lastName}`,
          parentPhone: parent.phone,
          studentName: `${student.firstName} ${student.lastName}`,
          studentEmail: student.email,
          offeringId,
          offeringName: offering.offering,
          subject: offering.subject,
          workshopDate: offering.workshopDate,
          sessionTime: offering.sessionTime,
          yearGroup: offering.yearGroup,
          zoomLink: offering.zoomLink,
          price: offering.price,
        });

        const response: BookingResponse = {
          bookingId: existingBooking.bookingId,
          recordId: existingBooking.id,
          parentContactId: parentContact.id,
          studentContactId: studentContact.id,
          checkoutUrl,
        };

        return successResponse(response);
      }

      return errorResponse(
        ERROR_CODES.DUPLICATE_BOOKING,
        'Student already booked for this workshop'
      );
    }

    const booking = await createBookingRecord({
      parentContactId: parentContact.id,
      studentContactId: studentContact.id,
      workshopOfferingId: offeringId,
      pricePaid: offering.price,
    });

    const checkoutUrl = buildCheckoutUrl({
      bookingId: booking.bookingId,
      parentEmail: parent.email,
      parentName: `${parent.firstName} ${parent.lastName}`,
      parentPhone: parent.phone,
      studentName: `${student.firstName} ${student.lastName}`,
      studentEmail: student.email,
      offeringId,
      offeringName: offering.offering,
      subject: offering.subject,
      workshopDate: offering.workshopDate,
      sessionTime: offering.sessionTime,
      yearGroup: offering.yearGroup,
      zoomLink: offering.zoomLink,
      price: offering.price,
    });

    const response: BookingResponse = {
      bookingId: booking.bookingId,
      recordId: booking.recordId,
      parentContactId: parentContact.id,
      studentContactId: studentContact.id,
      checkoutUrl,
    };

    return successResponse(response);
  } catch (error) {
    console.error('Error creating booking:', error);
    return errorResponse(
      ERROR_CODES.CREATE_ERROR,
      error instanceof Error ? error.message : 'Failed to create booking',
      500
    );
  }
}

export function handleNotFound(): Response {
  return errorResponse('NOT_FOUND', 'Endpoint not found', 404);
}

export function handleMethodNotAllowed(): Response {
  return errorResponse('METHOD_NOT_ALLOWED', 'Method not allowed', 405);
}
