import { type APIRoute } from 'astro';
import { WC_API_URL } from '../../../lib/config';

export const GET: APIRoute = async ({ request }) => {
  try {
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized', isAdmin: false }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const token = authHeader.replace('Bearer ', '');
    
    // Récupérer les données utilisateur via JWT avec context=edit pour avoir les rôles
    const userUrl = `${WC_API_URL}/wp-json/wp/v2/users/me?context=edit`;
    
    const userResponse = await fetch(userUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!userResponse.ok) {
      console.error('Failed to fetch user data:', userResponse.status, userResponse.statusText);
      return new Response(JSON.stringify({ error: 'Failed to fetch user data', isAdmin: false }), {
        status: userResponse.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const userData = await userResponse.json();
    
    console.log('User data from WordPress:', {
      id: userData.id,
      username: userData.username,
      roles: userData.roles,
      capabilities: userData.capabilities,
    });
    
    // Vérifier si l'utilisateur est admin ou administrator
    const isAdmin = userData.capabilities?.administrator === true || 
                    (Array.isArray(userData.roles) && (
                      userData.roles.includes('administrator') ||
                      userData.roles.includes('shop_manager')
                    ));
    
    console.log('Admin check result:', { isAdmin });
    
    return new Response(JSON.stringify({ 
      isAdmin,
      user: {
        id: userData.id,
        username: userData.username,
        email: userData.email,
        roles: userData.roles || [],
        capabilities: userData.capabilities || {},
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error checking admin status:', error);
    return new Response(JSON.stringify({ error: error.message || 'An error occurred', isAdmin: false }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

