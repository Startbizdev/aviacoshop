import type { APIRoute } from 'astro';
import { WC_API_URL } from '../../../lib/config';

export const GET: APIRoute = async ({ url }) => {
  try {
    const category = url.searchParams.get('category');
    const page = url.searchParams.get('page') || '1';
    const perPage = url.searchParams.get('per_page') || '12';
    const search = url.searchParams.get('search');
    
    // Construire l'URL de l'API WordPress
    const params = new URLSearchParams({
      page,
      per_page: perPage,
      _embed: 'true', // Pour inclure les médias et auteurs
    });
    
    if (category && category !== 'all') {
      params.append('categories', category);
    }
    
    if (search) {
      params.append('search', search);
    }
    
    const apiUrl = `${WC_API_URL}/wp-json/wp/v2/posts?${params.toString()}`;
    
    console.log('[Blog API] Fetching posts from:', apiUrl);
    
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'AviacoShopHeadless/1.0 (+https://shop.aviaco.fr)',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Blog API] Error fetching posts:', response.status, errorText);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to fetch posts',
          details: errorText,
          status: response.status 
        }),
        { status: response.status }
      );
    }
    
    const posts = await response.json();
    
    // Récupérer les headers de pagination
    const totalPosts = response.headers.get('X-WP-Total');
    const totalPages = response.headers.get('X-WP-TotalPages');
    
    console.log(`[Blog API] Successfully fetched ${posts.length} posts (Total: ${totalPosts}, Pages: ${totalPages})`);
    
    // Retourner les posts avec les métadonnées de pagination
    return new Response(
      JSON.stringify({
        posts,
        pagination: {
          total: parseInt(totalPosts || '0'),
          totalPages: parseInt(totalPages || '1'),
          currentPage: parseInt(page),
          perPage: parseInt(perPage),
        },
      }),
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

