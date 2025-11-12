# Aviaco Shop

Boutique e-commerce Aviaco construite avec Astro et Tailwind CSS, intégrée avec WooCommerce.

## 🚀 Installation

```bash
npm install
```

## 📝 Configuration

Créez un fichier `.env` à la racine du projet avec les variables suivantes :

```env
PUBLIC_WC_API_URL=https://shop.aviaco.fr
PUBLIC_WC_CONSUMER_KEY=ck_de6fd27f045022aed05fa58152ecda27e439f443
PUBLIC_WC_CONSUMER_SECRET=cs_4a211802186d015c8e415023e233659a1921ba3b
```

## 🛠️ Développement

```bash
npm run dev
```

Le site sera accessible sur `http://localhost:4321`

## 🏗️ Build

```bash
npm run build
```

## 📦 Structure du projet

```
src/
├── components/
│   ├── atoms/          # Composants atomiques (Button, Input, Card, etc.)
│   ├── molecules/      # Composants moléculaires (ProductCard, SearchBar, etc.)
│   └── organisms/      # Composants organismes (Header, Footer)
├── layouts/            # Layouts Astro
├── lib/                # Utilitaires et API
├── pages/              # Pages et routes
│   ├── api/           # Endpoints API
│   └── ...
└── styles/             # Styles globaux
```

## 🎨 Design System

- **Couleur primaire**: #0413a5
- **Police**: Outfit (Google Fonts)
- **Dark mode**: Activé par défaut avec toggle
- **Responsive**: Mobile-first

## 🔌 Intégration WooCommerce

Le projet utilise l'API REST WooCommerce pour :
- Récupérer les produits
- Gérer le panier
- Créer les commandes
- Rechercher des produits

Les endpoints utilisés :
- `/wp-json/wc/store/v1/products` - Liste des produits
- `/wp-json/wc/store/v1/cart` - Panier
- `/wp-json/wc/store/v1/cart/add-item` - Ajouter au panier
- `/wp-json/wc/store/v1/checkout` - Créer une commande

## 📄 Pages

- `/` - Page d'accueil
- `/catalogue` - Catalogue des produits
- `/produit/[id]` - Page produit
- `/panier` - Panier
- `/checkout` - Checkout
- `/commande/[id]` - Confirmation de commande

## 🧩 Composants

### Atoms
- Button
- Input
- Card
- Badge
- Icon
- Spinner
- Image

### Molecules
- ProductCard
- SearchBar
- CartItem
- CartButton
- ThemeToggle

### Organisms
- Header
- Footer

## 📱 Fonctionnalités

- ✅ Catalogue de produits
- ✅ Recherche avec suggestions en temps réel
- ✅ Panier fonctionnel
- ✅ Checkout complet
- ✅ Dark mode
- ✅ Responsive design
- ✅ Affichage des attributs produits
- ✅ Gestion des variations produits

## 🔐 Authentification

L'authentification JWT est optionnelle. Pour l'activer, configurez le plugin JWT Auth sur WordPress et utilisez les endpoints `/jwt-auth/v1/token` pour obtenir un token.

