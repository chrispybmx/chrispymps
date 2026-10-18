-- Verifica posizione foto: solo per la coda admin.
-- Tabella separata perche' `spots` e' leggibile da tutti. RLS attiva e nessuna
-- policy: anon e authenticated non leggono ne' scrivono; solo il service role
-- (API submit-spot e pagina admin) la usa.
-- Nessuna coordinata della foto viene salvata: solo distanza dal pin, data
-- dello scatto e se il file aveva dati fotocamera.
BEGIN;

CREATE TABLE IF NOT EXISTS public.spot_photo_checks (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  spot_id     uuid NOT NULL REFERENCES public.spots(id) ON DELETE CASCADE,
  position    smallint NOT NULL CHECK (position BETWEEN 0 AND 4),
  has_gps     boolean NOT NULL,
  distance_m  integer CHECK (distance_m IS NULL OR distance_m >= 0),
  taken_at    timestamptz,
  has_camera  boolean NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS spot_photo_checks_spot_id_idx ON public.spot_photo_checks (spot_id);

ALTER TABLE public.spot_photo_checks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.spot_photo_checks FROM PUBLIC, anon, authenticated;

COMMIT;
