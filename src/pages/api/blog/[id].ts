import type { APIRoute } from 'astro';
import { WC_API_URL } from '../../../lib/config';

export const GET: APIRoute = async ({ params }) => {
  try {
    const { id } = params;
    
    if (!id) {
      return new Response(
        JSON.stringify({ error: 'Post ID is required' }),
        { status: 400 }
      );
    }
    
    // Récupérer un article spécifique avec les données embarquées (featured_media, author, etc.)
    const apiUrl = `${WC_API_URL}/wp-json/wp/v2/posts/${id}?_embed=true`;
    
    console.log('[Blog API] Fetching post from:', apiUrl);
    
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'AviacoShopHeadless/1.0 (+https://shop.aviaco.fr)',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Blog API] Error fetching post:', response.status, errorText);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to fetch post',
          details: errorText,
          status: response.status 
        }),
        { status: response.status }
      );
    }
    
    const post = await response.json();
    
    console.log(`[Blog API] Successfully fetched post: ${post.title?.rendered || id}`);
    
    return new Response(
      JSON.stringify(post),
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

