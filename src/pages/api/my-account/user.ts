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
    
    // Récupérer l'ID utilisateur via JWT avec context=edit pour obtenir les rôles
    const userUrl = `${WC_API_URL}/wp-json/wp/v2/users/me?context=edit`;
    
    const userResponse = await fetch(userUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!userResponse.ok) {
      return new Response(JSON.stringify({ error: 'Failed to fetch user data' }), {
        status: userResponse.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const userData = await userResponse.json();
    const userId = userData.id;
    
    // Récupérer les données complètes du client depuis WooCommerce
    const customerUrl = `${WC_API_URL}/wp-json/wc/v3/customers/${userId}`;
    const auth = Buffer.from(`${WC_CONSUMER_KEY}:${WC_CONSUMER_SECRET}`).toString('base64');
    
    const customerResponse = await fetch(customerUrl, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!customerResponse.ok) {
      // Si le client n'existe pas dans WooCommerce, retourner les données de base
      return new Response(JSON.stringify({ user: userData }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const customerData = await customerResponse.json();
    
    // Récupérer le statut du compte depuis meta_data
    const accountStatusMeta = customerData.meta_data?.find((meta: any) => meta.key === 'account_status');
    const accountStatus = accountStatusMeta?.value || 'pending';
    
    // Fusionner les données
    const user = {
      ...userData,
      ...customerData,
      account_status: accountStatus,
    };
    
    return new Response(JSON.stringify({ user }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error fetching user:', error);
    return new Response(JSON.stringify({ error: error.message || 'An error occurred' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

