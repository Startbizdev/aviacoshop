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

export const POST: APIRoute = async ({ request }) => {
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
    
    const { customerId, status } = await request.json();
    
    if (!customerId || !status) {
      return new Response(JSON.stringify({ error: 'Customer ID and status are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return new Response(JSON.stringify({ error: 'Invalid status. Must be approved, rejected, or pending' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Récupérer le customer actuel pour préserver les autres meta_data
    const auth = Buffer.from(`${WC_CONSUMER_KEY}:${WC_CONSUMER_SECRET}`).toString('base64');
    const getCustomerUrl = `${WC_API_URL}/wp-json/wc/v3/customers/${customerId}`;
    
    const getResponse = await fetch(getCustomerUrl, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!getResponse.ok) {
      return new Response(JSON.stringify({ error: 'Customer not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const customer = await getResponse.json();
    
    // Update meta_data
    const existingMetaData = customer.meta_data || [];
    const accountStatusIndex = existingMetaData.findIndex((meta: any) => meta.key === 'account_status');
    const accountStatusDateIndex = existingMetaData.findIndex((meta: any) => meta.key === 'account_status_date');
    
    let updatedMetaData = [...existingMetaData];
    
    // Update or add account_status
    if (accountStatusIndex >= 0) {
      updatedMetaData[accountStatusIndex] = {
        ...updatedMetaData[accountStatusIndex],
        value: status,
      };
    } else {
      updatedMetaData.push({
        key: 'account_status',
        value: status,
      });
    }
    
    // Update or add account_status_date (current timestamp)
    const now = new Date().toISOString();
    if (accountStatusDateIndex >= 0) {
      updatedMetaData[accountStatusDateIndex] = {
        ...updatedMetaData[accountStatusDateIndex],
        value: now,
      };
    } else {
      updatedMetaData.push({
        key: 'account_status_date',
        value: now,
      });
    }
    
    // Mettre à jour le customer
    const updateUrl = `${WC_API_URL}/wp-json/wc/v3/customers/${customerId}`;
    const updateResponse = await fetch(updateUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        meta_data: updatedMetaData,
      }),
    });
    
    if (!updateResponse.ok) {
      const error = await updateResponse.json();
      return new Response(JSON.stringify({ error: error.message || 'Failed to update customer status' }), {
        status: updateResponse.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const updatedCustomer = await updateResponse.json();
    
    return new Response(JSON.stringify({ 
      success: true,
      message: `Account status updated to ${status}`,
      customer: {
        id: updatedCustomer.id,
        status: status,
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error updating account status:', error);
    return new Response(JSON.stringify({ error: error.message || 'An error occurred' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

