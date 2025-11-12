import { type APIRoute } from 'astro';
import { WC_API_URL, WC_CONSUMER_KEY, WC_CONSUMER_SECRET } from '../../../lib/config';

export const GET: APIRoute = async ({ request }) => {
  try {
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const url = new URL(request.url);
    const page = url.searchParams.get('page') || '1';
    const perPage = url.searchParams.get('per_page') || '10';
    
    // Récupérer l'ID utilisateur via JWT
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
    
    const user = await userResponse.json();
    const customerId = user.id;
    
    // Récupérer les commandes via WooCommerce REST API
    const ordersUrl = new URL(`${WC_API_URL}/wp-json/wc/v3/orders`);
    ordersUrl.searchParams.append('customer', customerId.toString());
    ordersUrl.searchParams.append('page', page);
    ordersUrl.searchParams.append('per_page', perPage);
    ordersUrl.searchParams.append('orderby', 'date');
    ordersUrl.searchParams.append('order', 'desc');
    
    const authUrl = getAuthUrl(ordersUrl.toString());
    
    const ordersResponse = await fetch(authUrl, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!ordersResponse.ok) {
      return new Response(JSON.stringify({ error: 'Failed to fetch orders' }), {
        status: ordersResponse.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const orders = await ordersResponse.json();
    const totalPages = parseInt(ordersResponse.headers.get('x-wp-totalpages') || '1', 10);
    const totalOrders = parseInt(ordersResponse.headers.get('x-wp-total') || '0', 10);
    
    return new Response(JSON.stringify({ 
      orders,
      pagination: {
        page: parseInt(page, 10),
        perPage: parseInt(perPage, 10),
        totalPages,
        totalOrders,
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error fetching orders:', error);
    return new Response(JSON.stringify({ error: error.message || 'An error occurred' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

function getAuthUrl(url: string): string {
  const urlObj = new URL(url);
  urlObj.username = WC_CONSUMER_KEY;
  urlObj.password = WC_CONSUMER_SECRET;
  return urlObj.toString();
}

