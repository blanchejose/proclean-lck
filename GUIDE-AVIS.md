# Brancher les avis clients (gratuit, ~10 minutes)

Sans cette étape, le site marche en **mode démo** : les avis restent dans le navigateur de la personne qui les écrit.
Avec Supabase, **tous les visiteurs voient tous les avis**.

1. Va sur https://supabase.com et clique **Start your project**. Crée un compte (tu peux utiliser « Continue with GitHub »).
2. Clique **New project** : nom `proclean-lck`, choisis un mot de passe de base de données (garde-le pour toi), région **Europe (Frankfurt)** ou la plus proche, plan **Free**.
3. Une fois le projet prêt : menu de gauche **SQL Editor** → **New query** → colle le contenu de `supabase.sql` → **Run**.
4. Menu **Project Settings** → **API** (ou « Data API ») : copie
   - **Project URL** (ex. `https://abcdefgh.supabase.co`)
   - la clé **publishable** (ou **anon / public**) (pas la clé `service_role`, celle-là reste secrète !)
5. Ouvre `config.js` et colle ces deux valeurs entre les guillemets. Enregistre.

## Masquer ou supprimer un avis
Supabase → **Table Editor** → `reviews` → décoche `visible` (l'avis disparaît du site) ou supprime la ligne.
