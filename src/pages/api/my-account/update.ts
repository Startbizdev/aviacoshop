import { type APIRoute } from 'astro';
import { WC_API_URL } from '../../../lib/config';

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
    
    // Mettre à jour les informations utilisateur
    const userUrl = `${WC_API_URL}/wp-json/wp/v2/users/me`;
    
    const response = await fetch(userUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      const error = await response.json();
      return new Response(JSON.stringify({ error: error.message || 'Failed to update user' }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const user = await response.json();
    
    return new Response(JSON.stringify({ user, success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error updating user:', error);
    return new Response(JSON.stringify({ error: error.message || 'An error occurred' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

