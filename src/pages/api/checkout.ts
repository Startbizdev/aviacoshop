import { type APIRoute } from 'astro';
import { createOrder, WooCommerceError } from '../../lib/wc-api';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const cookie = request.headers.get('cookie') || '';
    const body = await request.json();
    
    const {
      billing_address,
      shipping_address,
      payment_method = 'bacs',
      payment_method_title = 'Bank Transfer',
      shipping_method,
      shipping_method_title,
      order_comments,
    } = body;
    
    if (!billing_address || !shipping_address) {
      return new Response(JSON.stringify({ error: 'Billing and shipping addresses are required' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
    
    const orderData: any = {
      billing_address,
      shipping_address,
      payment_method,
      payment_method_title,
      set_paid: false,
    };
    
    // Add optional fields if provided
    if (shipping_method) {
      orderData.shipping_method = shipping_method;
    }
    if (shipping_method_title) {
      orderData.shipping_method_title = shipping_method_title;
    }
    if (order_comments) {
      orderData.customer_note = order_comments;
    }
    
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
    if (error instanceof WooCommerceError) {
      return new Response(
        JSON.stringify({
          error: error.message,
          details: error.details,
        }),
        {
          status: error.status,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: error?.message ?? 'Unknown error' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
};

