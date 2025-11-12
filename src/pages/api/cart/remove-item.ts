import { type APIRoute } from 'astro';
import { removeCartItem, WooCommerceError } from '../../../lib/wc-api';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    // Extraire uniquement les cookies WooCommerce nécessaires pour éviter l'erreur "Cookie Too Large"
    const allCookies = request.headers.get('cookie') || '';
    
    // Si les cookies sont trop volumineux, ne garder que les essentiels
    // Limiter la taille totale à ~4KB pour éviter l'erreur nginx
    let cookie = allCookies;
    
    if (allCookies.length > 4000) {
      console.warn('Cookies too large, filtering...');
      const cookieArray = allCookies.split(';').map(c => c.trim());
      
      // Prioriser les cookies WooCommerce essentiels
      const essentialCookies = cookieArray.filter(c => {
        const name = c.split('=')[0];
        return (
          name.startsWith('woocommerce') || 
          name.startsWith('wp_woocommerce') ||
          name.startsWith('cart_hash') ||
          name.startsWith('cart_created') ||
          name.startsWith('wordpress_logged_in')
        );
      });
      
      cookie = essentialCookies.join('; ');
      
      // Si c'est encore trop grand, ne garder que le cookie de session le plus récent
      if (cookie.length > 4000) {
        const sessionCookies = cookieArray.filter(c => 
          c.includes('woocommerce') || c.includes('cart')
        );
        cookie = sessionCookies.slice(-3).join('; '); // Garder les 3 derniers
      }
    }
    
    // Vérifier que le Content-Type est correct
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return new Response(JSON.stringify({ error: 'Content-Type must be application/json' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
    
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
    
    console.log('Remove item request body:', body);
    const { key } = body;
    
    if (!key) {
      console.error('No key provided in remove-item request');
      return new Response(JSON.stringify({ error: 'Item key is required' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
    
    console.log('Calling removeCartItem with key:', key);
    const result = await removeCartItem(key, cookie);
    console.log('removeCartItem result:', result);
    
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
    console.error('Error in /api/cart/remove-item:', error);
    
    const responseHeaders = new Headers({
      'Content-Type': 'application/json',
    });
    
    if (error instanceof WooCommerceError) {
      // Préserver les cookies même en cas d'erreur
      const errorDetails = error.details as any;
      const setCookieHeader = errorDetails?.cookie;
      
      if (Array.isArray(setCookieHeader) && setCookieHeader.length > 0) {
        setCookieHeader.forEach((cookieValue: string) => {
          responseHeaders.append('Set-Cookie', cookieValue);
        });
      } else if (typeof setCookieHeader === 'string' && setCookieHeader) {
        responseHeaders.append('Set-Cookie', setCookieHeader);
      }
      
      // Nettoyer les détails avant de les retourner (enlever les cookies)
      const { cookie: _, ...cleanDetails } = errorDetails || {};
      
      return new Response(
        JSON.stringify({
          error: error.message,
          details: cleanDetails,
        }),
        {
          status: error.status,
          headers: responseHeaders,
        }
      );
    }

    return new Response(
      JSON.stringify({ error: error?.message ?? 'Unknown error' }),
      {
        status: 500,
        headers: responseHeaders,
      }
    );
  }
};

