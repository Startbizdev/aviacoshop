# Configuration Stripe

Ce guide explique comment configurer Stripe pour les paiements par carte dans votre boutique Aviaco.

## 📋 Prérequis

1. Un compte Stripe (gratuit) : [https://stripe.com](https://stripe.com)
2. Les clés API Stripe (publique et secrète)

## 🔑 Configuration des clés API

### 1. Obtenir vos clés Stripe

1. Connectez-vous à votre [tableau de bord Stripe](https://dashboard.stripe.com)
2. Allez dans **Developers** > **API keys**
3. Copiez votre **Publishable key** (clé publique)
4. Copiez votre **Secret key** (clé secrète) - ⚠️ Ne la partagez jamais publiquement

### 2. Configurer les variables d'environnement

Ajoutez les clés suivantes dans votre fichier `.env` à la racine du projet :

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxx  # Clé secrète (test ou live)
PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxx  # Clé publique (test ou live)
```

**Important :**
- Pour le développement, utilisez les clés de **test** (commencent par `sk_test_` et `pk_test_`)
- Pour la production, utilisez les clés **live** (commencent par `sk_live_` et `pk_live_`)
- La clé publique doit avoir le préfixe `PUBLIC_` pour être accessible côté client

## 🚀 Installation

Les packages Stripe sont déjà installés dans `package.json`. Si vous devez les installer manuellement :

```bash
npm install stripe @stripe/stripe-js
```

## ✅ Vérification

Une fois configuré, vous devriez voir :

1. **Dans le checkout** : L'option "Credit or Debit Card" avec le formulaire Stripe
2. **Dans la console** : Aucune erreur concernant Stripe
3. **Paiement test** : Utilisez les cartes de test Stripe :
   - **Succès** : `4242 4242 4242 4242`
   - **Échec** : `4000 0000 0000 0002`
   - Date d'expiration : n'importe quelle date future (ex: `12/34`)
   - CVC : n'importe quel 3 chiffres (ex: `123`)

## 🔒 Sécurité

- ✅ La clé secrète Stripe reste sur le serveur uniquement
- ✅ La clé publique est injectée de manière sécurisée dans le layout
- ✅ Les paiements sont traités via Stripe Elements (conforme PCI)
- ✅ Aucune donnée de carte n'est stockée sur votre serveur

## 📝 Fonctionnalités

- ✅ Formulaire de carte intégré dans le checkout
- ✅ Validation en temps réel
- ✅ Support du dark mode
- ✅ Gestion des erreurs de paiement
- ✅ Création automatique de commande après paiement réussi
- ✅ Page de confirmation avec tous les détails

## 🐛 Dépannage

### Le formulaire Stripe ne s'affiche pas

1. Vérifiez que `PUBLIC_STRIPE_PUBLISHABLE_KEY` est bien défini dans `.env`
2. Vérifiez la console du navigateur pour les erreurs
3. Assurez-vous que le script Stripe est chargé : `https://js.stripe.com/v3/`

### Erreur "Payment Intent not found"

1. Vérifiez que `STRIPE_SECRET_KEY` est bien défini dans `.env`
2. Vérifiez que vous utilisez les bonnes clés (test vs live)
3. Vérifiez les logs du serveur pour plus de détails

### Le paiement échoue

1. Utilisez une carte de test Stripe valide
2. Vérifiez que le montant est supérieur à 0
3. Vérifiez que le panier n'est pas vide
4. Consultez les logs Stripe dans votre tableau de bord

## 📚 Documentation

- [Documentation Stripe](https://stripe.com/docs)
- [Stripe Elements](https://stripe.com/docs/payments/elements)
- [Payment Intents](https://stripe.com/docs/payments/payment-intents)

