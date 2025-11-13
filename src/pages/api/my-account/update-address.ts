import { type APIRoute } from 'astro';
import { WC_API_URL, WC_CONSUMER_KEY, WC_CONSUMER_SECRET } from '../../../lib/config';

export const PUT: APIRoute = async ({ request }) => {
  try {
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const body = await request.json();
    
    // Get user ID from JWT
    const userUrl = `${WC_API_URL}/wp-json/wp/v2/users/me`;
    const userResponse = await fetch(userUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!userResponse.ok) {
      return new Response(JSON.stringify({ error: 'Failed to authenticate' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const userData = await userResponse.json();
    const userId = userData.id;
    
    // Update customer data via WooCommerce API
    const customerUrl = `${WC_API_URL}/wp-json/wc/v3/customers/${userId}`;
    const auth = Buffer.from(`${WC_CONSUMER_KEY}:${WC_CONSUMER_SECRET}`).toString('base64');
    
    const updateResponse = await fetch(customerUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
      },
      body: JSON.stringify(body),
    });
    
    if (!updateResponse.ok) {
      const error = await updateResponse.json();
      return new Response(JSON.stringify({ error: error.message || 'Failed to update address' }), {
        status: updateResponse.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const user = await updateResponse.json();
    
    return new Response(JSON.stringify({ user, success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error updating address:', error);
    return new Response(JSON.stringify({ error: error.message || 'An error occurred' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};


