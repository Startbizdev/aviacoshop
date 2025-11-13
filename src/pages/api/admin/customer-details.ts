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
    
    // Vérifier que l'utilisateur est admin
    const isAdmin = await checkAdmin(token);
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden - Admin access required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Get customer ID
    const url = new URL(request.url);
    const customerId = url.searchParams.get('id');
    
    if (!customerId) {
      return new Response(JSON.stringify({ error: 'Customer ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const auth = Buffer.from(`${WC_CONSUMER_KEY}:${WC_CONSUMER_SECRET}`).toString('base64');
    
    // Fetch customer details
    const customerUrl = `${WC_API_URL}/wp-json/wc/v3/customers/${customerId}`;
    const customerResponse = await fetch(customerUrl, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!customerResponse.ok) {
      const errorText = await customerResponse.text();
      return new Response(JSON.stringify({ 
        error: 'Failed to fetch customer details',
        details: errorText.substring(0, 200),
      }), {
        status: customerResponse.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const customer = await customerResponse.json();
    
    // Fetch customer orders
    const ordersUrl = `${WC_API_URL}/wp-json/wc/v3/orders?customer=${customerId}&per_page=100&orderby=date&order=desc`;
    const ordersResponse = await fetch(ordersUrl, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    });
    
    let orders: any[] = [];
    let totalRevenue = 0;
    let totalOrders = 0;
    
    if (ordersResponse.ok) {
      orders = await ordersResponse.json();
      totalOrders = orders.length;
      
      // Calculate total revenue (only from completed/processing orders)
      orders.forEach((order: any) => {
        if (order.status === 'completed' || order.status === 'processing') {
          totalRevenue += parseFloat(order.total || '0');
        }
      });
    }
    
    return new Response(JSON.stringify({
      customer,
      orders,
      stats: {
        totalOrders,
        totalRevenue: totalRevenue.toFixed(2),
        averageOrderValue: totalOrders > 0 ? (totalRevenue / totalOrders).toFixed(2) : '0.00',
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error fetching customer details:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'An error occurred while fetching customer details' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

