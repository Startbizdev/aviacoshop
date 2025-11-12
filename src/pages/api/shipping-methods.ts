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
    console.log('POST /api/shipping-methods - Received methods:', methods);
    
    // Format methods for frontend
    const formattedMethods = Array.isArray(methods) ? methods.flatMap((packageMethods: any) => {
      // Handle WooCommerce shipping packages structure
      if (packageMethods.shipping_rates && Array.isArray(packageMethods.shipping_rates)) {
        return packageMethods.shipping_rates.map((method: any) => ({
          id: method.rate_id || method.id,
          name: method.name || method.label,
          description: method.description || '',
          price: method.price || method.cost || '0',
          selected: method.selected || false,
        }));
      }
      // Handle direct shipping rates
      return {
        id: packageMethods.rate_id || packageMethods.id,
        name: packageMethods.name || packageMethods.label,
        description: packageMethods.description || '',
        price: packageMethods.price || packageMethods.cost || '0',
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

