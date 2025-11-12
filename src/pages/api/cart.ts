import { type APIRoute } from 'astro';
import { getCart, WooCommerceError } from '../../lib/wc-api';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  try {
    // Extraire uniquement les cookies WooCommerce nécessaires pour éviter l'erreur "Cookie Too Large"
    const allCookies = request.headers.get('cookie') || '';
    
    // Si les cookies sont trop volumineux, ne garder que les essentiels
    // Limiter la taille totale à ~4KB pour éviter l'erreur nginx
    let cookie = allCookies;
    
    if (allCookies.length > 4000) {
      console.warn('GET /api/cart - Cookies too large, filtering...');
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
    
    console.log('GET /api/cart - Received cookies:', cookie ? 'present' : 'missing');
    console.log('GET /api/cart - Cookie length:', cookie.length);
    console.log('GET /api/cart - All cookies length:', allCookies.length);
    
    // Extraire les cookies WooCommerce spécifiques pour debug
    const woocommerceCookies = cookie.split(';').filter(c => 
      c.includes('woocommerce') || c.includes('wp_woocommerce')
    );
    console.log('GET /api/cart - WooCommerce cookies found:', woocommerceCookies.length);
    if (woocommerceCookies.length > 0) {
      woocommerceCookies.forEach((c, i) => {
        const name = c.split('=')[0].trim();
        console.log(`GET /api/cart - WooCommerce cookie ${i + 1}:`, name);
      });
    } else {
      console.warn('GET /api/cart - No WooCommerce cookies found!');
    }
    
    const cart = await getCart(cookie);
    console.log('GET /api/cart - Cart items count:', (cart as any)?.items_count || 0);
    console.log('GET /api/cart - Cart items:', (cart as any)?.items?.length || 0);
    
    const setCookieHeader = (cart as any)?.cookie;
    
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
    
    const { cookie: _, ...cleanCart } = cart as any;
    
    return new Response(JSON.stringify(cleanCart), {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error: any) {
    console.error('Error in /api/cart:', error);
    
    if (error instanceof WooCommerceError) {
      // Si le panier n'existe pas encore (erreur 400 ou 404), retourner un panier vide
      if (error.status === 400 || error.status === 404) {
        return new Response(JSON.stringify({
          items: [],
          items_count: 0,
          items_weight: 0,
          cross_sells: [],
          needs_payment: false,
          needs_shipping: false,
          has_calculated_shipping: false,
          fees: [],
          totals: {
            currency_code: 'EUR',
            currency_symbol: '€',
            currency_minor_unit: 2,
            currency_decimal_separator: ',',
            currency_thousand_separator: ' ',
            currency_prefix: '',
            currency_suffix: ' €',
            total_items: '0',
            total_items_tax: '0',
            total_fees: '0',
            total_fees_tax: '0',
            total_discount: '0',
            total_discount_tax: '0',
            total_shipping: '0',
            total_shipping_tax: '0',
            total_price: '0',
            total_tax: '0',
            tax_lines: []
          },
          shipping_address: {},
          billing_address: {},
          extensions: {}
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }
      
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

