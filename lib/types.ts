// ChrispyMPS — Tipi TypeScript

export type SpotType =
  | 'street' | 'park' | 'diy' | 'rail' | 'ledge'
  | 'trail'  | 'plaza' | 'gap' | 'bowl' | 'pumptrack';

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
  description?:         string;
  condition:            SpotCondition;
  condition_updated_at: string;
  status:               SpotStatus;
  youtube_url?:         string;
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
  cover_url?:   string;    // prima foto
  photo_urls?:  string[];  // tutte le foto ordinate
  description?: string;
  difficulty?:  string;
  submitted_by_username?: string;
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
