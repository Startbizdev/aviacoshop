import type { APIRoute } from 'astro';
import { WC_API_URL } from '../../../lib/config';

export const GET: APIRoute = async () => {
  try {
    // Récupérer les catégories WordPress (uniquement celles qui ont des posts)
    const apiUrl = `${WC_API_URL}/wp-json/wp/v2/categories?per_page=100&hide_empty=true`;
    
    console.log('[Blog API] Fetching categories from:', apiUrl);
    
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'AviacoShopHeadless/1.0 (+https://shop.aviaco.fr)',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Blog API] Error fetching categories:', response.status, errorText);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to fetch categories',
          details: errorText,
          status: response.status 
        }),
        { status: response.status }
      );
    }
    
    const categories = await response.json();
    
    console.log(`[Blog API] Successfully fetched ${categories.length} categories`);
    
    return new Response(
      JSON.stringify(categories),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error: any) {
    console.error('[Blog API] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        message: error?.message || 'Unknown error' 
      }),
      { status: 500 }
    );
  }
};

