import { type APIRoute } from 'astro';
import { WC_API_URL, WC_CONSUMER_KEY, WC_CONSUMER_SECRET } from '../../../lib/config';

// Helper function to check if user is admin
async function checkAdmin(token: string): Promise<boolean> {
  try {
    const userUrl = `${WC_API_URL}/wp-json/wp/v2/users/me?context=edit`;
    const userResponse = await fetch(userUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!userResponse.ok) {
      return false;
    }
    
    const userData = await userResponse.json();
    const isAdmin = userData.capabilities?.administrator === true || 
                    (Array.isArray(userData.roles) && (
                      userData.roles.includes('administrator') ||
                      userData.roles.includes('shop_manager')
                    ));
    
    return isAdmin;
  } catch (error) {
    console.error('Error in checkAdmin:', error);
    return false;
  }
}

export const DELETE: APIRoute = async ({ request }) => {
  try {
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const token = authHeader.replace('Bearer ', '');
    
    // Vérifier que l'utilisateur est admin
    const isAdmin = await checkAdmin(token);
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden - Admin access required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Get customer ID from request body
    const body = await request.json().catch(() => ({}));
    const customerId = body.customerId;
    
    if (!customerId) {
      return new Response(JSON.stringify({ error: 'Customer ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const auth = Buffer.from(`${WC_CONSUMER_KEY}:${WC_CONSUMER_SECRET}`).toString('base64');
    
    // Delete customer (force=true to permanently delete)
    const deleteUrl = `${WC_API_URL}/wp-json/wc/v3/customers/${customerId}?force=true`;
    const deleteResponse = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!deleteResponse.ok) {
      const errorText = await deleteResponse.text();
      return new Response(JSON.stringify({ 
        error: 'Failed to delete customer',
        details: errorText.substring(0, 200),
      }), {
        status: deleteResponse.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Customer deleted successfully',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error deleting customer:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'An error occurred while deleting customer' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

