-- Registro dei fallimenti di accesso social.
--
-- Perché: il login con Google fallisce con `server_error`, ma il motivo
-- letterale vive solo in `error_description`, che arriva al browser dell'utente
-- e poi sparisce. Chiedere all'utente di leggere e riferire un messaggio è
-- una staffetta che perde pezzi. Qui il callback scrive il motivo esatto in
-- una riga, e la si legge in SQL.
--
-- Resta utile anche dopo: un fallimento di login che non lascia traccia è un
-- fallimento che non saprai mai di avere. Solo il service role può leggerla,
-- perché contiene diagnostica di autenticazione.

CREATE TABLE IF NOT EXISTS auth_failure_log (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  provider     text,                 -- 'google', ...
  error_code   text,                 -- es. server_error
  error_detail text,                 -- error_description: il motivo vero
  stage        text,                 -- 'provider_redirect' | 'code_exchange'
  user_agent   text
);

CREATE INDEX IF NOT EXISTS idx_auth_failure_log_created
  ON auth_failure_log(created_at DESC);

ALTER TABLE auth_failure_log ENABLE ROW LEVEL SECURITY;

-- Nessuna policy: con RLS attiva e zero policy, anon e authenticated non
-- vedono né scrivono nulla. Il service role bypassa RLS, ed è l'unico che
-- deve toccarla (ci scrive il callback, la leggiamo noi da SQL Editor).

COMMENT ON TABLE auth_failure_log IS
  'Diagnostica dei fallimenti OAuth. Solo service role. Ripulibile quando serve.';
