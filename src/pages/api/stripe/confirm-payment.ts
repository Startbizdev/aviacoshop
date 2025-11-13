import { type APIRoute } from 'astro';
import Stripe from 'stripe';
import { STRIPE_SECRET_KEY } from '../../../lib/config';
import { createOrder } from '../../../lib/wc-api';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    if (!STRIPE_SECRET_KEY) {
      return new Response(
        JSON.stringify({ error: 'Stripe secret key not configured' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2024-12-18.acacia',
    });

    const cookie = request.headers.get('cookie') || '';
    const body = await request.json();

    const { paymentIntentId, billing_address, shipping_address, shipping_method, shipping_method_title, order_comments } = body;

    if (!paymentIntentId) {
      return new Response(
        JSON.stringify({ error: 'Payment Intent ID is required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Récupérer le Payment Intent depuis Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return new Response(
        JSON.stringify({ 
          error: 'Payment not completed',
          status: paymentIntent.status 
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Créer la commande dans WooCommerce
    const orderData: any = {
      billing_address,
      shipping_address,
      payment_method: 'stripe',
      payment_method_title: 'Stripe',
      set_paid: true,
      transaction_id: paymentIntent.id,
    };

    if (shipping_method) {
      orderData.shipping_method = shipping_method;
    }
    if (shipping_method_title) {
      orderData.shipping_method_title = shipping_method_title;
    }
    if (order_comments) {
      orderData.customer_note = order_comments;
    }

    // Ajouter les métadonnées de paiement
    orderData.meta_data = [
      {
        key: '_stripe_payment_intent_id',
        value: paymentIntent.id,
      },
      {
        key: '_stripe_charge_id',
        value: paymentIntent.latest_charge || '',
      },
    ];

    const order = await createOrder(orderData, cookie);

    const setCookieHeader = (order as any)?.cookie;
    const responseHeaders = new Headers({
      'Content-Type': 'application/json',
    });

    if (Array.isArray(setCookieHeader) && setCookieHeader.length > 0) {
      setCookieHeader.forEach((cookieValue: string) => {
        responseHeaders.append('Set-Cookie', cookieValue);
      });
    } else if (typeof setCookieHeader === 'string' && setCookieHeader) {
      responseHeaders.append('Set-Cookie', setCookieHeader);
    }

    // Nettoyer le cookie du résultat avant de le renvoyer
    const { cookie: _, ...cleanOrder } = order as any;

    return new Response(JSON.stringify(cleanOrder), {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error: any) {
    console.error('Error confirming payment:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to confirm payment',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

