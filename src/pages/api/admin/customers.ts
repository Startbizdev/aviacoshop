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
    
    // Get pagination parameters
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const perPage = parseInt(url.searchParams.get('per_page') || '20', 10);
    const search = url.searchParams.get('search') || '';
    
    // Build WooCommerce API URL
    const auth = Buffer.from(`${WC_CONSUMER_KEY}:${WC_CONSUMER_SECRET}`).toString('base64');
    let customersUrl = `${WC_API_URL}/wp-json/wc/v3/customers?per_page=${perPage}&page=${page}&orderby=registered_date&order=desc`;
    
    if (search) {
      customersUrl += `&search=${encodeURIComponent(search)}`;
    }
    
    const response = await fetch(customersUrl, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to fetch customers:', response.status, errorText.substring(0, 500));
      return new Response(JSON.stringify({ 
        error: 'Failed to fetch customers',
        details: errorText.substring(0, 200),
        status: response.status
      }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const customers = await response.json();
    
    // Get pagination info from headers
    const totalItems = parseInt(response.headers.get('x-wp-total') || '0', 10);
    const totalPages = parseInt(response.headers.get('x-wp-totalpages') || '1', 10);
    
    // Calculate customers with orders count
    // Fetch orders to get unique customer IDs
    let customersWithOrders = 0;
    try {
      const ordersUrl = `${WC_API_URL}/wp-json/wc/v3/orders?per_page=100&status=any`;
      const ordersResponse = await fetch(ordersUrl, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (ordersResponse.ok) {
        const orders = await ordersResponse.json();
        // Get unique customer IDs from orders
        const uniqueCustomerIds = new Set<number>();
        orders.forEach((order: any) => {
          if (order.customer_id && order.customer_id > 0) {
            uniqueCustomerIds.add(order.customer_id);
          }
        });
        
        // If there are more pages, fetch them
        const totalOrderPages = parseInt(ordersResponse.headers.get('x-wp-totalpages') || '1', 10);
        if (totalOrderPages > 1) {
          for (let orderPage = 2; orderPage <= totalOrderPages; orderPage++) {
            const nextOrdersUrl = `${WC_API_URL}/wp-json/wc/v3/orders?per_page=100&status=any&page=${orderPage}`;
            const nextOrdersResponse = await fetch(nextOrdersUrl, {
              headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json',
              },
            });
            
            if (nextOrdersResponse.ok) {
              const nextOrders = await nextOrdersResponse.json();
              nextOrders.forEach((order: any) => {
                if (order.customer_id && order.customer_id > 0) {
                  uniqueCustomerIds.add(order.customer_id);
                }
              });
            }
          }
        }
        
        customersWithOrders = uniqueCustomerIds.size;
      }
    } catch (error) {
      console.error('Error calculating customers with orders:', error);
      // Continue without this stat if there's an error
    }
    
    return new Response(JSON.stringify({
      customers: customers || [],
      pagination: {
        page,
        perPage,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      stats: {
        customersWithOrders,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error fetching customers:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'An error occurred while fetching customers' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

