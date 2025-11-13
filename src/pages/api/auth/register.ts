import { type APIRoute } from 'astro';
import { WC_API_URL, WC_CONSUMER_KEY, WC_CONSUMER_SECRET } from '../../../lib/config';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { username, email, password } = await request.json();
    
    if (!username || !email || !password) {
      return new Response(JSON.stringify({ error: 'Username, email and password are required' }), {
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
        billing: {
          email,
        },
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      
      // Handle specific error messages from WooCommerce
      let errorMessage = 'Registration failed';
      
      if (error.code === 'registration-error-username-exists') {
        errorMessage = 'This username is already taken';
      } else if (error.code === 'registration-error-email-exists') {
        errorMessage = 'An account with this email already exists';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      return new Response(JSON.stringify({ 
        error: errorMessage 
      }), {
        status: response.status,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
    
    const data = await response.json();
    
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
    console.error('Registration error:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'An error occurred during registration' 
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};


