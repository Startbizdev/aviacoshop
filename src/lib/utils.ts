// Fonction pour extraire le lien EASA depuis un HTML
export function extractEasaLink(html: string): string | null {
  if (!html) return null;
  
  // Chercher un lien avec "easa" dans le texte ou l'URL (insensible à la casse)
  // Supporte les guillemets simples et doubles
  const easaRegex = /<a[^>]*href=['"]([^'"]+)['"][^>]*>.*?easa.*?<\/a>/i;
  const match = html.match(easaRegex);
  
  if (match && match[1]) {
    return match[1];
  }
  
  // Chercher aussi un lien NetSuite avec media.nl dans le HTML
  const netsuiteRegex = /https?:\/\/[^'">\s]*netsuite\.com[^'">\s]*media\.nl[^'">\s]*/i;
  const netsuiteMatch = html.match(netsuiteRegex);
  if (netsuiteMatch && netsuiteMatch[0]) {
    // Vérifier si c'est dans un contexte EASA
    const context = html.toLowerCase();
    if (context.includes('easa') || context.includes('document')) {
      return netsuiteMatch[0];
    }
  }
  
  // Chercher aussi dans les attributs ou meta_data qui pourraient contenir le lien directement
  const urlRegex = /https?:\/\/[^\s<>"']+/gi;
  const urls = html.match(urlRegex);
  
  if (urls) {
    // Chercher un lien NetSuite qui ressemble à un PDF EASA
    const netsuitePdf = urls.find(url => 
      url.includes('netsuite.com') && 
      (url.includes('media.nl') || url.includes('.pdf'))
    );
    if (netsuitePdf) {
      // Vérifier le contexte pour confirmer que c'est EASA
      const context = html.toLowerCase();
      if (context.includes('easa') || context.includes('document')) {
        return netsuitePdf;
      }
    }
  }
  
  return null;
}

// Fonction pour chercher le lien EASA dans les attributs et meta_data d'un produit
export function findEasaLink(product: any): string | null {
  if (!product) return null;
  
  // Chercher dans les attributs
  if (product.attributes && Array.isArray(product.attributes)) {
    for (const attr of product.attributes) {
      const value = getAttributeValue(attr);
      if (value && typeof value === 'string') {
        const link = extractEasaLink(value);
        if (link) return link;
      }
      
      // Chercher dans options
      if (attr.options) {
        const optionsStr = Array.isArray(attr.options) ? attr.options.join(' ') : String(attr.options);
        const link = extractEasaLink(optionsStr);
        if (link) return link;
      }
      
      // Chercher dans terms
      if (attr.terms && Array.isArray(attr.terms)) {
        for (const term of attr.terms) {
          const termValue = term.name || term.slug || '';
          const link = extractEasaLink(String(termValue));
          if (link) return link;
        }
      }
    }
  }
  
  // Chercher dans meta_data
  if (product.meta_data && Array.isArray(product.meta_data)) {
    for (const meta of product.meta_data) {
      if (meta.value && typeof meta.value === 'string') {
        const link = extractEasaLink(meta.value);
        if (link) return link;
      }
    }
  }
  
  // Chercher dans la description
  if (product.description && typeof product.description === 'string') {
    const link = extractEasaLink(product.description);
    if (link) return link;
  }
  
  return null;
}

// Fonction helper pour obtenir la valeur d'un attribut
function getAttributeValue(attr: any): string {
  if (attr.value !== undefined && attr.value !== null && attr.value !== '') {
    return String(attr.value);
  }
  if (attr.options && Array.isArray(attr.options) && attr.options.length > 0) {
    return attr.options.join(' ');
  }
  if (typeof attr.options === 'string' && attr.options !== '') {
    return attr.options;
  }
  return '';
}
