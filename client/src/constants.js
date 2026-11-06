export const VEHICLE_TYPES = [
  { value: 'velo', label: 'Vélo électrique', short: 'Vélo', icon: '🚲' },
  { value: 'trottinette', label: 'Trottinette électrique', short: 'Trottinette', icon: '🛴' },
  { value: 'scooter', label: 'Scooter électrique', short: 'Scooter', icon: '🛵' },
  { value: 'batterie', label: 'Batterie véhicule', short: 'Batterie', icon: '🔋' },
  { value: 'outil', label: 'Batterie outil / visseuse', short: 'Outil', icon: '🪛' },
  { value: 'autre', label: 'Autre', short: 'Autre', icon: '⚙️' },
];

export const REPAIR_STATUSES = [
  { value: 'en_attente', label: 'En attente', icon: '🕓', color: 'gray' },
  { value: 'en_cours', label: 'En cours', icon: '🔧', color: 'blue' },
  { value: 'en_pause', label: 'En pause', icon: '⏸️', color: 'orange' },
  { value: 'attente_piece', label: 'Attente pièce', icon: '📦', color: 'purple' },
  { value: 'en_test', label: 'En test', icon: '🧪', color: 'cyan' },
  { value: 'terminee', label: 'Terminée', icon: '✅', color: 'green' },
  { value: 'livree', label: 'Livrée', icon: '🏁', color: 'dim' },
];

export const PRIORITIES = [
  { value: 'urgent', label: 'Urgent', icon: '🔴' },
  { value: 'normal', label: 'Normal', icon: '🟡' },
  { value: 'pas_urgent', label: 'Pas urgent', icon: '🟢' },
];

export const REPAIR_CATEGORIES = [
  { value: 'general', label: 'Réparation', icon: '🔧' },
  { value: 'electronique', label: 'Électronique', icon: '⚡' },
  { value: 'chargeur', label: 'Adaptation chargeur', icon: '🔌' },
  { value: 'batterie', label: 'Batterie lithium', icon: '🔋' },
];

export const ELECTRONIC_INTERVENTIONS = [
  'Changement câble moteur hub',
  'Changement capteurs Hall',
  'Soudure',
  'Réparation câblage',
  'Adaptation connecteur',
  'Changement contrôleur',
  'Changement écran',
  'Remplacement système complet (contrôleur + écran génériques)',
  'Changement accélérateur / gâchette',
  'Changement freins / coupe-circuit',
];

export const BATTERY_INTERVENTIONS = [
  'Diagnostic batterie',
  'Équilibrage des cellules',
  'Reconstruction du pack',
  'Remplacement de cellules',
  'Bandes nickel',
  'Changement de BMS',
  'Réparation câblage / connecteurs',
  'Test de tension',
  'Test de capacité',
];

export const BATTERY_KINDS = [
  { value: 'vehicule', label: 'Véhicule', icon: '🛴' },
  { value: 'outil', label: 'Outil / visseuse', icon: '🪛' },
];

export const CELL_TYPES = ['18650', '21700', '26650', 'LiFePO4', 'Pouch / LiPo', 'Autre'];

export const STOCK_CATEGORIES = [
  'Chargeurs',
  'Batteries',
  'BMS',
  'Cellules 18650',
  'Cellules 21700',
  'Contrôleurs',
  'Écrans',
  'Moteurs',
  'Capteurs Hall',
  'Câbles',
  'Connecteurs',
  'Accessoires vélo électrique',
  'Accessoires trottinette électrique',
  'Accessoires scooter électrique',
  'Consommables d’atelier',
];

// "credit" = pay later: nothing is collected now (or an advance in cash)
export const PAYMENT_METHODS = [
  { value: 'especes', label: 'Espèces', icon: '💵' },
  { value: 'credit', label: 'Crédit', icon: '💳' },
  { value: 'echange', label: 'Échange', icon: '🔄' },
  { value: 'emprunt', label: 'Emprunt', icon: '🤝' },
];
export const COLLECT_METHODS = PAYMENT_METHODS.filter((m) => m.value !== 'credit');

export const DIAG_DECISIONS = [
  { value: 'acceptee', label: 'Réparation acceptée', icon: '✅', color: 'green' },
  { value: 'reflechit', label: 'Client réfléchit', icon: '🤔', color: 'orange' },
  { value: 'refuse', label: 'Client refuse', icon: '❌', color: 'red' },
  { value: 'impossible', label: 'Réparation impossible', icon: '⛔', color: 'gray' },
];

export const CONNECTOR_APPS = ['Chargeur', 'Batterie', 'Écran', 'Moteur', 'Capteurs Hall', 'Contrôleur', 'Accélérateur', 'Freins', 'Éclairage', 'Autre'];

export const WIRE_COLORS = [
  { value: 'rouge', css: '#e53935' },
  { value: 'noir', css: '#111' },
  { value: 'bleu', css: '#1e88e5' },
  { value: 'jaune', css: '#fdd835' },
  { value: 'vert', css: '#43a047' },
  { value: 'blanc', css: '#f5f5f5' },
  { value: 'orange', css: '#fb8c00' },
  { value: 'marron', css: '#6d4c41' },
  { value: 'gris', css: '#9e9e9e' },
  { value: 'violet', css: '#8e24aa' },
  { value: 'rose', css: '#ec407a' },
  { value: 'jaune/vert', css: 'linear-gradient(90deg,#fdd835 50%,#43a047 50%)' },
];

export const KNOWLEDGE_CATEGORIES = ['Batterie', 'BMS', 'Chargeur', 'Contrôleur', 'Écran', 'Moteur', 'Capteurs Hall', 'Câblage', 'Connecteurs', 'Freins', 'Mécanique', 'Autre'];

export const PHOTO_TAGS_BEFORE_AFTER = [
  { value: 'avant', label: 'Avant' },
  { value: 'apres', label: 'Après' },
  { value: 'autre', label: 'Autre' },
];

const byValue = (list) => Object.fromEntries(list.map((x) => [x.value, x]));
export const STATUS = byValue(REPAIR_STATUSES);
export const VEHICLE = byValue(VEHICLE_TYPES);
export const PRIORITY = byValue(PRIORITIES);
export const CATEGORY = byValue(REPAIR_CATEGORIES);
export const DECISION = byValue(DIAG_DECISIONS);
export const METHOD = byValue(PAYMENT_METHODS);
export const DOC_LABEL = { repair: 'Réparation', diagnostic: 'Diagnostic', sale: 'Vente' };
export const DOC_ROUTE = { repair: '/reparations/', diagnostic: '/diagnostics/', sale: '/ventes/' };
