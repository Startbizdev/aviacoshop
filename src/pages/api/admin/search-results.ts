import { type APIRoute } from 'astro';
import { WC_API_URL } from '../../../lib/config';
import { readFile } from 'fs/promises';
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

// Calculer les statistiques
function calculateStats(logs: SearchLog[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  const todayLogs = logs.filter(log => new Date(log.timestamp) >= today);
  const weekLogs = logs.filter(log => new Date(log.timestamp) >= weekAgo);
  
  // Top recherches (les plus fréquentes)
  const queryCounts: Record<string, number> = {};
  logs.forEach(log => {
    queryCounts[log.query] = (queryCounts[log.query] || 0) + 1;
  });
  
  const topSearches = Object.entries(queryCounts)
    .map(([query, count]) => ({ query, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  
  // Recherches par client connecté
  const customerSearches = logs.filter(log => log.customer_id);
  const customerCounts: Record<number, { count: number; email?: string; name?: string }> = {};
  customerSearches.forEach(log => {
    if (log.customer_id) {
      if (!customerCounts[log.customer_id]) {
        customerCounts[log.customer_id] = {
          count: 0,
          email: log.customer_email,
          name: log.customer_name,
        };
      }
      customerCounts[log.customer_id].count++;
    }
  });
  
  const topCustomers = Object.entries(customerCounts)
    .map(([id, data]) => ({ customer_id: parseInt(id), ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  
  return {
    total: logs.length,
    today: todayLogs.length,
    thisWeek: weekLogs.length,
    topSearches,
    topCustomers,
    uniqueQueries: Object.keys(queryCounts).length,
    uniqueCustomers: Object.keys(customerCounts).length,
  };
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
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Lire les logs
    const filePath = join(process.cwd(), 'src', 'data', 'search-logs.json');
    let logs: SearchLog[] = [];
    
    try {
      const fileContent = await readFile(filePath, 'utf-8');
      logs = JSON.parse(fileContent);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error('Error reading search logs file:', error);
      }
      logs = [];
    }
    
    // Récupérer les paramètres de pagination et filtres
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const perPage = parseInt(url.searchParams.get('per_page') || '20');
    const filterCustomer = url.searchParams.get('customer_id');
    const filterQuery = url.searchParams.get('query');
    const filterDateFrom = url.searchParams.get('date_from');
    const filterDateTo = url.searchParams.get('date_to');
    const filterDate = url.searchParams.get('date'); // Format: YYYY-MM-DD (legacy)
    
    // Appliquer les filtres
    let filteredLogs = [...logs];
    
    if (filterCustomer) {
      const customerId = parseInt(filterCustomer);
      filteredLogs = filteredLogs.filter(log => log.customer_id === customerId);
    }
    
    if (filterQuery) {
      const queryLower = filterQuery.toLowerCase();
      filteredLogs = filteredLogs.filter(log => 
        log.query.toLowerCase().includes(queryLower)
      );
    }
    
    // Support date range (date_from et date_to)
    if (filterDateFrom || filterDateTo) {
      if (filterDateFrom) {
        const dateFromObj = new Date(filterDateFrom);
        filteredLogs = filteredLogs.filter(log => {
          const logDate = new Date(log.timestamp);
          return logDate >= dateFromObj;
        });
      }
      
      if (filterDateTo) {
        const dateToObj = new Date(filterDateTo);
        dateToObj.setHours(23, 59, 59, 999); // End of day
        filteredLogs = filteredLogs.filter(log => {
          const logDate = new Date(log.timestamp);
          return logDate <= dateToObj;
        });
      }
    } else if (filterDate) {
      // Legacy support for single date filter
      const filterDateObj = new Date(filterDate);
      const nextDay = new Date(filterDateObj);
      nextDay.setDate(nextDay.getDate() + 1);
      
      filteredLogs = filteredLogs.filter(log => {
        const logDate = new Date(log.timestamp);
        return logDate >= filterDateObj && logDate < nextDay;
      });
    }
    
    // Calculer la pagination
    const totalItems = filteredLogs.length;
    const totalPages = Math.ceil(totalItems / perPage);
    const startIndex = (page - 1) * perPage;
    const endIndex = startIndex + perPage;
    const paginatedLogs = filteredLogs.slice(startIndex, endIndex);
    
    // Calculer les statistiques (sur tous les logs, pas seulement les filtrés)
    const stats = calculateStats(logs);
    
    return new Response(JSON.stringify({
      searches: paginatedLogs,
      allSearches: logs, // All searches for chart rendering
      pagination: {
        page,
        perPage,
        totalItems,
        totalPages,
        hasPrevPage: page > 1,
        hasNextPage: page < totalPages,
      },
      stats,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error fetching search results:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to fetch search results' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

