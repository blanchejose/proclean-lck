/*
  Configuration de la base de données des avis (Supabase).
  Tant que ces deux valeurs sont vides, le site fonctionne en « mode démo » :
  les avis sont gardés uniquement dans le navigateur de la personne.

  Pour les brancher : voir le fichier GUIDE-AVIS.md
  (la clé « publishable » (ou « anon / public ») est faite pour être visible dans un site web, ce n'est pas un mot de passe).
*/
window.PROCLEAN_CONFIG = {
  supabaseUrl: 'https://pnkrboqbhzvbcwywgjit.supabase.co',
  supabaseAnonKey: 'sb_publishable_1ZeFVNXoXE-j-ex1yiIU1Q__Aq9qR-Q', // clé publique (publishable), faite pour être dans le site
};
