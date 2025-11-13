import { type APIRoute } from 'astro';
import Stripe from 'stripe';
import { STRIPE_SECRET_KEY } from '../../../lib/config';
import { getCart } from '../../../lib/wc-api';

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

    // Récupérer le panier depuis WooCommerce
    const cart = await getCart(cookie);
    
    if (!cart || !cart.items || cart.items.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Cart is empty' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Calculer le montant total en centimes
    const totalAmount = cart.totals?.total_price || '0';
    const amountInCents = Math.round(
      parseFloat(totalAmount.toString().replace(/[€\s,]/g, '').replace(',', '.')) * 100
    );

    if (amountInCents <= 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid amount' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Créer le Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'eur',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        cart_key: cart.cart_key || '',
        customer_email: body.email || '',
      },
    });

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error creating payment intent:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to create payment intent',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

