import { WC_API_URL, WC_CONSUMER_KEY, WC_CONSUMER_SECRET } from './config';

const USER_AGENT = 'AviacoShopHeadless/1.0 (+https://shop.aviaco.fr)';

export class WooCommerceError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'WooCommerceError';
    this.status = status;
    this.details = details;
  }
}

function buildHeaders(cookie?: string, extraHeaders: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': USER_AGENT,
    ...extraHeaders,
  };

  if (cookie) {
    headers.Cookie = cookie;
  }

  return headers;
}

async function parseWooCommerceResponse(response: Response) {
  const rawText = await response.text();
  let parsedBody: unknown = rawText;

  if (rawText) {
    try {
      parsedBody = JSON.parse(rawText);
    } catch {
      // ignore JSON parse error and keep raw text
    }
  } else {
    parsedBody = null;
  }

  // Extraire les cookies AVANT de vérifier si la réponse est OK
  // pour pouvoir les préserver même en cas d'erreur
  let setCookieHeader: string[] | undefined;
  
  // Essayer d'abord getSetCookie() (Node.js 18+)
  try {
    const getSetCookie = (response.headers as any).getSetCookie?.();
    if (getSetCookie && Array.isArray(getSetCookie) && getSetCookie.length > 0) {
      setCookieHeader = getSetCookie;
    }
  } catch (e) {
    // Ignorer si getSetCookie n'est pas disponible
  }
  
  // Si getSetCookie n'a pas fonctionné, essayer get('set-cookie')
  if (!setCookieHeader) {
    const setCookieValue = response.headers.get('set-cookie');
    if (setCookieValue) {
      // Si plusieurs cookies sont dans une seule chaîne, les séparer
      setCookieHeader = setCookieValue.split(',').map(c => c.trim());
    }
  }
  
  // Log pour debug
  if (setCookieHeader && setCookieHeader.length > 0) {
    console.log('parseWooCommerceResponse - Found Set-Cookie headers:', setCookieHeader.length);
  }

  if (!response.ok) {
    const errorMessage =
      typeof parsedBody === 'object' && parsedBody !== null && 'message' in parsedBody
        ? (parsedBody as { message?: string }).message ?? response.statusText
        : response.statusText || 'Unknown WooCommerce error';

    // Inclure les cookies dans les détails de l'erreur pour les préserver
    const errorDetails = typeof parsedBody === 'object' && parsedBody !== null
      ? { ...(parsedBody as Record<string, unknown>), ...(setCookieHeader ? { cookie: setCookieHeader } : {}) }
      : parsedBody;

    throw new WooCommerceError(errorMessage, response.status, errorDetails);
  }

  if (Array.isArray(parsedBody)) {
    const arrayWithMeta = [...parsedBody];
    if (setCookieHeader) {
      (arrayWithMeta as any).cookie = setCookieHeader;
    }
    return arrayWithMeta;
  }

  if (parsedBody && typeof parsedBody === 'object') {
    return {
      ...(parsedBody as Record<string, unknown>),
      ...(setCookieHeader ? { cookie: setCookieHeader } : {}),
    };
  }

  return parsedBody;
}

// Fonction pour créer les headers d'authentification Basic Auth
// Node.js ne supporte pas les credentials dans l'URL avec fetch(), il faut utiliser Basic Auth dans les headers
function getBasicAuthHeaders(): Record<string, string> {
  const auth = Buffer.from(`${WC_CONSUMER_KEY}:${WC_CONSUMER_SECRET}`).toString('base64');
  return {
    'Authorization': `Basic ${auth}`,
  };
}

// Récupérer tous les produits
export async function getProducts(params?: Record<string, string>) {
  const searchParams = new URLSearchParams(params);
  const pageNum = params?.page ? parseInt(params.page) : 1;
  
  // Utiliser l'API Store pour toutes les pages (testé avec CURL, fonctionne pour toutes les pages)
  const storeUrl = `${WC_API_URL}/wp-json/wc/store/v1/products?${searchParams.toString()}`;
  const restUrl = `${WC_API_URL}/wp-json/wc/v3/products?${searchParams.toString()}`;
  
  try {
    // Pour la page 1, utiliser l'API Store
    // Pour les pages > 1, utiliser directement l'API REST (plus fiable pour la pagination)
    if (pageNum === 1) {
      console.log(`[getProducts] Page 1 - Utilisation de l'API Store: ${storeUrl}`);
      
      const response = await fetch(storeUrl, {
        headers: buildHeaders(),
      });
      
      console.log(`[getProducts] API Store - Page ${pageNum}: Status ${response.status}, OK: ${response.ok}`);
      
      if (response.ok) {
        try {
          const products = await parseWooCommerceResponse(response);
          console.log(`[getProducts] API Store - Page ${pageNum}: Type réponse: ${typeof products}, IsArray: ${Array.isArray(products)}`);
          
          if (Array.isArray(products) && products.length > 0) {
            console.log(`[getProducts] API Store - Page ${pageNum}: ${products.length} produits retournés`);
            // Normaliser les produits pour s'assurer qu'ils ont toujours un objet prices
            return products.map((product: any) => {
              if (!product.prices) {
                product.prices = {
                  price: product.price || '0',
                  regular_price: product.regular_price,
                  sale_price: product.sale_price,
                };
              }
              return product;
            });
          } else if (Array.isArray(products) && products.length === 0) {
            console.warn(`[getProducts] API Store - Page ${pageNum}: 0 produits retournés, passage à l'API REST`);
          } else {
            console.warn(`[getProducts] API Store - Page ${pageNum}: réponse n'est pas un tableau (type: ${typeof products}), utilisation de l'API REST`);
          }
        } catch (parseError) {
          console.error(`[getProducts] Erreur lors du parsing de la réponse Store API pour la page ${pageNum}:`, parseError);
        }
      } else {
        const errorText = await response.text().catch(() => 'Impossible de lire le texte d\'erreur');
        console.error(`[getProducts] API Store - Page ${pageNum}: réponse non-OK (${response.status}), texte: ${errorText.substring(0, 200)}`);
      }
    } else {
      console.log(`[getProducts] Page ${pageNum} - Utilisation directe de l'API REST (plus fiable pour pagination)`);
    }
    
    // Utiliser l'API REST (pour pages > 1 ou si API Store a échoué)
    console.log(`[getProducts] Tentative API REST pour la page ${pageNum}`);
    const restResponse = await fetch(restUrl, {
      headers: {
        ...buildHeaders(),
        ...getBasicAuthHeaders(),
      },
    });
    
    console.log(`[getProducts] API REST - Page ${pageNum}: Status ${restResponse.status}, OK: ${restResponse.ok}`);
    
    if (!restResponse.ok) {
      const errorText = await restResponse.text().catch(() => 'Impossible de lire le texte d\'erreur');
      console.error(`[getProducts] API REST - Page ${pageNum}: Erreur ${restResponse.status}, texte: ${errorText.substring(0, 200)}`);
      throw new WooCommerceError(
        `API REST a échoué avec le statut ${restResponse.status}: ${errorText.substring(0, 100)}`,
        restResponse.status
      );
    }
    
    const restProducts = await parseWooCommerceResponse(restResponse);
    console.log(`[getProducts] API REST - Page ${pageNum}: Type réponse: ${typeof restProducts}, IsArray: ${Array.isArray(restProducts)}`);
    
    // Normaliser les produits de l'API REST pour qu'ils correspondent au format de l'API Store
    if (Array.isArray(restProducts)) {
      console.log(`[getProducts] API REST - Page ${pageNum}: ${restProducts.length} produits`);
      if (restProducts.length === 0) {
        console.warn(`[getProducts] API REST - Page ${pageNum}: 0 produits retournés, mais réponse OK. Vérification de l'URL: ${restUrl}`);
      }
      return restProducts.map((product: any) => {
        const normalized: any = { ...product };
        
        // Normaliser les images si nécessaire
        if (product.images && Array.isArray(product.images)) {
          normalized.images = product.images.map((img: any) => ({
            src: img.src || img.url,
            alt: img.alt || product.name || '',
          }));
        }
        
        // Normaliser les prix - toujours créer un objet prices même s'il est vide
        if (!normalized.prices) {
          normalized.prices = {
            price: product.price || product.prices?.price || '0',
            regular_price: product.regular_price || product.prices?.regular_price,
            sale_price: product.sale_price || product.prices?.sale_price,
          };
        }
        
        // Normaliser le permalink si nécessaire
        if (product.permalink && !normalized.permalink) {
          normalized.permalink = product.permalink;
        }
        
        return normalized;
      });
    }
    
    // Si ce n'est pas un tableau, retourner un tableau vide plutôt que undefined
    console.error(`[getProducts] API REST - Page ${pageNum}: Réponse n'est pas un tableau, retour d'un tableau vide`);
    return [];
  } catch (error) {
    console.error(`[getProducts] Erreur pour la page ${pageNum}:`, error);
    throw error;
  }
}

// Récupérer un produit par ID
export async function getProduct(id: string | number) {
  // Essayer d'abord l'API Store, puis l'API REST classique si nécessaire
  const storeUrl = `${WC_API_URL}/wp-json/wc/store/v1/products/${id}`;
  const restUrl = `${WC_API_URL}/wp-json/wc/v3/products/${id}`;
  
  try {
    // Essayer l'API Store d'abord
    let response = await fetch(storeUrl, {
      headers: buildHeaders(),
    });
    
    if (!response.ok) {
      // Si l'API Store échoue, essayer l'API REST classique
      response = await fetch(restUrl, {
        headers: {
          ...buildHeaders(),
          ...getBasicAuthHeaders(),
        },
      });
    }
    
    const product: any = await parseWooCommerceResponse(response);
    
    // Normaliser les prix - toujours créer un objet prices même s'il est vide
    if (!product.prices) {
      product.prices = {
        price: product.price || '0',
        regular_price: product.regular_price,
        sale_price: product.sale_price,
      };
    }
    
    // Normaliser les attributs pour une structure cohérente
    if (product.attributes && Array.isArray(product.attributes)) {
      product.attributes = product.attributes.map((attr: any) => {
        // Si options est vide mais qu'il y a des valeurs ailleurs
        if ((!attr.options || attr.options.length === 0) && attr.id) {
          // Les attributs peuvent avoir leurs valeurs dans d'autres champs
          return attr;
        }
        return attr;
      });
    }
    
    return product;
  } catch (error) {
    console.error('Error fetching product:', error);
    throw error;
  }
}

// Rechercher des produits
export async function searchProducts(query: string) {
  return getProducts({ search: query });
}

// Récupérer le panier (via session)
export async function getCart(cookie?: string) {
  const url = `${WC_API_URL}/wp-json/wc/store/v1/cart`;
  
  try {
    const headers = buildHeaders(cookie);
    console.log('getCart - URL:', url);
    console.log('getCart - Cookie header:', cookie ? cookie.substring(0, 100) + '...' : 'missing');
    console.log('getCart - Headers sent:', Object.keys(headers));
    
    const response = await fetch(url, {
      headers,
      credentials: 'include',
    });

    console.log('getCart - Response status:', response.status);
    console.log('getCart - Response headers:', Array.from(response.headers.keys()));
    
    const setCookieHeaders = (response.headers as any).getSetCookie?.() || [];
    console.log('getCart - Set-Cookie headers from WooCommerce:', setCookieHeaders.length > 0 ? setCookieHeaders : 'none');

    return await parseWooCommerceResponse(response);
  } catch (error) {
    console.error('Error fetching cart:', error);
    throw error;
  }
}

// Obtenir le nonce pour l'API Store
async function getStoreNonce(cookie?: string): Promise<string | null> {
  try {
    const url = `${WC_API_URL}/wp-json/wc/store/v1/cart`;
    const response = await fetch(url, {
      headers: buildHeaders(cookie),
      credentials: 'include',
    });
    
    // Le nonce peut être dans plusieurs en-têtes selon la version de WooCommerce
    // Essayer d'abord 'Nonce', puis 'X-WC-Store-API-Nonce'
    let nonce = response.headers.get('Nonce') || 
                response.headers.get('nonce') ||
                response.headers.get('X-WC-Store-API-Nonce') ||
                response.headers.get('x-wc-store-api-nonce');
    
    // Si le nonce n'est pas dans les headers, vérifier dans le body de la réponse
    // Cloner la réponse pour pouvoir la lire sans la consommer
    if (!nonce && response.ok) {
      try {
        const clonedResponse = response.clone();
        const cartData = await clonedResponse.json();
        // Certaines versions peuvent retourner le nonce dans le body
        if (cartData.nonce) {
          nonce = cartData.nonce;
        }
      } catch (e) {
        // Ignorer si le body n'est pas JSON ou si la réponse ne peut pas être clonée
        console.warn('Could not read nonce from response body:', e);
      }
    }
    
    // Log pour debug
    if (nonce) {
      console.log('Nonce retrieved successfully');
    } else {
      console.warn('No nonce found in headers or body. Available headers:', 
        Array.from(response.headers.keys()).join(', '));
    }
    
    return nonce;
  } catch (error) {
    console.error('Error getting nonce:', error);
    return null;
  }
}

// Ajouter un produit au panier
export async function addToCart(productId: number, quantity: number = 1, variation?: Record<string, any>, cookie?: string) {
  const url = `${WC_API_URL}/wp-json/wc/store/v1/cart/add-item`;
  
  try {
    // Obtenir le nonce d'abord
    const nonce = await getStoreNonce(cookie);
    
    const headers = buildHeaders(cookie);
    
    // Ajouter le nonce si disponible (essayer les deux formats)
    if (nonce) {
      headers['Nonce'] = nonce;
      headers['X-WC-Store-API-Nonce'] = nonce;
    } else {
      console.warn('No nonce available, request may fail');
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({
        id: productId,
        quantity,
        ...(variation && { variation }),
      }),
    });
    
    return await parseWooCommerceResponse(response);
  } catch (error) {
    console.error('Error adding to cart:', error);
    throw error;
  }
}

// Mettre à jour un article du panier
export async function updateCartItem(itemKey: string, quantity: number, cookie?: string) {
  const url = `${WC_API_URL}/wp-json/wc/store/v1/cart/update-item`;
  
  try {
    console.log('updateCartItem - URL:', url);
    console.log('updateCartItem - itemKey:', itemKey, 'quantity:', quantity);
    
    // Obtenir le nonce d'abord
    const nonce = await getStoreNonce(cookie);
    console.log('updateCartItem - nonce:', nonce ? 'present' : 'missing');
    
    const headers = buildHeaders(cookie);
    
    // Ajouter le nonce si disponible (essayer les deux formats)
    if (nonce) {
      headers['Nonce'] = nonce;
      headers['X-WC-Store-API-Nonce'] = nonce;
    } else {
      console.warn('No nonce available, request may fail');
    }
    
    const requestBody = {
      key: itemKey,
      quantity: quantity,
    };
    console.log('updateCartItem - request body:', requestBody);
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify(requestBody),
    });
    
    console.log('updateCartItem - response status:', response.status);
    console.log('updateCartItem - response ok:', response.ok);
    
    // Clone response for error logging if needed
    if (!response.ok) {
      const clonedResponse = response.clone();
      try {
        const errorText = await clonedResponse.text();
        console.error('updateCartItem - error response:', errorText);
      } catch (e) {
        console.error('updateCartItem - could not read error response');
      }
    }
    
    return await parseWooCommerceResponse(response);
  } catch (error) {
    console.error('Error updating cart item:', error);
    throw error;
  }
}

// Supprimer un article du panier
export async function removeCartItem(itemKey: string, cookie?: string) {
  const url = `${WC_API_URL}/wp-json/wc/store/v1/cart/remove-item`;
  
  try {
    console.log('removeCartItem - URL:', url);
    console.log('removeCartItem - itemKey:', itemKey);
    
    // Obtenir le nonce d'abord
    const nonce = await getStoreNonce(cookie);
    console.log('removeCartItem - nonce:', nonce ? 'present' : 'missing');
    
    const headers = buildHeaders(cookie);
    
    // Ajouter le nonce si disponible (essayer les deux formats)
    if (nonce) {
      headers['Nonce'] = nonce;
      headers['X-WC-Store-API-Nonce'] = nonce;
    } else {
      console.warn('No nonce available, request may fail');
    }
    
    // Try with key in body first (standard WooCommerce Store API format)
    const response = await fetch(url, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ key: itemKey }),
    });
    
    console.log('removeCartItem - response status:', response.status);
    console.log('removeCartItem - response ok:', response.ok);
    
    // If that fails, try with key as query parameter
    if (!response.ok && response.status === 400) {
      console.log('Trying alternative format with key in URL...');
      const urlAlt = `${WC_API_URL}/wp-json/wc/store/v1/cart/remove-item?key=${encodeURIComponent(itemKey)}`;
      const responseAlt = await fetch(urlAlt, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({}), // Empty body, key is in URL
      });
      
      if (responseAlt.ok) {
        console.log('removeCartItem - alternative format succeeded');
        return await parseWooCommerceResponse(responseAlt);
      }
      
      // Log error from alternative attempt and throw
      const clonedResponseAlt = responseAlt.clone();
      let errorText = 'Could not read error response';
      try {
        errorText = await clonedResponseAlt.text();
        console.error('removeCartItem - alternative error response:', errorText);
      } catch (e) {
        console.error('removeCartItem - could not read alternative error response');
      }
      
      // If alternative also failed, throw the error from the alternative attempt
      throw new WooCommerceError(
        `Failed to remove cart item: ${responseAlt.statusText}`,
        responseAlt.status,
        errorText
      );
    }
    
    // Clone response for error logging if needed
    if (!response.ok) {
      const clonedResponse = response.clone();
      try {
        const errorText = await clonedResponse.text();
        console.error('removeCartItem - error response:', errorText);
        throw new WooCommerceError(
          `Failed to remove cart item: ${response.statusText}`,
          response.status,
          errorText
        );
      } catch (e) {
        if (e instanceof WooCommerceError) {
          throw e;
        }
        console.error('removeCartItem - could not read error response');
        throw new WooCommerceError(
          `Failed to remove cart item: ${response.statusText}`,
          response.status
        );
      }
    }
    
    return await parseWooCommerceResponse(response);
  } catch (error) {
    console.error('Error removing cart item:', error);
    throw error;
  }
}

// Récupérer les méthodes de livraison disponibles
export async function getShippingMethods(shippingAddress: Record<string, any>, cookie?: string) {
  const updateUrl = `${WC_API_URL}/wp-json/wc/store/v1/cart/update-customer`;
  
  try {
    console.log('getShippingMethods - Updating address:', shippingAddress);
    
    // Get nonce
    const nonce = await getStoreNonce(cookie);
    const headers = buildHeaders(cookie);
    
    if (nonce) {
      headers['Nonce'] = nonce;
      headers['X-Wc-Store-Api-Nonce'] = nonce;
    }
    
    // Update shipping address in cart - cette réponse contient déjà les shipping rates
    // Utiliser AbortController pour timeout après 15 secondes
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 secondes timeout
    
    try {
      const updateResponse = await fetch(updateUrl, {
        method: 'POST',
        headers,
        credentials: 'include',
        signal: controller.signal,
        body: JSON.stringify({
          shipping_address: shippingAddress,
        }),
      });
      
      clearTimeout(timeoutId);
    
      console.log('getShippingMethods - Update response status:', updateResponse.status);
      
      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        console.error('getShippingMethods - Update error:', errorText);
        throw new WooCommerceError(`Failed to update shipping address: ${updateResponse.status}`, updateResponse.status, errorText);
      }
      
      // La réponse de update-customer contient déjà le panier avec les shipping rates
      const cart = await parseWooCommerceResponse(updateResponse);
      
      // Extraire les shipping rates depuis la réponse
      // WooCommerce peut retourner les rates dans différentes structures
      let shippingRates: any[] = [];
      
      if ((cart as any)?.shipping_rates && Array.isArray((cart as any).shipping_rates)) {
        shippingRates = (cart as any).shipping_rates;
      } else if ((cart as any)?.shipping_packages && Array.isArray((cart as any).shipping_packages)) {
        // Extraire les rates de tous les packages
        (cart as any).shipping_packages.forEach((pkg: any) => {
          if (pkg.shipping_rates && Array.isArray(pkg.shipping_rates)) {
            shippingRates.push(...pkg.shipping_rates);
          }
        });
      }
      
      console.log('getShippingMethods - Shipping rates found:', shippingRates.length);
      
      // Si pas de rates dans la réponse update, récupérer le panier séparément
      if (shippingRates.length === 0) {
        console.log('getShippingMethods - No rates in update response, fetching cart separately');
        const cartUrl = `${WC_API_URL}/wp-json/wc/store/v1/cart`;
        const cartController = new AbortController();
        const cartTimeoutId = setTimeout(() => cartController.abort(), 10000); // 10 secondes pour le second appel
        
        try {
          const cartResponse = await fetch(cartUrl, {
            headers: buildHeaders(cookie),
            credentials: 'include',
            signal: cartController.signal,
          });
          
          clearTimeout(cartTimeoutId);
          
          const cartData = await parseWooCommerceResponse(cartResponse);
          
          if ((cartData as any)?.shipping_rates && Array.isArray((cartData as any).shipping_rates)) {
            shippingRates = (cartData as any).shipping_rates;
          } else if ((cartData as any)?.shipping_packages && Array.isArray((cartData as any).shipping_packages)) {
            (cartData as any).shipping_packages.forEach((pkg: any) => {
              if (pkg.shipping_rates && Array.isArray(pkg.shipping_rates)) {
                shippingRates.push(...pkg.shipping_rates);
              }
            });
          }
        } catch (cartError: any) {
          clearTimeout(cartTimeoutId);
          if (cartError.name === 'AbortError') {
            console.error('getShippingMethods - Cart fetch timeout');
            throw new WooCommerceError('Timeout while fetching shipping methods', 504);
          }
          throw cartError;
        }
      }
      
      console.log('getShippingMethods - Final shipping rates:', shippingRates);
      
      return shippingRates;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        console.error('getShippingMethods - Request timeout');
        throw new WooCommerceError('Timeout while fetching shipping methods. Please check your shipping address and try again.', 504);
      }
      console.error('Error fetching shipping methods:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error fetching shipping methods:', error);
    throw error;
  }
}

// Mettre à jour la méthode de livraison sélectionnée
export async function updateShippingMethod(rateId: string, cookie?: string) {
  const url = `${WC_API_URL}/wp-json/wc/store/v1/cart/select-shipping-rate`;
  
  try {
    const nonce = await getStoreNonce(cookie);
    const headers = buildHeaders(cookie);
    
    if (nonce) {
      headers['Nonce'] = nonce;
      headers['X-WC-Store-API-Nonce'] = nonce;
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ rate_id: rateId }),
    });
    
    return await parseWooCommerceResponse(response);
  } catch (error) {
    console.error('Error updating shipping method:', error);
    throw error;
  }
}

// Récupérer les taux de TVA par pays (via l'API REST WooCommerce)
export async function getTaxRates(country: string, state?: string) {
  const url = `${WC_API_URL}/wp-json/wc/v3/taxes`;
  const params = new URLSearchParams({ country, per_page: '100' });
  if (state) params.append('state', state);
  
  try {
    const response = await fetch(`${url}?${params.toString()}`, {
      headers: {
        ...buildHeaders(),
        ...getBasicAuthHeaders(),
      },
    });
    
    return await parseWooCommerceResponse(response);
  } catch (error) {
    console.error('Error fetching tax rates:', error);
    throw error;
  }
}

// Créer une commande (checkout)
export async function createOrder(orderData: {
  billing_address: Record<string, any>;
  shipping_address: Record<string, any>;
  payment_method: string;
  payment_method_title: string;
  shipping_method?: string;
  shipping_method_title?: string;
  set_paid?: boolean;
}, cookie?: string) {
  const url = `${WC_API_URL}/wp-json/wc/store/v1/checkout`;
  
  try {
    const nonce = await getStoreNonce(cookie);
    const headers = buildHeaders(cookie);
    
    if (nonce) {
      headers['Nonce'] = nonce;
      headers['X-WC-Store-API-Nonce'] = nonce;
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify(orderData),
    });
    
    return await parseWooCommerceResponse(response);
  } catch (error) {
    console.error('Error creating order:', error);
    throw error;
  }
}

