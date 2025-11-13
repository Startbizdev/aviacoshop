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
    
    // Utiliser Basic Auth comme dans user.ts
    const auth = Buffer.from(`${WC_CONSUMER_KEY}:${WC_CONSUMER_SECRET}`).toString('base64');
    
    const ordersResponse = await fetch(ordersUrl.toString(), {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    });
    
    // Si 404 ou pas de commandes, retourner une liste vide
    if (ordersResponse.status === 404) {
      return new Response(JSON.stringify({ 
        orders: [],
        pagination: {
          page: parseInt(page, 10),
          perPage: parseInt(perPage, 10),
          totalPages: 0,
          totalOrders: 0,
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    if (!ordersResponse.ok) {
      const errorText = await ordersResponse.text();
      console.error('Error fetching orders:', {
        status: ordersResponse.status,
        statusText: ordersResponse.statusText,
        error: errorText
      });
      
      // Si erreur mais pas critique, retourner une liste vide plutôt qu'une erreur
      if (ordersResponse.status >= 400 && ordersResponse.status < 500) {
        return new Response(JSON.stringify({ 
          orders: [],
          pagination: {
            page: parseInt(page, 10),
            perPage: parseInt(perPage, 10),
            totalPages: 0,
            totalOrders: 0,
          }
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      return new Response(JSON.stringify({ 
        error: 'Failed to fetch orders',
        details: errorText.substring(0, 200)
      }), {
        status: ordersResponse.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const orders = await ordersResponse.json();
    
    // S'assurer que orders est un tableau
    const ordersArray = Array.isArray(orders) ? orders : [];
    
    const totalPages = parseInt(ordersResponse.headers.get('x-wp-totalpages') || '1', 10);
    const totalOrders = parseInt(ordersResponse.headers.get('x-wp-total') || '0', 10);
    
    return new Response(JSON.stringify({ 
      orders: ordersArray,
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
    console.error('Error stack:', error.stack);
    
    // En cas d'erreur, retourner une liste vide plutôt qu'une erreur 500
    return new Response(JSON.stringify({ 
      orders: [],
      pagination: {
        page: 1,
        perPage: 10,
        totalPages: 0,
        totalOrders: 0,
      },
      error: error.message || 'An error occurred'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

