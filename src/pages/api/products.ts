import { type APIRoute } from 'astro';
import { getProducts } from '../../lib/wc-api';

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const perPage = parseInt(url.searchParams.get('per_page') || '100');
    const search = url.searchParams.get('search') || '';
    
    const params: Record<string, string> = {
      per_page: perPage.toString(),
      page: page.toString(),
    };
    
    if (search) {
      params.search = search;
    }
    
    const products = await getProducts(params);
    const productsArray = Array.isArray(products) ? products : [];
    
    // Utiliser les URLs originales des images telles quelles (pas de modification)
    
    return new Response(JSON.stringify({
      products: productsArray,
      page,
      perPage,
      hasMore: productsArray.length === perPage, // Si on a le nombre max de produits, il y a probablement plus de pages
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error: any) {
    console.error('Error fetching products:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      products: [],
      page: 1,
      perPage: 20,
      hasMore: false,
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};

