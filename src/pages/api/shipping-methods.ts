import { type APIRoute } from 'astro';
import { getShippingMethods, WooCommerceError } from '../../lib/wc-api';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const cookie = request.headers.get('cookie') || '';
    console.log('POST /api/shipping-methods - Cookie present:', cookie ? 'yes' : 'no');
    
    const body = await request.json();
    console.log('POST /api/shipping-methods - Request body:', body);
    
    const { country, postcode, city, state } = body;
    
    if (!country || !postcode || !city) {
      console.error('POST /api/shipping-methods - Missing required fields');
      return new Response(JSON.stringify({ 
        error: 'Country, postcode, and city are required',
        received: { country, postcode, city, state }
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
    
    const shippingAddress: Record<string, any> = {
      country,
      postcode,
      city,
    };
    
    if (state) {
      shippingAddress.state = state;
    }
    
    console.log('POST /api/shipping-methods - Calling getShippingMethods with:', shippingAddress);
    const methods = await getShippingMethods(shippingAddress, cookie);
    console.log('POST /api/shipping-methods - Received methods:', JSON.stringify(methods, null, 2));
    
    // Log détaillé pour déboguer DHL
    if (Array.isArray(methods)) {
      methods.forEach((method: any, index: number) => {
        console.log(`Method ${index}:`, {
          id: method.rate_id || method.id,
          name: method.name || method.label,
          cost: method.cost,
          price: method.price,
          total: method.total,
          rate_cost: method.rate_cost,
        });
      });
    }
    
    // Helper function to format price correctly
    const formatPrice = (price: any): string => {
      if (!price && price !== 0) return '0';
      const priceStr = String(price);
      // Remove currency symbols and spaces, keep numbers and decimal point
      const cleaned = priceStr.replace(/[€\s,]/g, '').trim();
      // Convert to number and back to string to handle decimals properly
      const num = parseFloat(cleaned);
      if (isNaN(num)) return '0';
      // Format with 2 decimals for shipping prices
      return num.toFixed(2);
    };

    // Format methods for frontend
    const formattedMethods = Array.isArray(methods) ? methods.flatMap((packageMethods: any) => {
      // Handle WooCommerce shipping packages structure
      if (packageMethods.shipping_rates && Array.isArray(packageMethods.shipping_rates)) {
        return packageMethods.shipping_rates.map((method: any) => {
          // Extraire le prix depuis différentes propriétés possibles
          const rawPrice = method.price || method.cost || method.total || method.rate_cost || '0';
          return {
            id: method.rate_id || method.id,
            name: method.name || method.label,
            description: method.description || '',
            price: formatPrice(rawPrice),
            selected: method.selected || false,
          };
        });
      }
      // Handle direct shipping rates
      const rawPrice = packageMethods.price || packageMethods.cost || packageMethods.total || packageMethods.rate_cost || '0';
      return {
        id: packageMethods.rate_id || packageMethods.id,
        name: packageMethods.name || packageMethods.label,
        description: packageMethods.description || '',
        price: formatPrice(rawPrice),
        selected: packageMethods.selected || false,
      };
    }) : [];
    
    console.log('POST /api/shipping-methods - Formatted methods:', formattedMethods);
    
    const responseHeaders = new Headers({
      'Content-Type': 'application/json',
    });
    
    // Handle cookies from response
    const setCookieHeader = (methods as any)?.cookie;
    if (Array.isArray(setCookieHeader) && setCookieHeader.length > 0) {
      setCookieHeader.forEach((cookieValue: string) => {
        responseHeaders.append('Set-Cookie', cookieValue);
      });
    } else if (typeof setCookieHeader === 'string' && setCookieHeader) {
      responseHeaders.append('Set-Cookie', setCookieHeader);
    }
    
    return new Response(JSON.stringify({ methods: formattedMethods }), {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error: any) {
    console.error('Error in /api/shipping-methods:', error);
    
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

