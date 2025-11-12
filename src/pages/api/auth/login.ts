import { type APIRoute } from 'astro';
import { WC_API_URL } from '../../../lib/config';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { username, password } = await request.json();
    
    if (!username || !password) {
      return new Response(JSON.stringify({ error: 'Username and password are required' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
    
    // Authentification JWT avec WooCommerce
    const jwtUrl = `${WC_API_URL}/wp-json/jwt-auth/v1/token`;
    
    const response = await fetch(jwtUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username,
        password,
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      return new Response(JSON.stringify({ 
        error: error.message || 'Invalid credentials' 
      }), {
        status: response.status,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
    
    const data = await response.json();
    
    // Retourner le token et les informations utilisateur
    return new Response(JSON.stringify({
      token: data.token,
      user: data.user,
      success: true,
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'An error occurred during login' 
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};

