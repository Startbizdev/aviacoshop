import { type APIRoute } from 'astro';
import { WC_API_URL, WC_CONSUMER_KEY, WC_CONSUMER_SECRET } from '../../../lib/config';

export const prerender = false;

export const GET: APIRoute = async ({ params, request }) => {
  try {
    const { id } = params;

    if (!id) {
      return new Response(
        JSON.stringify({ error: 'Order ID is required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Vérifier si l'utilisateur est authentifié
    const authHeader = request.headers.get('Authorization');
    let customerId: number | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      try {
        const userUrl = `${WC_API_URL}/wp-json/wp/v2/users/me`;
        const userResponse = await fetch(userUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (userResponse.ok) {
          const user = await userResponse.json();
          customerId = user.id;
        }
      } catch (error) {
        // Ignorer les erreurs d'authentification pour permettre l'accès public aux commandes
      }
    }

    // Récupérer la commande depuis WooCommerce
    const auth = Buffer.from(`${WC_CONSUMER_KEY}:${WC_CONSUMER_SECRET}`).toString('base64');
    const orderUrl = `${WC_API_URL}/wp-json/wc/v3/orders/${id}`;

    const orderResponse = await fetch(orderUrl, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    });

    if (!orderResponse.ok) {
      return new Response(
        JSON.stringify({ 
          error: 'Order not found',
          details: await orderResponse.text().catch(() => 'Unknown error')
        }),
        {
          status: orderResponse.status,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const order = await orderResponse.json();

    // Vérifier que l'utilisateur a le droit de voir cette commande
    // Si l'utilisateur est authentifié, vérifier que c'est sa commande
    if (customerId && order.customer_id !== customerId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(JSON.stringify(order), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error fetching order:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to fetch order',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

