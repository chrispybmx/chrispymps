import type { SpotType, SpotCondition } from './types';

// ===== TIPI SPOT =====
export const TIPI_SPOT: Record<SpotType, { label: string; emoji: string; color: string }> = {
  street: { label: 'Street',  emoji: '🏙️', color: '#ff6a00' },
  park:   { label: 'Park',    emoji: '🏟️', color: '#00c851' },
  diy:    { label: 'DIY',     emoji: '🔧', color: '#ffce4d' },
  rail:   { label: 'Rail',    emoji: '🛤️', color: '#a78bfa' },
  ledge:  { label: 'Ledge',   emoji: '📐', color: '#38bdf8' },
  trail:  { label: 'Trail',   emoji: '🌲', color: '#86efac' },
  plaza:  { label: 'Plaza',   emoji: '🏛️', color: '#f472b6' },
  gap:    { label: 'Gap',     emoji: '⬜', color: '#fb923c' },
  bowl:      { label: 'Bowl',      emoji: '🥣', color: '#34d399' },
  pumptrack: { label: 'Pumptrack', emoji: '🌀', color: '#06b6d4' },
};

// ===== CONDIZIONI =====
export const CONDIZIONI: Record<SpotCondition, { label: string; color: string; bg: string }> = {
  alive:    { label: 'Alive',    color: '#000',      bg: '#00c851' },
  bustato:  { label: 'Bustato',  color: '#000',      bg: '#ff6a00' },
  demolito: { label: 'Demolito', color: '#f3ead8',   bg: '#3a3a3a' },
};

// ===== DIFFICOLTÀ =====
export const DIFFICOLTA = [
  { value: 'beginner',     label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'pro',          label: 'Pro' },
];

// ===== SUPERFICI =====
export const SUPERFICI = [
  'Asfalto',
  'Marmo',
  'Cemento',
  'Granito',
  'Legno',
  'Metallo',
  'Misto',
];

// ===== CITTÀ ITALIANE (ordinato per rilevanza BMX) =====
export const CITTA_ITALIANE = [
  // Veneto
  { value: 'verona',          label: 'Verona' },
  { value: 'venezia',         label: 'Venezia' },
  { value: 'padova',          label: 'Padova' },
  { value: 'vicenza',         label: 'Vicenza' },
  { value: 'treviso',         label: 'Treviso' },
  { value: 'rovigo',          label: 'Rovigo' },
  { value: 'belluno',         label: 'Belluno' },
  // Lombardia
  { value: 'milano',          label: 'Milano' },
  { value: 'bergamo',         label: 'Bergamo' },
  { value: 'brescia',         label: 'Brescia' },
  { value: 'como',            label: 'Como' },
  { value: 'monza',           label: 'Monza' },
  { value: 'varese',          label: 'Varese' },
  { value: 'lecco',           label: 'Lecco' },
  { value: 'cremona',         label: 'Cremona' },
  { value: 'mantova',         label: 'Mantova' },
  { value: 'pavia',           label: 'Pavia' },
  { value: 'lodi',            label: 'Lodi' },
  { value: 'sondrio',         label: 'Sondrio' },
  // Piemonte
  { value: 'torino',          label: 'Torino' },
  { value: 'alessandria',     label: 'Alessandria' },
  { value: 'asti',            label: 'Asti' },
  { value: 'cuneo',           label: 'Cuneo' },
  { value: 'novara',          label: 'Novara' },
  { value: 'vercelli',        label: 'Vercelli' },
  { value: 'biella',          label: 'Biella' },
  // Emilia-Romagna
  { value: 'bologna',         label: 'Bologna' },
  { value: 'modena',          label: 'Modena' },
  { value: 'parma',           label: 'Parma' },
  { value: 'reggio-emilia',   label: 'Reggio Emilia' },
  { value: 'ferrara',         label: 'Ferrara' },
  { value: 'rimini',          label: 'Rimini' },
  { value: 'ravenna',         label: 'Ravenna' },
  { value: 'forli',           label: 'Forlì' },
  { value: 'piacenza',        label: 'Piacenza' },
  // Toscana
  { value: 'firenze',         label: 'Firenze' },
  { value: 'pisa',            label: 'Pisa' },
  { value: 'siena',           label: 'Siena' },
  { value: 'livorno',         label: 'Livorno' },
  { value: 'arezzo',          label: 'Arezzo' },
  { value: 'prato',           label: 'Prato' },
  { value: 'lucca',           label: 'Lucca' },
  { value: 'grosseto',        label: 'Grosseto' },
  // Lazio
  { value: 'roma',            label: 'Roma' },
  { value: 'latina',          label: 'Latina' },
  { value: 'frosinone',       label: 'Frosinone' },
  { value: 'viterbo',         label: 'Viterbo' },
  { value: 'rieti',           label: 'Rieti' },
  // Campania
  { value: 'napoli',          label: 'Napoli' },
  { value: 'salerno',         label: 'Salerno' },
  { value: 'caserta',         label: 'Caserta' },
  { value: 'avellino',        label: 'Avellino' },
  { value: 'benevento',       label: 'Benevento' },
  // Puglia
  { value: 'bari',            label: 'Bari' },
  { value: 'lecce',           label: 'Lecce' },
  { value: 'taranto',         label: 'Taranto' },
  { value: 'brindisi',        label: 'Brindisi' },
  { value: 'foggia',          label: 'Foggia' },
  // Sicilia
  { value: 'palermo',         label: 'Palermo' },
  { value: 'catania',         label: 'Catania' },
  { value: 'messina',         label: 'Messina' },
  { value: 'siracusa',        label: 'Siracusa' },
  { value: 'trapani',         label: 'Trapani' },
  { value: 'agrigento',       label: 'Agrigento' },
  // Sardegna
  { value: 'cagliari',        label: 'Cagliari' },
  { value: 'sassari',         label: 'Sassari' },
  { value: 'nuoro',           label: 'Nuoro' },
  { value: 'oristano',        label: 'Oristano' },
  // Liguria
  { value: 'genova',          label: 'Genova' },
  { value: 'la-spezia',       label: 'La Spezia' },
  { value: 'savona',          label: 'Savona' },
  { value: 'imperia',         label: 'Imperia' },
  // Trentino-Alto Adige
  { value: 'trento',          label: 'Trento' },
  { value: 'bolzano',         label: 'Bolzano' },
  // Friuli-Venezia Giulia
  { value: 'trieste',         label: 'Trieste' },
  { value: 'udine',           label: 'Udine' },
  { value: 'gorizia',         label: 'Gorizia' },
  { value: 'pordenone',       label: 'Pordenone' },
  // Umbria
  { value: 'perugia',         label: 'Perugia' },
  { value: 'terni',           label: 'Terni' },
  // Marche
  { value: 'ancona',          label: 'Ancona' },
  { value: 'pesaro',          label: 'Pesaro' },
  { value: 'macerata',        label: 'Macerata' },
  { value: 'ascoli-piceno',   label: 'Ascoli Piceno' },
  // Abruzzo
  { value: 'pescara',         label: 'Pescara' },
  { value: 'laquila',         label: "L'Aquila" },
  { value: 'chieti',          label: 'Chieti' },
  { value: 'teramo',          label: 'Teramo' },
  // Calabria
  { value: 'reggio-calabria', label: 'Reggio Calabria' },
  { value: 'catanzaro',       label: 'Catanzaro' },
  { value: 'cosenza',         label: 'Cosenza' },
  // Valle d'Aosta
  { value: 'aosta',           label: "Aosta" },
  // Basilicata
  { value: 'potenza',         label: 'Potenza' },
  { value: 'matera',          label: 'Matera' },
  // Molise
  { value: 'campobasso',      label: 'Campobasso' },
  // Altro
  { value: 'altro', label: 'Altra città' },
];

// ===== REGIONI ITALIANE → CITTÀ (per browse geografico) =====
export const REGIONI_ITALIA: Array<{
  label: string;
  emoji: string;
  center: [number, number]; // [lat, lon] centro regione
  zoom: number;
  bbox: [number, number, number, number]; // [latMin, lonMin, latMax, lonMax]
}> = [
  { label: 'Veneto',          emoji: '🦁',  center: [45.67, 11.93], zoom: 8,  bbox: [44.79, 10.63, 46.68, 13.09] },
  { label: 'Lombardia',       emoji: '🏙️', center: [45.47,  9.19], zoom: 8,  bbox: [44.68,  8.50, 46.63, 11.35] },
  { label: 'Piemonte',        emoji: '🏔️', center: [44.90,  7.86], zoom: 8,  bbox: [43.80,  6.62, 46.47,  9.22] },
  { label: 'Emilia-Romagna',  emoji: '🏎️', center: [44.50, 11.34], zoom: 8,  bbox: [43.75,  9.19, 45.14, 12.77] },
  { label: 'Toscana',         emoji: '🌻',  center: [43.46, 11.15], zoom: 8,  bbox: [42.37,  9.68, 44.47, 12.37] },
  { label: 'Lazio',           emoji: '🏛️', center: [41.90, 12.65], zoom: 8,  bbox: [40.78, 11.44, 42.84, 14.03] },
  { label: 'Campania',        emoji: '🌋',  center: [40.90, 14.77], zoom: 8,  bbox: [39.97, 13.73, 41.50, 16.07] },
  { label: 'Puglia',          emoji: '☀️',  center: [40.93, 16.55], zoom: 8,  bbox: [39.78, 14.95, 41.90, 18.52] },
  { label: 'Sicilia',         emoji: '🌊',  center: [37.60, 14.01], zoom: 8,  bbox: [35.48, 11.92, 38.32, 15.67] },
  { label: 'Sardegna',        emoji: '🏝️', center: [39.90,  9.01], zoom: 8,  bbox: [38.85,  8.13, 41.31,  9.82] },
  { label: 'Liguria',         emoji: '⚓',  center: [44.33,  8.80], zoom: 9,  bbox: [43.77,  7.49, 44.67, 10.07] },
  { label: 'Trentino-A.A.',   emoji: '⛷️', center: [46.50, 11.10], zoom: 9,  bbox: [45.67, 10.38, 47.09, 12.48] },
  { label: 'Friuli-V.G.',     emoji: '🦅',  center: [46.07, 13.23], zoom: 9,  bbox: [45.58, 12.33, 46.66, 13.91] },
  { label: 'Umbria',          emoji: '🌿',  center: [42.95, 12.70], zoom: 9,  bbox: [42.36, 11.88, 43.62, 13.26] },
  { label: 'Marche',          emoji: '🌾',  center: [43.35, 13.40], zoom: 9,  bbox: [42.67, 12.18, 43.99, 13.93] },
  { label: 'Abruzzo',         emoji: '🦌',  center: [42.15, 13.73], zoom: 9,  bbox: [41.73, 13.03, 42.90, 14.78] },
  { label: 'Calabria',        emoji: '🌶️', center: [38.90, 16.60], zoom: 9,  bbox: [37.92, 15.62, 40.15, 16.60] },
  { label: "Valle d'Aosta",   emoji: '🏔️', center: [45.74,  7.43], zoom: 10, bbox: [45.46,  6.80, 45.98,  7.95] },
  { label: 'Basilicata',      emoji: '🪨',  center: [40.50, 15.99], zoom: 9,  bbox: [39.98, 15.33, 41.15, 16.89] },
  { label: 'Molise',          emoji: '🌄',  center: [41.56, 14.66], zoom: 9,  bbox: [41.34, 13.92, 41.93, 15.16] },
];

// ===== PALETTE (costanti JS) =====
export const PALETTE = {
  orange:  '#ff6a00',
  black:   '#0a0a0a',
  bone:    '#f3ead8',
  coffee:  '#ffce4d',
  gray800: '#1a1a1a',
  gray700: '#2a2a2a',
  gray600: '#3a3a3a',
  gray400: '#888888',
} as const;

// ===== COORDINATE CITTÀ (per fly-to sulla mappa) =====
export const CITTA_COORDS: Record<string, [number, number]> = {
  // Veneto
  verona:           [45.4384, 10.9916],
  venezia:          [45.4408, 12.3155],
  padova:           [45.4064, 11.8768],
  vicenza:          [45.5455, 11.5354],
  treviso:          [45.6669, 12.2430],
  rovigo:           [45.0701, 11.7900],
  belluno:          [46.1393, 12.2168],
  // Lombardia
  milano:           [45.4654, 9.1859],
  bergamo:          [45.6983, 9.6773],
  brescia:          [45.5416, 10.2118],
  como:             [45.8080, 9.0851],
  monza:            [45.5845, 9.2744],
  varese:           [45.8206, 8.8257],
  lecco:            [45.8566, 9.3902],
  cremona:          [45.1333, 10.0233],
  mantova:          [45.1564, 10.7915],
  pavia:            [45.1847, 9.1582],
  lodi:             [45.3139, 9.5022],
  sondrio:          [46.1698, 9.8720],
  // Piemonte
  torino:           [45.0703, 7.6869],
  alessandria:      [44.9121, 8.6148],
  asti:             [44.9000, 8.2066],
  cuneo:            [44.3840, 7.5422],
  novara:           [45.4469, 8.6197],
  vercelli:         [45.3191, 8.4245],
  biella:           [45.5627, 8.0532],
  // Emilia-Romagna
  bologna:          [44.4938, 11.3426],
  modena:           [44.6471, 10.9252],
  parma:            [44.8015, 10.3279],
  'reggio-emilia':  [44.6989, 10.6290],
  ferrara:          [44.8353, 11.6197],
  rimini:           [44.0593, 12.5683],
  ravenna:          [44.4184, 12.2035],
  forli:            [44.2227, 12.0407],
  piacenza:         [45.0522, 9.6930],
  // Toscana
  firenze:          [43.7696, 11.2558],
  pisa:             [43.7228, 10.4017],
  siena:            [43.3186, 11.3307],
  livorno:          [43.5485, 10.3106],
  arezzo:           [43.4638, 11.8796],
  prato:            [43.8802, 11.0968],
  lucca:            [43.8430, 10.5074],
  grosseto:         [42.7601, 11.1103],
  // Lazio
  roma:             [41.9028, 12.4964],
  latina:           [41.4677, 12.9036],
  frosinone:        [41.6400, 13.3400],
  viterbo:          [42.4207, 12.1049],
  rieti:            [42.4033, 12.8617],
  // Campania
  napoli:           [40.8518, 14.2681],
  salerno:          [40.6806, 14.7589],
  caserta:          [41.0726, 14.3325],
  avellino:         [40.9147, 14.7907],
  benevento:        [41.1308, 14.7836],
  // Puglia
  bari:             [41.1171, 16.8719],
  lecce:            [40.3519, 18.1748],
  taranto:          [40.4763, 17.2297],
  brindisi:         [40.6322, 17.9406],
  foggia:           [41.4622, 15.5446],
  // Sicilia
  palermo:          [38.1157, 13.3615],
  catania:          [37.5079, 15.0830],
  messina:          [38.1938, 15.5540],
  siracusa:         [37.0755, 15.2866],
  trapani:          [38.0179, 12.5113],
  agrigento:        [37.3112, 13.5765],
  // Sardegna
  cagliari:         [39.2238, 9.1217],
  sassari:          [40.7268, 8.5596],
  nuoro:            [40.3208, 9.3286],
  oristano:         [39.9056, 8.5886],
  // Liguria
  genova:           [44.4056, 8.9463],
  'la-spezia':      [44.1024, 9.8241],
  savona:           [44.3069, 8.4815],
  imperia:          [43.8897, 8.0340],
  // Trentino
  trento:           [46.0748, 11.1217],
  bolzano:          [46.4983, 11.3548],
  // Friuli
  trieste:          [45.6495, 13.7768],
  udine:            [46.0611, 13.2344],
  gorizia:          [45.9427, 13.6226],
  pordenone:        [45.9577, 12.6611],
  // Umbria
  perugia:          [43.1107, 12.3908],
  terni:            [42.5636, 12.6421],
  // Marche
  ancona:           [43.6158, 13.5189],
  pesaro:           [43.9098, 12.9130],
  macerata:         [43.2997, 13.4530],
  'ascoli-piceno':  [42.8535, 13.5749],
  // Abruzzo
  pescara:          [42.4618, 14.2147],
  laquila:          [42.3498, 13.3995],
  chieti:           [42.3514, 14.1678],
  teramo:           [42.6586, 13.7044],
  // Calabria
  'reggio-calabria':[38.1113, 15.6474],
  catanzaro:        [38.9100, 16.5870],
  cosenza:          [39.2988, 16.2522],
  // Valle d'Aosta
  aosta:            [45.7370, 7.3206],
  // Basilicata
  potenza:          [40.6402, 15.8057],
  matera:           [40.6660, 16.6043],
  // Molise
  campobasso:       [41.5626, 14.6613],
};

// ===== LINK ESTERNI =====
export const LINKS = {
  kofi:       'https://ko-fi.com/chrispy_bmx',
  instagram:  'https://www.instagram.com/chrispy_bmx',
  youtube:    'https://www.youtube.com/@chrispy_bmx',
  sito:       'https://chrispybmx.com',
  mailContact: 'mailto:christian.ceresato@gmail.com',
} as const;

// ===== CONFIG =====
export const APP_CONFIG = {
  siteName:    'Chrispy Maps',
  tagline:     'Mappa Spot BMX, Skate & Scooter Italia',
  description: 'La mappa community-driven per trovare spot BMX, skatepark, spot scooter e street spot in tutta Italia. Oltre 100 città, aggiornata dalla community.',
  url:         'https://maps.chrispybmx.com',
  mapUrl:      'https://maps.chrispybmx.com', // home = mappa, /map reindirizza qui
  mapCenter:   [42.5, 12.5] as [number, number], // Centro Italia
  mapZoom:     6,
  mapZoomCity: 13,
  maxPhotos:   5,
  adminEmail:  'christian.ceresato@gmail.com',
} as const;

// Token per approvazione (HMAC key viene da env)
export const APPROVE_TOKEN_EXPIRES_HOURS = 72;
