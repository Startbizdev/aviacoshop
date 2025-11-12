# Configuration de la page de contact

La page de contact est maintenant disponible à `/contact` avec un formulaire complet et une carte Google Maps intégrée.

## Fonctionnalités

- ✅ Formulaire de contact avec validation
- ✅ Carte Google Maps intégrée
- ✅ Informations de contact affichées (téléphone, email, adresse)
- ✅ Design responsive et moderne
- ✅ Support du dark mode
- ✅ Animations et transitions fluides

## Configuration de l'envoi d'email

Pour que le formulaire envoie réellement des emails à `rfq@aviaco.fr`, vous devez configurer un service d'email. Trois options sont disponibles :

### Option 1 : Resend (Recommandé) ⭐

**Avantages :** Simple, moderne, gratuit jusqu'à 3 000 emails/mois

1. Créez un compte sur [https://resend.com](https://resend.com)
2. Générez une clé API depuis [https://resend.com/api-keys](https://resend.com/api-keys)
3. Installez le package :
   ```bash
   npm install resend
   ```
4. Ajoutez la clé API dans votre fichier `.env` :
   ```env
   RESEND_API_KEY=re_xxxxxxxxxxxxx
   ```
5. Configurez un domaine vérifié dans Resend (ou utilisez le domaine de test fourni)

### Option 2 : SendGrid

**Avantages :** Fiable, 100 emails/jour gratuits

1. Créez un compte sur [https://sendgrid.com](https://sendgrid.com)
2. Générez une clé API depuis [https://app.sendgrid.com/settings/api_keys](https://app.sendgrid.com/settings/api_keys)
3. Installez le package :
   ```bash
   npm install @sendgrid/mail
   ```
4. Ajoutez la clé API dans votre fichier `.env` :
   ```env
   SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
   ```

### Option 3 : Web3Forms (Gratuit, sans installation)

**Avantages :** Aucune installation, gratuit, simple

1. Allez sur [https://web3forms.com](https://web3forms.com)
2. Entrez votre email `rfq@aviaco.fr`
3. Copiez la clé d'accès générée
4. Ajoutez la clé dans votre fichier `.env` :
   ```env
   WEB3FORMS_ACCESS_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   ```

## Configuration de la carte Google Maps

La carte Google Maps est déjà intégrée avec les coordonnées de Marignane. Pour obtenir l'URL d'embed exacte :

1. Allez sur [Google Maps](https://www.google.com/maps)
2. Recherchez : "Zac des Florides, Îlot Carmin, Bat 4, Marignane, France"
3. Cliquez sur "Partager" → "Intégrer une carte"
4. Copiez le code iframe et remplacez l'URL dans `contact.astro` si nécessaire

## Test en développement

En mode développement, si aucun service d'email n'est configuré, les emails seront simplement loggés dans la console. Le formulaire fonctionnera normalement pour tester l'interface.

## Informations de contact affichées

- **Téléphone :** +33 4 42 14 18 97
- **Email :** rfq@aviaco.fr
- **Adresse :** Zac des Florides, Îlot Carmin, Bat 4, Marignane, France

## Structure du formulaire

Le formulaire inclut les champs suivants :
- Nom complet (requis)
- Email (requis, avec validation)
- Téléphone (optionnel)
- Sujet (requis)
- Message (requis)

Tous les champs sont validés côté client et serveur.

