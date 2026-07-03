/**
 * Référentiel des 193 États membres de l'ONU — noms français, code ISO 3166-1 alpha-2
 * (pour le drapeau), intitulé officiel de l'État (en-tête de bulletin), devise nationale
 * officielle et intitulé usuel du ministère chargé de l'éducation.
 *
 * Sert au bloc « Pays, slogan national officiel & en-tête du bulletin » : la sélection
 * d'un pays pré-remplit automatiquement le slogan et le ministère (modifiables ensuite).
 */

export interface PaysInfo {
  /** Code ISO 3166-1 alpha-2 (minuscule) — utilisé pour le drapeau. */
  code: string;
  /** Nom courant en français (stocké sur l'établissement). */
  nom: string;
  /** Intitulé officiel de l'État (ligne « RÉPUBLIQUE DE… » du bulletin). */
  intitule: string;
  /** Devise nationale officielle (vide si l'État n'en a pas). */
  devise: string;
  /** Intitulé usuel du ministère chargé de l'éducation. */
  ministere: string;
}

const MIN_DEFAUT = "Ministère de l'Éducation Nationale";

function p(code: string, nom: string, intitule: string, devise = "", ministere = MIN_DEFAUT): PaysInfo {
  return { code, nom, intitule, devise, ministere };
}

export const PAYS_ONU: PaysInfo[] = [
  // ── Afrique ──
  p("dz", "Algérie", "République algérienne démocratique et populaire", "Par le peuple et pour le peuple"),
  p("ao", "Angola", "République d'Angola"),
  p("bj", "Bénin", "République du Bénin", "Fraternité – Justice – Travail", "Ministère des Enseignements Secondaire, Technique et de la Formation Professionnelle"),
  p("bw", "Botswana", "République du Botswana", "Pula (La pluie)"),
  p("bf", "Burkina Faso", "Burkina Faso", "Unité – Progrès – Justice", "Ministère de l'Éducation Nationale, de l'Alphabétisation et de la Promotion des Langues Nationales"),
  p("bi", "Burundi", "République du Burundi", "Unité – Travail – Progrès"),
  p("cv", "Cabo Verde", "République de Cabo Verde", "Unité – Travail – Progrès"),
  p("cm", "Cameroun", "République du Cameroun", "Paix – Travail – Patrie", "Ministère des Enseignements Secondaires"),
  p("cf", "Centrafrique", "République centrafricaine", "Unité – Dignité – Travail"),
  p("td", "Tchad", "République du Tchad", "Unité – Travail – Progrès"),
  p("km", "Comores", "Union des Comores", "Unité – Solidarité – Développement"),
  p("cg", "Congo", "République du Congo", "Unité – Travail – Progrès"),
  p("cd", "République démocratique du Congo", "République démocratique du Congo", "Justice – Paix – Travail", "Ministère de l'Enseignement Primaire, Secondaire et Technique"),
  p("ci", "Côte d'Ivoire", "République de Côte d'Ivoire", "Union – Discipline – Travail", "Ministère de l'Éducation Nationale et de l'Alphabétisation"),
  p("dj", "Djibouti", "République de Djibouti", "Unité – Égalité – Paix"),
  p("eg", "Égypte", "République arabe d'Égypte"),
  p("gq", "Guinée équatoriale", "République de Guinée équatoriale", "Unité – Paix – Justice"),
  p("er", "Érythrée", "État d'Érythrée"),
  p("sz", "Eswatini", "Royaume d'Eswatini", "Siyinqaba (Nous sommes la forteresse)"),
  p("et", "Éthiopie", "République fédérale démocratique d'Éthiopie"),
  p("ga", "Gabon", "République gabonaise", "Union – Travail – Justice"),
  p("gm", "Gambie", "République de Gambie", "Progrès – Paix – Prospérité"),
  p("gh", "Ghana", "République du Ghana", "Liberté et Justice"),
  p("gn", "Guinée", "République de Guinée", "Travail – Justice – Solidarité"),
  p("gw", "Guinée-Bissau", "République de Guinée-Bissau", "Unité – Lutte – Progrès"),
  p("ke", "Kenya", "République du Kenya", "Harambee (Tous ensemble)"),
  p("ls", "Lesotho", "Royaume du Lesotho", "Paix – Pluie – Prospérité"),
  p("lr", "Libéria", "République du Libéria", "L'amour de la liberté nous a conduits ici"),
  p("ly", "Libye", "État de Libye"),
  p("mg", "Madagascar", "République de Madagascar", "Amour – Patrie – Progrès"),
  p("mw", "Malawi", "République du Malawi", "Unité et Liberté"),
  p("ml", "Mali", "République du Mali", "Un Peuple – Un But – Une Foi"),
  p("mr", "Mauritanie", "République islamique de Mauritanie", "Honneur – Fraternité – Justice", "Ministère de l'Éducation Nationale et de la Réforme du Système Éducatif"),
  p("mu", "Maurice", "République de Maurice", "L'étoile et la clé de l'océan Indien"),
  p("ma", "Maroc", "Royaume du Maroc", "Dieu, la Patrie, le Roi"),
  p("mz", "Mozambique", "République du Mozambique"),
  p("na", "Namibie", "République de Namibie", "Unité – Liberté – Justice"),
  p("ne", "Niger", "République du Niger", "Fraternité – Travail – Progrès"),
  p("ng", "Nigéria", "République fédérale du Nigéria", "Unité et Foi, Paix et Progrès"),
  p("rw", "Rwanda", "République du Rwanda", "Unité – Travail – Patriotisme"),
  p("st", "Sao Tomé-et-Principe", "République démocratique de Sao Tomé-et-Principe", "Unité – Discipline – Travail"),
  p("sn", "Sénégal", "République du Sénégal", "Un Peuple – Un But – Une Foi"),
  p("sc", "Seychelles", "République des Seychelles", "Finis Coronat Opus (La fin couronne l'œuvre)"),
  p("sl", "Sierra Leone", "République de Sierra Leone", "Unité – Liberté – Justice"),
  p("so", "Somalie", "République fédérale de Somalie"),
  p("za", "Afrique du Sud", "République d'Afrique du Sud", "L'unité dans la diversité"),
  p("ss", "Soudan du Sud", "République du Soudan du Sud", "Justice – Liberté – Prospérité"),
  p("sd", "Soudan", "République du Soudan", "La victoire est à nous"),
  p("tz", "Tanzanie", "République-Unie de Tanzanie", "Liberté et Unité"),
  p("tg", "Togo", "République togolaise", "Travail – Liberté – Patrie", "Ministère des Enseignements Primaire et Secondaire"),
  p("tn", "Tunisie", "République tunisienne", "Liberté – Ordre – Justice"),
  p("ug", "Ouganda", "République d'Ouganda", "Pour Dieu et mon pays"),
  p("zm", "Zambie", "République de Zambie", "Une Zambie, une nation"),
  p("zw", "Zimbabwe", "République du Zimbabwe", "Unité – Liberté – Travail"),

  // ── Amériques ──
  p("ag", "Antigua-et-Barbuda", "Antigua-et-Barbuda", "Chacun s'efforçant, tous réussissant"),
  p("ar", "Argentine", "République argentine", "En union et liberté"),
  p("bs", "Bahamas", "Commonwealth des Bahamas", "En avant, vers le haut, ensemble"),
  p("bb", "Barbade", "Barbade", "Fierté et Industrie"),
  p("bz", "Belize", "Belize", "Sub Umbra Floreo (Je fleuris à l'ombre)"),
  p("bo", "Bolivie", "État plurinational de Bolivie", "L'union fait la force"),
  p("br", "Brésil", "République fédérative du Brésil", "Ordre et Progrès"),
  p("ca", "Canada", "Canada", "D'un océan à l'autre"),
  p("cl", "Chili", "République du Chili", "Par la raison ou par la force"),
  p("co", "Colombie", "République de Colombie", "Liberté et Ordre"),
  p("cr", "Costa Rica", "République du Costa Rica"),
  p("cu", "Cuba", "République de Cuba", "La Patrie ou la Mort"),
  p("dm", "Dominique", "Commonwealth de Dominique", "Après Bondie, c'est la Ter"),
  p("do", "République dominicaine", "République dominicaine", "Dieu – Patrie – Liberté"),
  p("ec", "Équateur", "République de l'Équateur", "Dieu, Patrie et Liberté"),
  p("sv", "Salvador", "République du Salvador", "Dieu – Union – Liberté"),
  p("gd", "Grenade", "Grenade", "Conscients de Dieu, nous aspirons, bâtissons et avançons unis"),
  p("gt", "Guatemala", "République du Guatemala", "Grandis libre et fécond"),
  p("gy", "Guyana", "République coopérative du Guyana", "Un peuple, une nation, un destin"),
  p("ht", "Haïti", "République d'Haïti", "Liberté – Égalité – Fraternité", "Ministère de l'Éducation Nationale et de la Formation Professionnelle"),
  p("hn", "Honduras", "République du Honduras", "Libre, souverain et indépendant"),
  p("jm", "Jamaïque", "Jamaïque", "De plusieurs, un seul peuple"),
  p("mx", "Mexique", "États-Unis mexicains"),
  p("ni", "Nicaragua", "République du Nicaragua", "En Dieu nous croyons"),
  p("pa", "Panama", "République du Panama", "Pour le bien du monde"),
  p("py", "Paraguay", "République du Paraguay", "Paix et Justice"),
  p("pe", "Pérou", "République du Pérou", "Ferme et heureux par l'union"),
  p("kn", "Saint-Kitts-et-Nevis", "Fédération de Saint-Kitts-et-Nevis", "La patrie avant soi"),
  p("lc", "Sainte-Lucie", "Sainte-Lucie", "La terre, le peuple, la lumière"),
  p("vc", "Saint-Vincent-et-les-Grenadines", "Saint-Vincent-et-les-Grenadines", "Paix et Justice"),
  p("sr", "Suriname", "République du Suriname", "Justice – Piété – Fidélité"),
  p("tt", "Trinité-et-Tobago", "République de Trinité-et-Tobago", "Ensemble nous aspirons, ensemble nous réussissons"),
  p("us", "États-Unis", "États-Unis d'Amérique", "In God We Trust (En Dieu nous croyons)"),
  p("uy", "Uruguay", "République orientale de l'Uruguay", "La liberté ou la mort"),
  p("ve", "Venezuela", "République bolivarienne du Venezuela"),

  // ── Asie ──
  p("af", "Afghanistan", "Afghanistan"),
  p("sa", "Arabie saoudite", "Royaume d'Arabie saoudite"),
  p("am", "Arménie", "République d'Arménie"),
  p("az", "Azerbaïdjan", "République d'Azerbaïdjan"),
  p("bh", "Bahreïn", "Royaume de Bahreïn"),
  p("bd", "Bangladesh", "République populaire du Bangladesh"),
  p("bt", "Bhoutan", "Royaume du Bhoutan"),
  p("bn", "Brunéi", "Brunéi Darussalam", "Toujours au service, avec l'aide de Dieu"),
  p("kh", "Cambodge", "Royaume du Cambodge", "Nation – Religion – Roi"),
  p("cn", "Chine", "République populaire de Chine"),
  p("cy", "Chypre", "République de Chypre"),
  p("kp", "Corée du Nord", "République populaire démocratique de Corée"),
  p("kr", "Corée du Sud", "République de Corée"),
  p("ae", "Émirats arabes unis", "Émirats arabes unis"),
  p("ge", "Géorgie", "Géorgie", "La force est dans l'unité"),
  p("in", "Inde", "République de l'Inde", "Seule la vérité triomphe"),
  p("id", "Indonésie", "République d'Indonésie", "L'unité dans la diversité"),
  p("iq", "Irak", "République d'Irak", "Dieu est le plus grand"),
  p("ir", "Iran", "République islamique d'Iran", "Indépendance, Liberté, République islamique"),
  p("il", "Israël", "État d'Israël"),
  p("jp", "Japon", "Japon"),
  p("jo", "Jordanie", "Royaume hachémite de Jordanie", "Dieu, la Patrie, le Roi"),
  p("kz", "Kazakhstan", "République du Kazakhstan"),
  p("kg", "Kirghizistan", "République kirghize"),
  p("kw", "Koweït", "État du Koweït"),
  p("la", "Laos", "République démocratique populaire lao", "Paix, Indépendance, Démocratie, Unité et Prospérité"),
  p("lb", "Liban", "République libanaise"),
  p("my", "Malaisie", "Malaisie", "L'unité fait la force"),
  p("mv", "Maldives", "République des Maldives"),
  p("mn", "Mongolie", "Mongolie"),
  p("mm", "Myanmar", "République de l'Union du Myanmar"),
  p("np", "Népal", "République fédérale démocratique du Népal"),
  p("om", "Oman", "Sultanat d'Oman"),
  p("uz", "Ouzbékistan", "République d'Ouzbékistan"),
  p("pk", "Pakistan", "République islamique du Pakistan", "Foi – Unité – Discipline"),
  p("ph", "Philippines", "République des Philippines", "Pour Dieu, le peuple, la nature et la patrie"),
  p("qa", "Qatar", "État du Qatar"),
  p("sg", "Singapour", "République de Singapour", "En avant, Singapour"),
  p("lk", "Sri Lanka", "République socialiste démocratique de Sri Lanka"),
  p("sy", "Syrie", "République arabe syrienne"),
  p("tj", "Tadjikistan", "République du Tadjikistan"),
  p("th", "Thaïlande", "Royaume de Thaïlande"),
  p("tl", "Timor-Leste", "République démocratique du Timor-Leste", "Unité – Action – Progrès"),
  p("tm", "Turkménistan", "Turkménistan"),
  p("tr", "Turquie", "République de Turquie"),
  p("vn", "Viêt Nam", "République socialiste du Viêt Nam", "Indépendance – Liberté – Bonheur"),
  p("ye", "Yémen", "République du Yémen", "Dieu, la Patrie, la Révolution, l'Unité"),

  // ── Europe ──
  p("al", "Albanie", "République d'Albanie"),
  p("de", "Allemagne", "République fédérale d'Allemagne", "Unité, Droit, Liberté"),
  p("ad", "Andorre", "Principauté d'Andorre", "La vertu unie est plus forte"),
  p("at", "Autriche", "République d'Autriche"),
  p("by", "Bélarus", "République du Bélarus"),
  p("be", "Belgique", "Royaume de Belgique", "L'union fait la force"),
  p("ba", "Bosnie-Herzégovine", "Bosnie-Herzégovine"),
  p("bg", "Bulgarie", "République de Bulgarie", "L'union fait la force"),
  p("hr", "Croatie", "République de Croatie"),
  p("dk", "Danemark", "Royaume du Danemark"),
  p("es", "Espagne", "Royaume d'Espagne", "Plus Ultra (Toujours plus loin)"),
  p("ee", "Estonie", "République d'Estonie"),
  p("fi", "Finlande", "République de Finlande"),
  p("fr", "France", "République française", "Liberté – Égalité – Fraternité"),
  p("gr", "Grèce", "République hellénique", "La liberté ou la mort"),
  p("hu", "Hongrie", "Hongrie"),
  p("ie", "Irlande", "Irlande"),
  p("is", "Islande", "République d'Islande"),
  p("it", "Italie", "République italienne"),
  p("lv", "Lettonie", "République de Lettonie"),
  p("li", "Liechtenstein", "Principauté de Liechtenstein", "Pour Dieu, le Prince et la Patrie"),
  p("lt", "Lituanie", "République de Lituanie", "La force de la nation réside dans l'unité"),
  p("lu", "Luxembourg", "Grand-Duché de Luxembourg", "Nous voulons rester ce que nous sommes"),
  p("mk", "Macédoine du Nord", "République de Macédoine du Nord"),
  p("mt", "Malte", "République de Malte", "Par le courage et la constance"),
  p("md", "Moldavie", "République de Moldavie"),
  p("mc", "Monaco", "Principauté de Monaco", "Avec l'aide de Dieu"),
  p("me", "Monténégro", "Monténégro"),
  p("no", "Norvège", "Royaume de Norvège"),
  p("nl", "Pays-Bas", "Royaume des Pays-Bas", "Je maintiendrai"),
  p("pl", "Pologne", "République de Pologne"),
  p("pt", "Portugal", "République portugaise"),
  p("ro", "Roumanie", "Roumanie"),
  p("gb", "Royaume-Uni", "Royaume-Uni de Grande-Bretagne et d'Irlande du Nord", "Dieu et mon droit"),
  p("ru", "Russie", "Fédération de Russie"),
  p("sm", "Saint-Marin", "République de Saint-Marin", "Libertas (Liberté)"),
  p("rs", "Serbie", "République de Serbie"),
  p("sk", "Slovaquie", "République slovaque"),
  p("si", "Slovénie", "République de Slovénie"),
  p("se", "Suède", "Royaume de Suède"),
  p("ch", "Suisse", "Confédération suisse", "Un pour tous, tous pour un"),
  p("cz", "Tchéquie", "République tchèque", "La vérité vaincra"),
  p("ua", "Ukraine", "Ukraine"),

  // ── Océanie ──
  p("au", "Australie", "Australie"),
  p("fj", "Fidji", "République des Fidji", "Craignez Dieu et honorez le Roi"),
  p("ki", "Kiribati", "République de Kiribati", "Santé, Paix et Prospérité"),
  p("mh", "Îles Marshall", "République des Îles Marshall", "L'accomplissement par l'effort commun"),
  p("fm", "Micronésie", "États fédérés de Micronésie", "Paix – Unité – Liberté"),
  p("nr", "Nauru", "République de Nauru", "La volonté de Dieu d'abord"),
  p("nz", "Nouvelle-Zélande", "Nouvelle-Zélande"),
  p("pw", "Palaos", "République des Palaos"),
  p("pg", "Papouasie-Nouvelle-Guinée", "État indépendant de Papouasie-Nouvelle-Guinée", "L'unité dans la diversité"),
  p("ws", "Samoa", "État indépendant du Samoa", "Samoa est fondée sur Dieu"),
  p("sb", "Îles Salomon", "Îles Salomon", "Diriger, c'est servir"),
  p("to", "Tonga", "Royaume des Tonga", "Dieu et Tonga sont mon héritage"),
  p("tv", "Tuvalu", "Tuvalu", "Tuvalu pour le Tout-Puissant"),
  p("vu", "Vanuatu", "République de Vanuatu", "En Dieu nous nous tenons"),
];

/** Retrouve un pays par son code ISO 3166-1 alpha-2 (ex. « CI », « BJ »). */
export function paysParCode(code: string | null | undefined): PaysInfo | null {
  if (!code) return null;
  const c = code.trim().toLowerCase();
  return PAYS_ONU.find((x) => x.code === c) ?? null;
}

/** Recherche accent-insensible d'un pays par son nom courant. */
export function trouverPays(nom: string | null | undefined): PaysInfo | null {
  if (!nom) return null;
  const n = nom.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  return (
    PAYS_ONU.find((x) => x.nom.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase() === n) ?? null
  );
}

/** URL du drapeau (flagcdn — images légères, largeur ~40 px). */
export function drapeauUrl(code: string, largeur: 20 | 40 | 80 = 40): string {
  return `https://flagcdn.com/w${largeur}/${code.toLowerCase()}.png`;
}

/** Drapeau en émoji (repli si l'image ne charge pas). */
export function drapeauEmoji(code: string): string {
  return [...code.toUpperCase()].map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65)).join("");
}
