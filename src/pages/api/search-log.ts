import { type APIRoute } from 'astro';
import { WC_API_URL } from '../../lib/config';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

interface SearchLog {
  id: string;
  query: string;
  ip: string;
  timestamp: string;
  results_count: number;
  customer_id?: number;
  customer_email?: string;
  customer_name?: string;
}

// Helper pour obtenir l'IP réelle du client
function getClientIP(request: Request): string {
  // Vérifier les headers proxy courants
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  
  if (forwarded) {
    // Prendre la première IP si plusieurs sont présentes
    return forwarded.split(',')[0].trim();
  }
  
  if (realIP) {
    return realIP.trim();
  }
  
  if (cfConnectingIP) {
    return cfConnectingIP.trim();
  }
  
  // Fallback (ne sera probablement jamais utilisé en production)
  return 'unknown';
}

// Helper pour récupérer les infos client depuis le token
async function getCustomerInfo(token: string | null): Promise<{ id?: number; email?: string; name?: string }> {
  if (!token) return {};
  
  try {
    const userUrl = `${WC_API_URL}/wp-json/wp/v2/users/me`;
    const userResponse = await fetch(userUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!userResponse.ok) {
      return {};
    }
    
    const userData = await userResponse.json();
    
    // Récupérer les infos customer depuis WooCommerce
    try {
      const { WC_CONSUMER_KEY, WC_CONSUMER_SECRET } = await import('../../lib/config');
      const customerUrl = `${WC_API_URL}/wp-json/wc/v3/customers/${userData.id}`;
      const auth = Buffer.from(`${WC_CONSUMER_KEY}:${WC_CONSUMER_SECRET}`).toString('base64');
      
      const customerResponse = await fetch(customerUrl, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (customerResponse.ok) {
        const customerData = await customerResponse.json();
        return {
          id: customerData.id,
          email: customerData.email,
          name: `${customerData.first_name || ''} ${customerData.last_name || ''}`.trim() || customerData.username,
        };
      }
    } catch (e) {
      // Si échec, utiliser les données utilisateur WordPress
      return {
        id: userData.id,
        email: userData.email,
        name: userData.name || userData.username,
      };
    }
    
    return {
      id: userData.id,
      email: userData.email,
      name: userData.name || userData.username,
    };
  } catch (error) {
    console.error('Error fetching customer info:', error);
    return {};
  }
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { query, results_count } = body;
    
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Query is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Ne logger que les recherches sans résultats
    if (results_count !== undefined && results_count > 0) {
      return new Response(JSON.stringify({ success: true, logged: false, reason: 'Has results' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Récupérer le token si présent
    const authHeader = request.headers.get('Authorization');
    const token = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.replace('Bearer ', '') 
      : null;
    
    // Récupérer les infos client si connecté
    const customerInfo = await getCustomerInfo(token);
    
    // Récupérer l'IP
    const ip = getClientIP(request);
    
    // Créer l'entrée de log
    const logEntry: SearchLog = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      query: query.trim(),
      ip,
      timestamp: new Date().toISOString(),
      results_count: results_count || 0,
      ...(customerInfo.id && { customer_id: customerInfo.id }),
      ...(customerInfo.email && { customer_email: customerInfo.email }),
      ...(customerInfo.name && { customer_name: customerInfo.name }),
    };
    
    // Lire le fichier actuel
    const filePath = join(process.cwd(), 'src', 'data', 'search-logs.json');
    let logs: SearchLog[] = [];
    
    try {
      const fileContent = await readFile(filePath, 'utf-8');
      logs = JSON.parse(fileContent);
    } catch (error: any) {
      // Si le fichier n'existe pas ou est invalide, créer un nouveau tableau
      if (error.code !== 'ENOENT') {
        console.error('Error reading search logs file:', error);
      }
      logs = [];
    }
    
    // Ajouter la nouvelle entrée au début
    logs.unshift(logEntry);
    
    // Limiter à 10000 entrées pour éviter que le fichier devienne trop gros
    if (logs.length > 10000) {
      logs = logs.slice(0, 10000);
    }
    
    // Écrire le fichier
    await writeFile(filePath, JSON.stringify(logs, null, 2), 'utf-8');
    
    return new Response(JSON.stringify({ success: true, logged: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error logging search:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to log search' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

