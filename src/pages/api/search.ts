import { type APIRoute } from 'astro';
import { searchProducts } from '../../lib/wc-api';

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get('q') || '';
    
    if (!query || query.length < 2) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
    
    const products = await searchProducts(query);
    
    // Limiter à 10 résultats pour les suggestions
    const limitedProducts = Array.isArray(products) ? products.slice(0, 10) : [];
    
    return new Response(JSON.stringify(limitedProducts), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};

