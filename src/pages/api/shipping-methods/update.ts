import { type APIRoute } from 'astro';
import { updateShippingMethod, getCart, WooCommerceError } from '../../../lib/wc-api';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const cookie = request.headers.get('cookie') || '';
    const body = await request.json();
    
    const { rate_id } = body;
    
    if (!rate_id) {
      return new Response(JSON.stringify({ error: 'rate_id is required' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
    
    const updatedCart = await updateShippingMethod(rate_id, cookie);
    
    // Get updated cart totals
    const cart = await getCart(cookie);
    
    const responseHeaders = new Headers({
      'Content-Type': 'application/json',
    });
    
    // Handle cookies from response
    const setCookieHeader = (cart as any)?.cookie;
    if (Array.isArray(setCookieHeader) && setCookieHeader.length > 0) {
      setCookieHeader.forEach((cookieValue: string) => {
        responseHeaders.append('Set-Cookie', cookieValue);
      });
    } else if (typeof setCookieHeader === 'string' && setCookieHeader) {
      responseHeaders.append('Set-Cookie', setCookieHeader);
    }
    
    const { cookie: _, ...cleanCart } = cart as any;
    
    return new Response(JSON.stringify(cleanCart), {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error: any) {
    console.error('Error in /api/shipping-methods/update:', error);
    
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

