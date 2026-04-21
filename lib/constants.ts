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
  bowl:   { label: 'Bowl',    emoji: '🥣', color: '#34d399' },
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
  { value: 'verona',   label: 'Verona' },
  { value: 'milano',   label: 'Milano' },
  { value: 'roma',     label: 'Roma' },
  { value: 'torino',   label: 'Torino' },
  { value: 'bologna',  label: 'Bologna' },
  { value: 'firenze',  label: 'Firenze' },
  { value: 'napoli',   label: 'Napoli' },
  { value: 'venezia',  label: 'Venezia' },
  { value: 'padova',   label: 'Padova' },
  { value: 'brescia',  label: 'Brescia' },
  { value: 'bergamo',  label: 'Bergamo' },
  { value: 'trento',   label: 'Trento' },
  { value: 'vicenza',  label: 'Vicenza' },
  { value: 'modena',   label: 'Modena' },
  { value: 'parma',    label: 'Parma' },
  { value: 'genova',   label: 'Genova' },
  { value: 'bari',     label: 'Bari' },
  { value: 'palermo',  label: 'Palermo' },
  { value: 'catania',  label: 'Catania' },
  { value: 'cagliari', label: 'Cagliari' },
  { value: 'trieste',  label: 'Trieste' },
  { value: 'perugia',  label: 'Perugia' },
  { value: 'ancona',   label: 'Ancona' },
  { value: 'pescara',  label: 'Pescara' },
  { value: 'reggio-calabria', label: 'Reggio Calabria' },
  { value: 'altro',    label: 'Altra città' },
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
  verona:           [45.4384, 10.9916],
  milano:           [45.4654, 9.1859],
  roma:             [41.9028, 12.4964],
  torino:           [45.0703, 7.6869],
  bologna:          [44.4938, 11.3426],
  firenze:          [43.7696, 11.2558],
  napoli:           [40.8518, 14.2681],
  venezia:          [45.4408, 12.3155],
  padova:           [45.4064, 11.8768],
  brescia:          [45.5416, 10.2118],
  bergamo:          [45.6983, 9.6773],
  trento:           [46.0748, 11.1217],
  vicenza:          [45.5455, 11.5354],
  modena:           [44.6471, 10.9252],
  parma:            [44.8015, 10.3279],
  genova:           [44.4056, 8.9463],
  bari:             [41.1171, 16.8719],
  palermo:          [38.1157, 13.3615],
  catania:          [37.5079, 15.0830],
  cagliari:         [39.2238, 9.1217],
  trieste:          [45.6495, 13.7768],
  perugia:          [43.1107, 12.3908],
  ancona:           [43.6158, 13.5189],
  pescara:          [42.4618, 14.2147],
  'reggio-calabria':[38.1113, 15.6474],
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
  tagline:     'Find Your Spot',
  description: 'La mappa BMX street italiana, community-driven.',
  url:         'https://chrispybmx.com',
  mapUrl:      'https://chrispybmx.com/map',
  mapCenter:   [42.5, 12.5] as [number, number], // Centro Italia
  mapZoom:     6,
  mapZoomCity: 13,
  maxPhotos:   5,
  adminEmail:  'christian.ceresato@gmail.com',
} as const;

// Token per approvazione (HMAC key viene da env)
export const APPROVE_TOKEN_EXPIRES_HOURS = 72;
