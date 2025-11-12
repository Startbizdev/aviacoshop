import { type APIRoute } from 'astro';
import { updateCartItem, WooCommerceError } from '../../../lib/wc-api';

export const POST: APIRoute = async ({ request }) => {
  try {
    const cookie = request.headers.get('cookie') || '';
    const body = await request.json();
    
    const { key, quantity } = body;
    
    if (!key || !quantity) {
      return new Response(JSON.stringify({ error: 'Item key and quantity are required' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
    
    const result = await updateCartItem(key, quantity, cookie);
    
    const setCookieHeader = (result as any)?.cookie;
    
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
    const { cookie: _, ...cleanResult } = result as any;
    
    return new Response(JSON.stringify(cleanResult), {
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

