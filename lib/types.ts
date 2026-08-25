// ChrispyMPS — Tipi TypeScript

/** DOVE sei. Un solo valore per spot.
 *
 *  `rail`, `ledge`, `gap`, `bowl` e `transition` restano qui dentro perche' 39
 *  spot su 118 li hanno ancora come `type`: sono ostacoli finiti nel campo
 *  sbagliato quando il campo era uno solo. Toglierli adesso farebbe restituire
 *  `undefined` a TIPI_SPOT[spot.type] e la mappa andrebbe in crash.
 *  Spariranno quando quei 39 avranno un contesto assegnato. */
export type SpotType =
  | 'street' | 'transition' | 'park' | 'diy' | 'rail' | 'ledge'
  | 'trail'  | 'plaza' | 'gap' | 'bowl' | 'pumptrack';

/** COSA c'e'. Quanti se ne vuole per spot.
 *
 *  Un ostacolo non dice dove sei: un bank puo' stare contro un muro in centro
 *  (street) o dentro uno skatepark. Per questo e' un campo separato da
 *  SpotType, e per questo `transition` non e' piu' una categoria: e' `bank` e
 *  `quarter`, che e' come li chiamano i rider. */
export type Ostacolo =
  | 'rail' | 'ledge' | 'hubba' | 'stairs' | 'gap' | 'drop'
  | 'bank' | 'quarter' | 'spine' | 'box' | 'kicker'
  | 'manual_pad' | 'wallride' | 'pole_jam' | 'curb'
  | 'bowl' | 'dirt_jump' | 'flat';

export type SpotStatus    = 'pending' | 'approved' | 'rejected' | 'archived';
export type SpotCondition = 'alive' | 'bustato' | 'demolito';

export interface Contributor {
  id:                   string;
  email:                string;
  name:                 string;
  device_id?:           string;
  instagram_handle?:    string;
  first_submission_at:  string;
  total_submissions:    number;
  approved_submissions: number;
}

export interface SpotPhoto {
  id:          string;
  spot_id:     string;
  url:         string;
  position:    number;
  uploaded_by?: string;
  credit_name?: string;
  /** 'rider' = scatto sul posto, 'streetview' = fermo immagine da mappa.
      Popolata da 20260819_spot_photos_source.sql; assente finché non è applicata. */
  source?:     'rider' | 'streetview';
  created_at:  string;
}

export interface Spot {
  id:                   string;
  slug:                 string;
  name:                 string;
  type:                 SpotType;
  lat:                  number;
  lon:                  number;
  city?:                string;
  region?:              string;
  country?:             string;
  country_code?:        string; // ISO 3166-1 alpha-2 (IT, FR, US, ...)
  description?:         string;
  condition:            SpotCondition;
  condition_updated_at: string;
  status:               SpotStatus;
  youtube_url?:         string;
  /** Cosa c'e' sullo spot — vedi il tipo Ostacolo. */
  ostacoli?:            Ostacolo[];
  surface?:             string;
  wax_needed:           boolean;
  guardians?:           string;
  difficulty?:          string;
  submitted_by?:          string;
  submitted_by_user_id?:  string;
  submitted_by_username?: string;
  reviewer_notes?:        string;
  created_at:           string;
  approved_at?:         string;
  updated_at:           string;
  likes_count?:         number;
  // join
  spot_photos?:         SpotPhoto[];
}

// Per la mappa (solo campi necessari per i pin)
export interface SpotMapPin {
  id:        string;
  slug:      string;
  name:      string;
  type:      SpotType;
  lat:       number;
  lon:       number;
  city?:     string;
  condition: SpotCondition;
  /** Ultima conferma dello stato — alimenta lib/freshness.ts sulle card. */
  condition_updated_at?: string;
  /** Cosa c'e' sullo spot. Vuoto sugli spot vecchi: si riempie col tempo. */
  ostacoli?:    Ostacolo[];
  cover_url?:   string;    // prima foto
  photo_urls?:  string[];  // tutte le foto ordinate
  /** Origine della copertina. Una foto presa da Street View non documenta lo
      spot: dirlo anche sulle card evita che passi per uno scatto vero. */
  cover_source?: 'rider' | 'streetview';
  /** Origine di ogni foto, allineata per indice a `photo_urls`. Serve alla card
      espansa, che sfoglia: il bollino deve seguire la foto che stai guardando. */
  photo_sources?: (string | null)[];
  description?: string;
  difficulty?:  string;
  submitted_by_username?: string;
  likes_count?: number;
}

// Dati del form "Aggiungi Spot"
export interface SubmitSpotPayload {
  name:             string;
  type:             SpotType;
  lat:              number;
  lon:              number;
  city?:            string;
  description?:     string;
  surface?:         string;
  wax_needed?:      boolean;
  guardians?:       string;
  difficulty?:      string;
  contributor_name: string;
  contributor_email: string;
  instagram_handle?: string;
  subscribe_newsletter: boolean;
}

export interface SpotStatusUpdate {
  id:          string;
  spot_id:     string;
  condition:   SpotCondition;
  photo_url?:  string;
  note?:       string;
  reported_by?: string;
  created_at:  string;
}

export interface Flag {
  id:             string;
  spot_id:        string;
  reason:         string;
  details?:       string;
  reporter_email?: string;
  resolved:       boolean;
  created_at:     string;
}

// Risposta API standard
export interface ApiResponse<T = null> {
  ok:      boolean;
  data?:   T;
  error?:  string;
}
