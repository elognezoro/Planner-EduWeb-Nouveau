/** Gabarits HTML des e-mails transactionnels — identité EduWeb Planner (vert forêt + or). */

interface Gabarit {
  subject: string;
  html: string;
}

/**
 * Signature institutionnelle par défaut, apposée à TOUS les messages sortants (e-mail via la
 * coque ci-dessous ; réutilisable en texte brut pour la messagerie interne et les SMS).
 */
export const SIGNATURE_TEXTE = "EdTech EduWeb\nWhatsApp : (+225) 01 5263 3030";
export const SIGNATURE_HTML =
  `<p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:#2b3a33;">` +
  `<strong style="color:#0f3527;">EdTech EduWeb</strong><br>` +
  `WhatsApp : <a href="https://wa.me/2250152633030" style="color:#ad821f;text-decoration:none;">(+225)&nbsp;01&nbsp;5263&nbsp;3030</a></p>`;

function coque(titre: string, corps: string, bouton: { libelle: string; href: string }): string {
  return `
  <div style="margin:0;padding:32px 0;background:#fbfaf6;font-family:Arial,Helvetica,sans-serif;color:#1e2a25;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #f3ebd7;border-radius:16px;overflow:hidden;">
          <tr><td style="background:linear-gradient(135deg,#154231,#0f3527);padding:28px 36px;">
            <span style="font-size:20px;font-weight:bold;color:#fdfcf8;">EduWeb&nbsp;<span style="color:#e3b536;">Planner</span></span>
          </td></tr>
          <tr><td style="padding:36px;">
            <h1 style="margin:0 0 16px;font-size:22px;color:#0f3527;">${titre}</h1>
            <div style="font-size:15px;line-height:1.6;color:#2b3a33;">${corps}</div>
            <div style="margin:32px 0;">
              <a href="${bouton.href}" style="display:inline-block;background:#154231;color:#fdfcf8;text-decoration:none;font-weight:bold;padding:14px 28px;border-radius:9999px;">${bouton.libelle}</a>
            </div>
            <p style="font-size:13px;color:#6b7d73;line-height:1.6;">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br><a href="${bouton.href}" style="color:#ad821f;word-break:break-all;">${bouton.href}</a></p>
          </td></tr>
          <tr><td style="padding:20px 36px;background:#faf6ec;font-size:12px;color:#6b7d73;">
            ${SIGNATURE_HTML}
            Plateforme nationale de gestion et de planification scolaire — système éducatif ivoirien.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </div>`;
}

/**
 * Encadré mis en VALEUR — instruction FONDAMENTALE de rattachement : indiquer par mail/WhatsApp
 * l'établissement et le statut demandés. Réutilisé dans la confirmation de compte et le rappel.
 */
export function encadreRattachement(): string {
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background:#fff7e0;border:2px solid #e3b536;border-radius:12px;">` +
    `<tr><td style="padding:18px 20px;">` +
    `<p style="margin:0 0 10px;font-size:16px;font-weight:bold;color:#0f3527;">⚠️ Étape essentielle — rattachement de votre compte</p>` +
    `<p style="margin:0;font-size:14px;line-height:1.7;color:#2b3a33;">Veuillez faire un message à ` +
    `<a href="mailto:info@eduweb.ci" style="color:#ad821f;font-weight:bold;">info@eduweb.ci</a> avec copie à ` +
    `<a href="mailto:elognezoro@gmail.com" style="color:#ad821f;font-weight:bold;">elognezoro@gmail.com</a> ou par WhatsApp à ` +
    `<a href="https://wa.me/2250152633030" style="color:#ad821f;font-weight:bold;">(+225)&nbsp;01&nbsp;5263&nbsp;3030</a> ` +
    `pour signifier l'établissement auquel vous demandez à être rattaché·e et avec quel statut ` +
    `(<strong>Chef d'établissement, ACE, Fondateur, Directeur des études, etc.</strong>).</p>` +
    `</td></tr></table>`
  );
}

export function gabaritVerification(lien: string, prenom?: string | null): Gabarit {
  const salutation = prenom ? `Bonjour ${prenom},` : "Bonjour,";
  return {
    subject: "Confirmez votre adresse e-mail — EduWeb Planner",
    html: coque(
      "Confirmez votre compte",
      `<p>${salutation}</p><p>Merci de votre inscription sur EduWeb Planner. Cliquez sur le bouton ci-dessous pour activer votre compte. Ce lien est valable 24&nbsp;heures.</p>` +
        encadreRattachement(),
      { libelle: "Activer mon compte", href: lien },
    ),
  };
}

/**
 * Rappel autonome de rattachement — envoyé aux comptes déjà créés (avec e-mail fonctionnel) qui
 * demeurent au statut « élève » par défaut, pour qu'ils précisent leur établissement et statut.
 */
export function gabaritRattachement(lien: string, prenom?: string | null): Gabarit {
  const salutation = prenom ? `Bonjour ${prenom},` : "Bonjour,";
  return {
    subject: "Important : précisez votre établissement et votre statut — EduWeb Planner",
    html: coque(
      "Finalisez le rattachement de votre compte",
      `<p>${salutation}</p><p>Votre compte EduWeb Planner est bien actif. Pour obtenir le statut correspondant à votre fonction (au-delà du statut « élève » attribué par défaut), une dernière étape essentielle est nécessaire :</p>` +
        encadreRattachement(),
      { libelle: "Accéder à mon espace", href: lien },
    ),
  };
}

export function gabaritReinitialisation(lien: string, prenom?: string | null): Gabarit {
  const salutation = prenom ? `Bonjour ${prenom},` : "Bonjour,";
  return {
    subject: "Réinitialisation de votre mot de passe — EduWeb Planner",
    html: coque(
      "Réinitialiser votre mot de passe",
      `<p>${salutation}</p><p>Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour en choisir un nouveau. Ce lien est valable 1&nbsp;heure. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.</p>`,
      { libelle: "Choisir un nouveau mot de passe", href: lien },
    ),
  };
}

export function gabaritDecisionRole(
  approuve: boolean,
  libelleRole: string,
  lien: string,
  prenom?: string | null,
): Gabarit {
  const salutation = prenom ? `Bonjour ${prenom},` : "Bonjour,";
  const corps = approuve
    ? `<p>${salutation}</p><p>Bonne nouvelle : votre demande pour le rôle <strong>${libelleRole}</strong> a été <strong>approuvée</strong>. Votre accès complet est désormais débloqué.</p>`
    : `<p>${salutation}</p><p>Votre demande pour le rôle <strong>${libelleRole}</strong> n'a pas été retenue. Vous pouvez contacter votre administration ou soumettre une nouvelle demande depuis votre profil.</p>`;
  return {
    subject: approuve
      ? `Votre rôle ${libelleRole} est approuvé — EduWeb Planner`
      : `Votre demande de rôle — EduWeb Planner`,
    html: coque(approuve ? "Demande approuvée" : "Demande traitée", corps, {
      libelle: "Accéder à mon espace",
      href: lien,
    }),
  };
}

/** Échappe le HTML dans les valeurs dynamiques insérées dans les e-mails. */
function echapper(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * E-mail d'un ÉCHANGE autour d'une demande de rôle (avant approbation).
 * `deLAdmin` : message de l'administration vers le demandeur (bouton → son espace) ;
 * sinon : réponse du demandeur vers l'administration (bouton → page Approbations).
 */
export function gabaritMessageApprobation(opts: {
  deLAdmin: boolean;
  roleLibelle: string;
  message: string;
  lien: string;
  prenom?: string | null;
  nomDemandeur?: string | null;
}): Gabarit {
  const messageHtml = echapper(opts.message).replace(/\n/g, "<br>");
  const bloc =
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;background:#faf6ec;border-left:4px solid #e3b536;border-radius:8px;">` +
    `<tr><td style="padding:14px 18px;font-size:14px;line-height:1.7;color:#2b3a33;">${messageHtml}</td></tr></table>`;

  if (opts.deLAdmin) {
    const salutation = opts.prenom ? `Bonjour ${echapper(opts.prenom)},` : "Bonjour,";
    return {
      subject: `À propos de votre demande de rôle (${echapper(opts.roleLibelle)}) — EduWeb Planner`,
      html: coque(
        "Message de l'administration",
        `<p>${salutation}</p><p>Concernant votre demande pour le rôle <strong>${echapper(opts.roleLibelle)}</strong>, l'administration souhaite préciser un point avant de valider votre compte :</p>` +
          bloc +
          `<p>Vous pouvez <strong>répondre directement à cet e-mail</strong> ou depuis votre espace « Mon Identification ».</p>`,
        { libelle: "Répondre depuis mon espace", href: opts.lien },
      ),
    };
  }

  const qui = opts.nomDemandeur ? echapper(opts.nomDemandeur) : "Un demandeur";
  return {
    subject: `Réponse d'un demandeur — ${echapper(opts.roleLibelle)} — EduWeb Planner`,
    html: coque(
      "Réponse d'un demandeur",
      `<p><strong>${qui}</strong> a répondu au sujet de sa demande pour le rôle <strong>${echapper(opts.roleLibelle)}</strong> :</p>` +
        bloc,
      { libelle: "Ouvrir les approbations", href: opts.lien },
    ),
  };
}

/**
 * E-mail d'un MESSAGE DIRECT reçu sur la plateforme (copie e-mail de la messagerie interne).
 * Le destinataire peut répondre directement à l'e-mail (replyTo = expéditeur) ou en ligne.
 */
export function gabaritMessageDirect(opts: {
  expediteurNom: string;
  message: string;
  lien: string;
  prenomDest?: string | null;
}): Gabarit {
  const salutation = opts.prenomDest ? `Bonjour ${echapper(opts.prenomDest)},` : "Bonjour,";
  const messageHtml = echapper(opts.message).replace(/\n/g, "<br>");
  const bloc =
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;background:#faf6ec;border-left:4px solid #e3b536;border-radius:8px;">` +
    `<tr><td style="padding:14px 18px;font-size:14px;line-height:1.7;color:#2b3a33;">${messageHtml}</td></tr></table>`;
  return {
    subject: `Nouveau message de ${echapper(opts.expediteurNom)} — EduWeb Planner`,
    html: coque(
      "Vous avez reçu un message",
      `<p>${salutation}</p><p><strong>${echapper(opts.expediteurNom)}</strong> vous a adressé un message sur EduWeb Planner :</p>` +
        bloc +
        `<p>Vous pouvez <strong>répondre directement à cet e-mail</strong> ou depuis votre espace « Communication ».</p>`,
      { libelle: "Ouvrir la messagerie", href: opts.lien },
    ),
  };
}

/**
 * E-mail d'identifiants temporaires — envoyé quand l'administration réinitialise le mot de
 * passe d'un utilisateur : contient le nouveau mot de passe et invite à le changer du profil.
 */
export function gabaritMotDePasseTemporaire(
  email: string,
  motDePasse: string,
  lien: string,
  prenom?: string | null,
): Gabarit {
  const salutation = prenom ? `Bonjour ${echapper(prenom)},` : "Bonjour,";
  const corps =
    `<p>${salutation}</p>` +
    `<p>Votre mot de passe EduWeb Planner a été réinitialisé par l'administration. Voici vos identifiants temporaires :</p>` +
    `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0;background:#faf6ec;border:1px solid #f3ebd7;border-radius:10px;">` +
    `<tr><td style="padding:14px 18px;font-size:14px;line-height:1.9;color:#2b3a33;">` +
    `<strong>Adresse e-mail :</strong> ${echapper(email)}<br>` +
    `<strong>Mot de passe temporaire :</strong> <code style="font-size:15px;color:#0f3527;">${echapper(motDePasse)}</code>` +
    `</td></tr></table>` +
    `<p>Pour votre sécurité, connectez-vous puis <strong>modifiez ce mot de passe</strong> depuis votre profil (« Mon Profil » &rarr; « Sécurité »).</p>` +
    `<p style="font-size:13px;color:#6b7d73;">Si vous n'êtes pas à l'origine de cette demande, contactez votre administration.</p>`;
  return {
    subject: "Vos identifiants temporaires — EduWeb Planner",
    html: coque("Mot de passe réinitialisé", corps, { libelle: "Se connecter", href: lien }),
  };
}

/**
 * E-mail d'invitation — envoyé aux comptes créés par import CSV : contient le mot de passe
 * temporaire commun et invite l'utilisateur à le changer depuis son profil.
 */
export function gabaritInvitation(
  email: string,
  motDePasse: string,
  lien: string,
  prenom?: string | null,
): Gabarit {
  const salutation = prenom ? `Bonjour ${echapper(prenom)},` : "Bonjour,";
  const corps =
    `<p>${salutation}</p>` +
    `<p>Un compte vient d'être créé pour vous sur EduWeb Planner. Voici vos identifiants de connexion :</p>` +
    `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0;background:#faf6ec;border:1px solid #f3ebd7;border-radius:10px;">` +
    `<tr><td style="padding:14px 18px;font-size:14px;line-height:1.9;color:#2b3a33;">` +
    `<strong>Adresse e-mail :</strong> ${echapper(email)}<br>` +
    `<strong>Mot de passe temporaire :</strong> <code style="font-size:15px;color:#0f3527;">${echapper(motDePasse)}</code>` +
    `</td></tr></table>` +
    `<p>Pour votre sécurité, connectez-vous puis <strong>modifiez ce mot de passe</strong> depuis votre profil (« Mon Profil » &rarr; « Sécurité »).</p>`;
  return {
    subject: "Votre accès à EduWeb Planner",
    html: coque("Votre compte a été créé", corps, { libelle: "Se connecter", href: lien }),
  };
}

/**
 * E-mail au supérieur hiérarchique (ACE / Chef d'établissement) : une demande d'autorisation
 * d'absence attend sa décision (bouton → file de validation).
 */
export function gabaritDemandeAbsence(opts: {
  demandeurNom: string;
  periode: string;
  lien: string;
  prenomDest?: string | null;
  motif?: string | null;
}): Gabarit {
  const salutation = opts.prenomDest ? `Bonjour ${echapper(opts.prenomDest)},` : "Bonjour,";
  const blocMotif = opts.motif
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;background:#faf6ec;border-left:4px solid #e3b536;border-radius:8px;">` +
      `<tr><td style="padding:14px 18px;font-size:14px;line-height:1.7;color:#2b3a33;"><strong>Motif :</strong> ${echapper(opts.motif)}</td></tr></table>`
    : "";
  return {
    subject: `Demande d'autorisation d'absence — ${echapper(opts.demandeurNom)} — EduWeb Planner`,
    html: coque(
      "Demande d'autorisation d'absence",
      `<p>${salutation}</p><p><strong>${echapper(opts.demandeurNom)}</strong> a déposé une demande d'autorisation d'absence pour la période <strong>${echapper(opts.periode)}</strong>. Votre décision est attendue.</p>` +
        blocMotif,
      { libelle: "Examiner la demande", href: opts.lien },
    ),
  };
}

/**
 * E-mail au demandeur : décision de sa demande d'autorisation d'absence. En cas d'avis
 * favorable, le bouton mène à la FICHE OFFICIELLE de synthèse (consultable et imprimable).
 */
export function gabaritDecisionAbsence(opts: {
  approuve: boolean;
  periode: string;
  lien: string;
  prenom?: string | null;
  motifDecision?: string | null;
}): Gabarit {
  const salutation = opts.prenom ? `Bonjour ${echapper(opts.prenom)},` : "Bonjour,";
  const blocMotif = opts.motifDecision
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;background:#faf6ec;border-left:4px solid #e3b536;border-radius:8px;">` +
      `<tr><td style="padding:14px 18px;font-size:14px;line-height:1.7;color:#2b3a33;"><strong>Observation :</strong> ${echapper(opts.motifDecision)}</td></tr></table>`
    : "";
  if (opts.approuve) {
    return {
      subject: `Autorisation d'absence accordée (${echapper(opts.periode)}) — EduWeb Planner`,
      html: coque(
        "Autorisation d'absence accordée",
        `<p>${salutation}</p><p>Votre demande d'autorisation d'absence pour la période <strong>${echapper(opts.periode)}</strong> a reçu un <strong>avis favorable</strong>. La fiche officielle de synthèse, portant l'en-tête de l'établissement, est disponible sur votre espace.</p>` +
          blocMotif,
        { libelle: "Consulter la fiche officielle", href: opts.lien },
      ),
    };
  }
  return {
    subject: `Demande d'autorisation d'absence — décision (${echapper(opts.periode)}) — EduWeb Planner`,
    html: coque(
      "Décision sur votre demande d'absence",
      `<p>${salutation}</p><p>Votre demande d'autorisation d'absence pour la période <strong>${echapper(opts.periode)}</strong> n'a pas reçu d'avis favorable.</p>` +
        blocMotif,
      { libelle: "Voir le détail", href: opts.lien },
    ),
  };
}

/** Les 10 potentialités de la plateforme, présentées dans l'e-mail de fin d'essai. */
const POTENTIALITES_FIN_ESSAI: [string, string][] = [
  ["Emploi du temps", "générez et optimisez vos emplois du temps sans conflits horaires"],
  ["Registre d'appel", "suivez les présences de vos élèves en temps réel"],
  ["Cahier de texte", "gardez la trace de chaque séance et de la progression des cours"],
  ["Notes et bulletins de notes", "saisissez, calculez et éditez les bulletins en quelques clics"],
  ["Rapports d'établissement", "produisez des rapports clairs et complets, prêts à transmettre"],
  ["Statistiques", "visualisez les indicateurs clés de votre établissement d'un seul coup d'œil"],
  ["Autorisation d'absence", "gérez les demandes et validations d'absence de façon transparente"],
  ["Suppléance ou rattrapage", "organisez les remplacements et les cours de rattrapage sans stress"],
  ["Pilotage complet", "de la salle de classe au chef d'établissement, au DRENA — ou à la DECO —, au cabinet ou au SENEC : chaque niveau dispose de la bonne information au bon moment"],
  ["Livret éducatif, de motivation, et modules de formation", "accompagnez et faites grandir vos équipes et vos élèves"],
];

/**
 * E-mail AUTOMATIQUE de fin de période d'essai. Rappelle les 10 potentialités, invite à
 * l'abonnement (bouton), et appose en SIGNATURE le flyer officiel de la plateforme (image
 * hébergée, dimensionnée pour l'e-mail). Envoyé une seule fois par la tâche planifiée.
 */
export function gabaritFinEssai(opts: {
  prenom?: string | null;
  dateFin: string;
  lienAbonnement: string;
  flyerUrl: string;
  contactWhatsapp: string;
}): Gabarit {
  const salutation = opts.prenom ? `Bonjour ${echapper(opts.prenom)},` : "Bonjour,";
  const liste = POTENTIALITES_FIN_ESSAI.map(
    ([titre, desc], i) =>
      `<tr><td style="padding:6px 0;font-size:14px;line-height:1.6;color:#2b3a33;vertical-align:top;">` +
      `<span style="display:inline-block;min-width:22px;font-weight:bold;color:#ad821f;">${i + 1}.</span>` +
      `<strong style="color:#0f3527;">${titre}</strong> — ${desc}.</td></tr>`,
  ).join("");

  const corps =
    `<p>${salutation}</p>` +
    `<p>Votre période d'essai gratuite d'<strong>EduWeb Planner</strong> arrive à son terme le <strong>${echapper(opts.dateFin)}</strong>. Nous espérons que ces quelques semaines vous ont permis de mesurer à quel point la planification scolaire peut devenir simple, fluide et intelligente.</p>` +
    `<p>En passant à l'abonnement, vous conservez sans interruption l'accès à l'ensemble des <strong>10 potentialités</strong> de la plateforme :</p>` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 16px;">${liste}</table>` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;background:#fff7e0;border:2px solid #e3b536;border-radius:12px;">` +
    `<tr><td style="padding:16px 20px;font-size:14px;line-height:1.7;color:#2b3a33;">` +
    `<strong style="color:#0f3527;">Sans abonnement actif, l'accès à ces fonctionnalités sera suspendu à la fin de votre essai</strong> — mais vos données restent en sécurité et vous les retrouverez intégralement dès votre souscription.</td></tr></table>` +
    `<p style="font-size:16px;font-weight:bold;color:#0f3527;margin:20px 0 6px;">Passez à l'abonnement dès aujourd'hui</p>` +
    `<p>Ne laissez pas vos emplois du temps, vos notes et vos rapports s'arrêter en pleine année scolaire. Choisissez la formule adaptée à votre établissement et poursuivez sans interruption.</p>` +
    `<p style="font-size:14px;color:#2b3a33;">Rendez-vous sur <a href="https://planning.eduweb.ci" style="color:#ad821f;font-weight:bold;">planning.eduweb.ci</a> ou contactez notre équipe par WhatsApp au <a href="https://wa.me/2250152633030" style="color:#ad821f;font-weight:bold;">${echapper(opts.contactWhatsapp)}</a> : nous vous accompagnons dans le choix de votre formule et la prise en main complète de la plateforme.</p>` +
    `<p style="font-style:italic;color:#154231;">Planifiez aujourd'hui, réussissez demain !</p>` +
    // Signature : flyer officiel de la plateforme, dimensionné pour l'e-mail.
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 4px;"><tr><td align="center">` +
    `<a href="https://planning.eduweb.ci" style="text-decoration:none;">` +
    `<img src="${opts.flyerUrl}" alt="EduWeb Planner — La planification scolaire intelligente" width="480" style="width:100%;max-width:480px;height:auto;border:0;border-radius:12px;display:block;" />` +
    `</a></td></tr></table>`;

  return {
    subject: "Votre période d'essai se termine — continuez à piloter votre établissement sereinement",
    html: coque("Votre période d'essai se termine", corps, { libelle: "Je m'abonne maintenant", href: opts.lienAbonnement }),
  };
}
