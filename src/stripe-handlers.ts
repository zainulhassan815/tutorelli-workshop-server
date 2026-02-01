import { stripe } from './stripe-client';
import { config } from './config';
import { createCheckoutSessionSchema } from './validation';
import { findBookingByBookingId, updateBookingPaymentStatus } from './ghl';
import { STRIPE_ERROR_CODES } from './types';
import type { ApiResponse, CheckoutSessionResponse } from './types';

function jsonResponse<T>(data: ApiResponse<T>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Creates a Stripe Embedded Checkout session
 * Called from GHL funnel page custom code widget
 */
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

    const { bookingId, customerEmail, customerName, priceId, amount, description } = result.data;

    // Build line items - either use existing price ID or create inline pricing
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

    // Create Stripe Checkout Session in embedded mode
    const session = await stripe.checkout.sessions.create({
      ui_mode: 'embedded',
      mode: 'payment',
      customer_email: customerEmail,
      line_items: lineItems,
      metadata: {
        bookingId,
        customerName,
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

    // Handle Stripe-specific errors
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

/**
 * Handles Stripe webhook events
 * Updates booking payment status in GHL
 */
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
    // Get raw body for signature verification
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
        const bookingId = session.metadata?.bookingId;

        if (!bookingId) {
          console.error('Webhook: Missing bookingId in session metadata');
          break;
        }

        // Find booking in GHL
        const booking = await findBookingByBookingId(bookingId);

        if (!booking) {
          console.error(`Webhook: Booking not found: ${bookingId}`);
          break;
        }

        // Idempotency check - don't update if already paid
        if (booking.paymentStatus === 'paid') {
          console.log(`Webhook: Booking ${bookingId} already paid, skipping`);
          break;
        }

        // Update booking payment status
        await updateBookingPaymentStatus(booking.id, {
          paymentStatus: 'paid',
        });

        console.log(`Webhook: Booking ${bookingId} marked as paid`);
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

        // Only update if still pending
        if (booking.paymentStatus === 'pending') {
          await updateBookingPaymentStatus(booking.id, {
            paymentStatus: 'expired',
          });
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
