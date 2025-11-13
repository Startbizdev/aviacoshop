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
      console.error('Failed to fetch user data in checkAdmin:', userResponse.status);
      return false;
    }
    
    const userData = await userResponse.json();
    console.log('CheckAdmin - User data:', {
      id: userData.id,
      username: userData.username,
      roles: userData.roles,
      capabilities: userData.capabilities,
    });
    
    const isAdmin = userData.capabilities?.administrator === true || 
                    (Array.isArray(userData.roles) && (
                      userData.roles.includes('administrator') ||
                      userData.roles.includes('shop_manager')
                    ));
    
    console.log('CheckAdmin - Result:', isAdmin);
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
    
    // Get pagination and filter parameters
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const perPage = parseInt(url.searchParams.get('per_page') || '20', 10);
    const statusFilter = url.searchParams.get('status') || 'pending'; // pending, approved, rejected, all
    
    // Get all customers (we need to fetch all to filter by status)
    // WooCommerce doesn't support filtering by meta_data in standard API
    const auth = Buffer.from(`${WC_CONSUMER_KEY}:${WC_CONSUMER_SECRET}`).toString('base64');
    
    // Fetch all customers by pages
    let allCustomers: any[] = [];
    let currentPage = 1;
    let hasMore = true;
    const maxPages = 10; // Safety limit to avoid infinite loops
    
    console.log(`Fetching customers from WooCommerce with status filter: ${statusFilter}...`);
    
    while (hasMore && currentPage <= maxPages) {
      const customersUrl = `${WC_API_URL}/wp-json/wc/v3/customers?per_page=100&orderby=registered_date&order=desc&page=${currentPage}`;
      
      console.log(`Fetching page ${currentPage}: ${customersUrl}`);
      
      const response = await fetch(customersUrl, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      });
      
      console.log(`Response status: ${response.status}`);
      
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
      console.log(`Received ${customers.length} customers on page ${currentPage}`);
      allCustomers = [...allCustomers, ...customers];
      
      // Check if there are more pages
      const totalPages = parseInt(response.headers.get('x-wp-totalpages') || '1', 10);
      hasMore = currentPage < totalPages && customers.length === 100;
      currentPage++;
      
      // If we have enough customers for the requested page + a few more, we can stop early
      // BUT: Always fetch at least 3 pages to ensure we get today's status changes for stats
      if (statusFilter === 'pending' && currentPage >= 3) {
        const filteredCount = allCustomers.filter((customer: any) => {
          const accountStatus = customer.meta_data?.find((meta: any) => meta.key === 'account_status');
          return accountStatus?.value === 'pending' || !accountStatus;
        }).length;
        
        if (filteredCount >= (page + 2) * perPage) {
          console.log('Enough filtered customers found, stopping fetch');
          break;
        }
      }
    }
    
    console.log(`Total customers fetched: ${allCustomers.length}`);
    
    // Filter customers by status
    let filteredCustomers: any[] = [];
    
    if (statusFilter === 'all') {
      filteredCustomers = allCustomers;
    } else {
      filteredCustomers = allCustomers.filter((customer: any) => {
        const accountStatus = customer.meta_data?.find((meta: any) => meta.key === 'account_status');
        const status = accountStatus?.value || 'pending';
        
        if (statusFilter === 'pending') {
          return status === 'pending' || !accountStatus;
        }
        return status === statusFilter;
      });
    }
    
    // Calculate stats for today (from all customers fetched)
    // Note: We fetch customers ordered by registered_date desc, so recent ones come first
    // For accurate "today" stats, we need to check all customers, but we'll calculate from what we have
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // For "today" stats, we need to check customers that were modified/status changed today
    // Since customers are ordered by registered_date, we should check at least the first few pages
    // But to be safe, let's check all customers we fetched
    let approvedToday = 0;
    let rejectedToday = 0;
    
    // Check all fetched customers for today's status changes
    for (const customer of allCustomers) {
      const accountStatus = customer.meta_data?.find((meta: any) => meta.key === 'account_status');
      const statusDate = customer.meta_data?.find((meta: any) => meta.key === 'account_status_date');
      
      if (!statusDate?.value) continue;
      
      try {
        const statusDateObj = new Date(statusDate.value);
        statusDateObj.setHours(0, 0, 0, 0);
        
        // Only count if status was changed today
        if (statusDateObj.getTime() === today.getTime()) {
          if (accountStatus?.value === 'approved') {
            approvedToday++;
          } else if (accountStatus?.value === 'rejected') {
            rejectedToday++;
          }
        }
      } catch (e) {
        // Skip invalid dates
        continue;
      }
    }
    
    // Server-side pagination for filtered results
    const startIndex = (page - 1) * perPage;
    const endIndex = startIndex + perPage;
    const paginatedCustomers = filteredCustomers.slice(startIndex, endIndex);
    
    // Format data for display
    const formattedCustomers = paginatedCustomers.map((customer: any) => {
      const accountStatus = customer.meta_data?.find((meta: any) => meta.key === 'account_status');
      const statusDate = customer.meta_data?.find((meta: any) => meta.key === 'account_status_date');
      return {
        id: customer.id,
        username: customer.username,
        email: customer.email,
        firstName: customer.first_name,
        lastName: customer.last_name,
        dateCreated: customer.date_created,
        dateModified: customer.date_modified,
        status: accountStatus?.value || 'pending',
        statusDate: statusDate?.value || null,
        billing: customer.billing,
        shipping: customer.shipping,
      };
    });
    
    // Calculate total pages for filtered results
    const totalFiltered = filteredCustomers.length;
    const totalPagesFiltered = Math.ceil(totalFiltered / perPage);
    
    // Calculate counts for each status
    const pendingCount = allCustomers.filter((customer: any) => {
      const accountStatus = customer.meta_data?.find((meta: any) => meta.key === 'account_status');
      return accountStatus?.value === 'pending' || !accountStatus;
    }).length;
    
    const approvedCount = allCustomers.filter((customer: any) => {
      const accountStatus = customer.meta_data?.find((meta: any) => meta.key === 'account_status');
      return accountStatus?.value === 'approved';
    }).length;
    
    const rejectedCount = allCustomers.filter((customer: any) => {
      const accountStatus = customer.meta_data?.find((meta: any) => meta.key === 'account_status');
      return accountStatus?.value === 'rejected';
    }).length;
    
    return new Response(JSON.stringify({ 
      customers: formattedCustomers,
      pagination: {
        page,
        perPage,
        totalItems: totalFiltered,
        totalPages: totalPagesFiltered,
        hasNextPage: endIndex < totalFiltered,
        hasPrevPage: page > 1,
      },
      stats: {
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
        approvedToday,
        rejectedToday,
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error fetching pending accounts:', error);
    return new Response(JSON.stringify({ error: error.message || 'An error occurred' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

