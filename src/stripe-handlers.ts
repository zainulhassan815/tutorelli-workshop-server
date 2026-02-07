import { stripe } from './stripe-client';
import { config } from './config';
import { createCheckoutSessionSchema } from './validation';
import { findBookingByBookingId, updateBooking, triggerBookingWebhook } from './ghl';
import { STRIPE_ERROR_CODES } from './types';
import type { ApiResponse, CheckoutSessionResponse } from './types';

function jsonResponse<T>(data: ApiResponse<T>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function handleCreateCheckoutSession(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const result = createCheckoutSessionSchema.safeParse(body);

    if (!result.success) {
      return jsonResponse(
        {
          success: false,
          error: {
            code: STRIPE_ERROR_CODES.VALIDATION_ERROR,
            message: result.error.errors[0]?.message || 'Invalid request',
          },
        },
        400
      );
    }

    const {
      bookingId, customerEmail, customerName, priceId, amount, description,
      parentPhone, studentName, studentEmail,
      offeringId, offeringName, offeringSubject, offeringDate, offeringTime, offeringYearGroup, offeringZoomLink,
    } = result.data;

    const lineItems = priceId
      ? [{ price: priceId, quantity: 1 }]
      : [
          {
            price_data: {
              currency: config.stripe.currency,
              product_data: {
                name: description!,
                description: `Booking ID: ${bookingId}`,
              },
              unit_amount: amount!,
            },
            quantity: 1,
          },
        ];

    const session = await stripe.checkout.sessions.create({
      ui_mode: 'embedded',
      mode: 'payment',
      customer_email: customerEmail,
      line_items: lineItems,
      metadata: {
        bookingId,
        customerName,
        customerEmail,
        parentPhone,
        studentName,
        studentEmail,
        offeringId,
        offeringName,
        offeringSubject,
        offeringDate,
        offeringTime,
        offeringYearGroup,
        offeringZoomLink,
      },
      return_url: `${config.stripe.successUrl}?booking_id=${bookingId}&session_id={CHECKOUT_SESSION_ID}`,
    });

    return jsonResponse<CheckoutSessionResponse>({
      success: true,
      data: {
        clientSecret: session.client_secret!,
        publishableKey: config.stripe.publishableKey,
      },
    });
  } catch (error: any) {
    console.error('Stripe session creation error:', error);

    if (error.type === 'StripeCardError') {
      return jsonResponse(
        {
          success: false,
          error: {
            code: STRIPE_ERROR_CODES.CARD_ERROR,
            message: error.message,
          },
        },
        400
      );
    }

    return jsonResponse(
      {
        success: false,
        error: {
          code: STRIPE_ERROR_CODES.SESSION_CREATE_FAILED,
          message: 'Failed to create checkout session',
        },
      },
      500
    );
  }
}

export async function handleStripeWebhook(request: Request): Promise<Response> {
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return jsonResponse(
      {
        success: false,
        error: {
          code: STRIPE_ERROR_CODES.WEBHOOK_SIGNATURE_MISSING,
          message: 'Missing Stripe signature',
        },
      },
      400
    );
  }

  let event;

  try {
    const rawBody = await request.text();

    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      config.stripe.webhookSecret
    );
  } catch (error: any) {
    console.error('Webhook signature verification failed:', error.message);
    return jsonResponse(
      {
        success: false,
        error: {
          code: STRIPE_ERROR_CODES.WEBHOOK_SIGNATURE_INVALID,
          message: 'Invalid webhook signature',
        },
      },
      400
    );
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const meta = session.metadata || {};
        const bookingId = meta.bookingId;

        if (!bookingId) {
          console.error('Webhook: Missing bookingId in session metadata');
          break;
        }

        const booking = await findBookingByBookingId(bookingId);

        if (!booking) {
          console.error(`Webhook: Booking not found: ${bookingId}`);
          break;
        }

        // Fully processed — nothing to do
        if (booking.paymentStatus === 'paid' && booking.webhookTriggered) {
          console.log(`Webhook: Booking ${bookingId} already complete, skipping`);
          break;
        }

        const paymentIntent = session.payment_intent;

        // Mark as paid if not already (idempotent on retries)
        if (booking.paymentStatus !== 'paid') {
          await updateBooking(booking.id, {
            paymentStatus: 'paid',
            currency: session.currency || '',
            paymentReference: typeof paymentIntent === 'string' ? paymentIntent : paymentIntent?.id ?? '',
          });
          console.log(`Webhook: Booking ${bookingId} marked as paid`);
        }

        // Trigger GHL webhook — if this fails, the whole handler returns 500
        // so Stripe retries. The payment update above is skipped on retry
        // (already paid), but we reattempt the webhook since webhookTriggered is still false.

        await triggerBookingWebhook({
          booking: {
            bookingId: booking.bookingId,
            paymentStatus: 'paid',
            pricePaid: booking.pricePaid,
          },
          offering: {
            id: meta.offeringId || '',
            name: meta.offeringName || '',
            subject: meta.offeringSubject || '',
            workshopDate: meta.offeringDate || '',
            sessionTime: meta.offeringTime || '',
            yearGroup: meta.offeringYearGroup || '',
            zoomLink: meta.offeringZoomLink || '',
          },
          parent: {
            name: meta.customerName || '',
            email: meta.customerEmail || '',
            phone: meta.parentPhone || '',
          },
          student: {
            name: meta.studentName || '',
            email: meta.studentEmail || '',
          },
          payment: {
            stripeSessionId: session.id,
            stripePaymentIntentId: typeof paymentIntent === 'string' ? paymentIntent : paymentIntent?.id ?? null,
            amountTotal: session.amount_total,
            currency: session.currency,
          },
        });

        // Mark webhook as triggered — if this fails, Stripe retries,
        // webhook fires again (acceptable), and we reattempt the flag update.
        await updateBooking(booking.id, { webhookTriggered: true });
        console.log(`Webhook: Booking ${bookingId} fully processed`);
        break;
      }

      case 'checkout.session.expired': {
        const session = event.data.object;
        const bookingId = session.metadata?.bookingId;

        if (!bookingId) {
          console.error('Webhook: Missing bookingId in session metadata');
          break;
        }

        const booking = await findBookingByBookingId(bookingId);

        if (!booking) {
          console.error(`Webhook: Booking not found: ${bookingId}`);
          break;
        }

        if (booking.paymentStatus === 'pending') {
          await updateBooking(booking.id, { paymentStatus: 'expired' });
          console.log(`Webhook: Booking ${bookingId} marked as expired`);
        }
        break;
      }

      default:
        console.log(`Webhook: Unhandled event type: ${event.type}`);
    }

    return jsonResponse({ success: true });
  } catch (error: any) {
    console.error('Webhook processing error:', error);
    return jsonResponse(
      {
        success: false,
        error: {
          code: STRIPE_ERROR_CODES.WEBHOOK_PROCESSING_FAILED,
          message: 'Webhook processing failed',
        },
      },
      500
    );
  }
}
