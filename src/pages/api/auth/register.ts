import { type APIRoute } from 'astro';
import { WC_API_URL, WC_CONSUMER_KEY, WC_CONSUMER_SECRET } from '../../../lib/config';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { username, email, password, first_name, last_name, billing } = await request.json();
    
    if (!username || !email || !password || !first_name || !last_name) {
      return new Response(JSON.stringify({ error: 'Username, email, password, first name and last name are required' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
    
    // Validate billing address required fields
    if (!billing || !billing.phone || !billing.address_1 || !billing.city || !billing.postcode || !billing.country) {
      return new Response(JSON.stringify({ error: 'Complete billing address is required' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({ error: 'Invalid email format' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
    
    // Validate password strength
    if (password.length < 6) {
      return new Response(JSON.stringify({ error: 'Password must be at least 6 characters long' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
    
    // Create user via WooCommerce API
    const registerUrl = `${WC_API_URL}/wp-json/wc/v3/customers`;
    const auth = Buffer.from(`${WC_CONSUMER_KEY}:${WC_CONSUMER_SECRET}`).toString('base64');
    
    console.log('🔍 Register URL:', registerUrl);
    console.log('🔍 Auth credentials present:', !!WC_CONSUMER_KEY && !!WC_CONSUMER_SECRET);
    
    const response = await fetch(registerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
      },
      body: JSON.stringify({
        username,
        email,
        password,
        first_name,
        last_name,
        billing: {
          first_name: billing.first_name,
          last_name: billing.last_name,
          company: billing.company || '',
          email: billing.email,
          phone: billing.phone,
          address_1: billing.address_1,
          address_2: billing.address_2 || '',
          city: billing.city,
          postcode: billing.postcode,
          country: billing.country,
          state: billing.state || '',
        },
        shipping: {
          first_name: billing.first_name,
          last_name: billing.last_name,
          company: billing.company || '',
          address_1: billing.address_1,
          address_2: billing.address_2 || '',
          city: billing.city,
          postcode: billing.postcode,
          country: billing.country,
          state: billing.state || '',
        },
        meta_data: [
          {
            key: 'account_status',
            value: 'pending'
          }
        ],
      }),
    });
    
    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    
    console.log('🔍 Response status:', response.status);
    console.log('🔍 Response Content-Type:', contentType);
    console.log('🔍 Response OK:', response.ok);
    
    if (!response.ok) {
      let errorMessage = 'Registration failed';
      let errorDetails: any = null;
      
      try {
        if (isJson) {
          errorDetails = await response.json();
          console.log('🔍 Error response (JSON):', errorDetails);
          
          // Si c'est une erreur 500, vérifier si le compte a quand même été créé
          if (errorDetails.code === 'internal_server_error' && response.status === 500) {
            console.log('🔍 WordPress returned 500 error, checking if account was created anyway...');
            try {
              // Chercher le compte par email
              const searchUrl = `${WC_API_URL}/wp-json/wc/v3/customers?email=${encodeURIComponent(email)}`;
              const auth = Buffer.from(`${WC_CONSUMER_KEY}:${WC_CONSUMER_SECRET}`).toString('base64');
              const searchResponse = await fetch(searchUrl, {
                headers: {
                  'Authorization': `Basic ${auth}`,
                  'Content-Type': 'application/json',
                },
              });
              
              if (searchResponse.ok) {
                const searchData = await searchResponse.json();
                if (searchData && searchData.length > 0) {
                  const customer = searchData[0];
                  console.log('🔍 Account was created despite 500 error, user ID:', customer.id);
                  
                  // Retourner un succès même si WordPress a retourné une erreur 500
                  return new Response(JSON.stringify({
                    success: true,
                    message: 'Account created successfully',
                    userId: customer.id,
                  }), {
                    status: 200,
                    headers: {
                      'Content-Type': 'application/json',
                    },
                  });
                }
              }
            } catch (searchError) {
              console.error('🔍 Error checking if account was created:', searchError);
            }
          }
          
          // Si le compte existe déjà, considérer comme un succès (l'utilisateur peut se connecter)
          if (errorDetails.code === 'registration-error-username-exists' || 
              errorDetails.code === 'registration-error-email-exists') {
            // Vérifier si on peut récupérer l'ID du client existant
            try {
              const searchUrl = errorDetails.code === 'registration-error-email-exists'
                ? `${WC_API_URL}/wp-json/wc/v3/customers?email=${encodeURIComponent(email)}`
                : `${WC_API_URL}/wp-json/wc/v3/customers?search=${encodeURIComponent(username)}`;
              
              const auth = Buffer.from(`${WC_CONSUMER_KEY}:${WC_CONSUMER_SECRET}`).toString('base64');
              const searchResponse = await fetch(searchUrl, {
                headers: {
                  'Authorization': `Basic ${auth}`,
                  'Content-Type': 'application/json',
                },
              });
              
              if (searchResponse.ok) {
                const searchData = await searchResponse.json();
                if (searchData && searchData.length > 0) {
                  const existingCustomer = searchData[0];
                  console.log('🔍 Found existing customer:', existingCustomer.id);
                  
                  // Retourner un succès avec un flag indiquant que le compte existait déjà
                  return new Response(JSON.stringify({
                    success: true,
                    message: 'Account already exists. You can log in.',
                    userId: existingCustomer.id,
                    accountExists: true,
                  }), {
                    status: 200,
                    headers: {
                      'Content-Type': 'application/json',
                    },
                  });
                }
              }
            } catch (searchError) {
              console.error('🔍 Error searching for existing customer:', searchError);
            }
            
            // Si on ne peut pas trouver le compte, retourner une erreur normale
            errorMessage = errorDetails.code === 'registration-error-username-exists'
              ? 'This username is already taken'
              : 'An account with this email already exists';
          } else if (errorDetails.message) {
            // Nettoyer le message HTML si présent
            const cleanMessage = errorDetails.message.replace(/<[^>]*>/g, '').trim();
            
            // Si c'est une erreur 500 générique de WordPress, donner un message plus utile
            if (errorDetails.code === 'internal_server_error' && cleanMessage.includes('critical error')) {
              errorMessage = 'Registration failed due to a server error. Please try again later or contact support.';
            } else {
              errorMessage = cleanMessage || 'Registration failed';
            }
          } else if (errorDetails.error) {
            errorMessage = typeof errorDetails.error === 'string' 
              ? errorDetails.error 
              : errorDetails.error.message || 'Registration failed';
          }
        } else {
          // WordPress retourne parfois du HTML en cas d'erreur
          const errorText = await response.text();
          console.error('🔍 Error response (HTML/Text):', errorText.substring(0, 500));
          
          // Essayer d'extraire un message d'erreur du HTML
          const errorMatch = errorText.match(/<title>([^<]+)<\/title>/i) || 
                            errorText.match(/<h1[^>]*>([^<]+)<\/h1>/i) ||
                            errorText.match(/error[^:]*:\s*([^<\n]+)/i);
          
          if (errorMatch && errorMatch[1]) {
            errorMessage = errorMatch[1].trim();
          } else {
            errorMessage = `Registration failed: ${response.status} ${response.statusText}`;
          }
        }
      } catch (parseError) {
        console.error('🔍 Error parsing response:', parseError);
        errorMessage = `Registration failed: ${response.status} ${response.statusText}`;
      }
      
      return new Response(JSON.stringify({ 
        error: errorMessage,
        details: errorDetails
      }), {
        status: response.status,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
    
    if (!isJson) {
      const responseText = await response.text();
      console.error('🔍 Unexpected non-JSON response:', responseText.substring(0, 500));
      return new Response(JSON.stringify({ 
        error: 'Invalid response format from server' 
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
    
    let data;
    try {
      data = await response.json();
      console.log('🔍 Registration success, user ID:', data.id);
    } catch (parseError) {
      console.error('🔍 Error parsing success response:', parseError);
      // Même si on ne peut pas parser la réponse, vérifier si le compte a été créé
      // en cherchant par email ou username
      try {
        const searchUrl = `${WC_API_URL}/wp-json/wc/v3/customers?email=${encodeURIComponent(email)}`;
        const auth = Buffer.from(`${WC_CONSUMER_KEY}:${WC_CONSUMER_SECRET}`).toString('base64');
        const searchResponse = await fetch(searchUrl, {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          if (searchData && searchData.length > 0) {
            const customer = searchData[0];
            console.log('🔍 Found customer after registration error:', customer.id);
            return new Response(JSON.stringify({
              success: true,
              message: 'Account created successfully',
              userId: customer.id,
            }), {
              status: 200,
              headers: {
                'Content-Type': 'application/json',
              },
            });
          }
        }
      } catch (searchError) {
        console.error('🔍 Error searching for created customer:', searchError);
      }
      
      // Si on ne peut pas vérifier, retourner une erreur
      return new Response(JSON.stringify({ 
        error: 'Account may have been created but we could not verify it. Please try logging in.' 
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
    
    // Return success response
    return new Response(JSON.stringify({
      success: true,
      message: 'Account created successfully',
      userId: data.id,
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error: any) {
    console.error('🔍 Registration error:', error);
    console.error('🔍 Error stack:', error.stack);
    console.error('🔍 Error name:', error.name);
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : typeof error === 'string' 
        ? error 
        : 'An error occurred during registration';
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      type: error instanceof Error ? error.name : 'UnknownError'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};


