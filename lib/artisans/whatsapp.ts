// Lien de conversation WhatsApp depuis un numéro E.164 (`phone_e164`).
//
// `wa.me` attend le numéro international SANS le `+` ni séparateur. On refuse tout
// ce qui n'est pas un E.164 plausible plutôt que de bricoler un indicatif : l'UI
// n'affiche alors simplement pas le bouton, ce qui vaut mieux qu'un lien qui ouvre
// WhatsApp sur un mauvais numéro.
//
// Conversation VIDE, volontairement : aucun texte n'est écrit au nom du voisin. On
// ne peut pas savoir si le numéro a WhatsApp — le libellé du bouton annonce le
// canal, il ne promet pas une réponse.

// E.164 : `+` puis 8 à 15 chiffres.
const E164 = /^\+(\d{8,15})$/;

export function waMeUrl(phoneE164: string | null | undefined): string | null {
  if (!phoneE164) return null;
  const compact = phoneE164.replace(/\s/g, '');
  const match = E164.exec(compact);
  if (!match) return null;
  return `https://wa.me/${match[1]}`;
}
