import { type APIRoute } from 'astro';
import { getProducts } from '../../../lib/wc-api';
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
    
    // Build params for getProducts
    const params: Record<string, string> = {
      page: page.toString(),
      per_page: perPage.toString(),
    };
    
    if (search) {
      params.search = search;
    }
    
    // Get products using the existing getProducts function
    const products = await getProducts(params);
    const productsArray = Array.isArray(products) ? products : [];
    
    // Get total count by fetching first page with per_page=1 to get headers
    let totalItems = productsArray.length;
    let totalPages = 1;
    
    try {
      // Fetch with per_page=1 to get total count from headers
      const auth = Buffer.from(`${WC_CONSUMER_KEY}:${WC_CONSUMER_SECRET}`).toString('base64');
      const countUrl = `${WC_API_URL}/wp-json/wc/v3/products?per_page=1&page=1${search ? `&search=${encodeURIComponent(search)}` : ''}`;
      const countResponse = await fetch(countUrl, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (countResponse.ok) {
        totalItems = parseInt(countResponse.headers.get('x-wp-total') || '0', 10);
        totalPages = parseInt(countResponse.headers.get('x-wp-totalpages') || '1', 10);
      }
    } catch (error) {
      console.error('Error getting product count:', error);
      // Use fallback calculation
      totalItems = productsArray.length;
      totalPages = Math.ceil(totalItems / perPage);
    }
    
    // Calculate stats
    let totalProducts = 0;
    let publishedProducts = 0;
    let draftProducts = 0;
    
    try {
      const auth = Buffer.from(`${WC_CONSUMER_KEY}:${WC_CONSUMER_SECRET}`).toString('base64');
      const statsUrl = `${WC_API_URL}/wp-json/wc/v3/products?per_page=1&page=1`;
      const statsResponse = await fetch(statsUrl, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (statsResponse.ok) {
        totalProducts = parseInt(statsResponse.headers.get('x-wp-total') || '0', 10);
      }
      
      // Count published and draft products
      const allProducts = await getProducts({ per_page: '100', page: '1' });
      if (Array.isArray(allProducts)) {
        publishedProducts = allProducts.filter((p: any) => p.status === 'publish').length;
        draftProducts = allProducts.filter((p: any) => p.status === 'draft').length;
      }
    } catch (error) {
      console.error('Error calculating stats:', error);
    }
    
    return new Response(JSON.stringify({
      products: productsArray,
      pagination: {
        page,
        perPage,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      stats: {
        total: totalProducts,
        published: publishedProducts,
        draft: draftProducts,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error fetching products:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'An error occurred while fetching products' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

