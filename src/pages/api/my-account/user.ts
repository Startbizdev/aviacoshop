import { type APIRoute } from 'astro';
import { WC_API_URL } from '../../../lib/config';

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
    
    // Récupérer les informations utilisateur via JWT
    const userUrl = `${WC_API_URL}/wp-json/wp/v2/users/me`;
    
    const response = await fetch(userUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      return new Response(JSON.stringify({ error: 'Failed to fetch user data' }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const user = await response.json();
    
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

