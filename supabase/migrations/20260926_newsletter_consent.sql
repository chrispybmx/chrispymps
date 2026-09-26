BEGIN;
-- Private source of truth and durable synchronization work. No public policies.
CREATE TABLE public.cm_newsletter_preferences (
  email text PRIMARY KEY CHECK (email = lower(trim(email)) AND length(email) <= 254),
  enabled boolean NOT NULL DEFAULT false,
  revision uuid NOT NULL DEFAULT gen_random_uuid(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  sync_pending boolean NOT NULL DEFAULT true,
  locked_until timestamptz,
  lease uuid,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0,
  last_error text CHECK (last_error IN ('provider_unavailable','provider_suppressed'))
);
CREATE TABLE public.cm_newsletter_consent_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email text NOT NULL REFERENCES public.cm_newsletter_preferences(email) ON DELETE CASCADE,
  enabled boolean NOT NULL,
  version text NOT NULL,
  consent_text text NOT NULL,
  source text NOT NULL CHECK (source IN ('profile','signup','confirmation','provider','account_delete')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cm_newsletter_consent_email_idx ON public.cm_newsletter_consent_events(email,created_at);
CREATE TABLE public.cm_newsletter_confirmations (
  email text PRIMARY KEY,
  token_hash text NOT NULL UNIQUE CHECK (length(token_hash)=64),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  version text NOT NULL,
  consent_text text NOT NULL,
  CHECK (email = lower(trim(email)) AND length(email)<=254)
);
ALTER TABLE public.cm_newsletter_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_newsletter_consent_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_newsletter_confirmations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cm_newsletter_preferences,public.cm_newsletter_consent_events,public.cm_newsletter_confirmations FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.cm_newsletter_preferences,public.cm_newsletter_consent_events,public.cm_newsletter_confirmations TO service_role;
GRANT USAGE,SELECT ON SEQUENCE public.cm_newsletter_consent_events_id_seq TO service_role;

CREATE FUNCTION public.cm_newsletter_choose(p_email text,p_enabled boolean,p_version text,p_text text,p_source text)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE result uuid;
BEGIN
  IF length(p_version)>60 OR length(p_text)>1000 THEN RAISE EXCEPTION 'Invalid consent'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_email, 741));
  INSERT INTO public.cm_newsletter_preferences(email,enabled) VALUES(p_email,p_enabled)
  ON CONFLICT(email) DO UPDATE SET enabled=p_enabled,revision=gen_random_uuid(),updated_at=now(),
    sync_pending=true,next_attempt_at=now(),attempts=0,last_error=null
  RETURNING revision INTO result;
  INSERT INTO public.cm_newsletter_consent_events(email,enabled,version,consent_text,source)
  VALUES(p_email,p_enabled,p_version,p_text,p_source);
  -- A previous confirmation link must never undo a later withdrawal.
  DELETE FROM public.cm_newsletter_confirmations WHERE email=p_email;
  RETURN result;
END;
$$;
CREATE FUNCTION public.cm_newsletter_request(p_email text,p_hash text,p_version text,p_text text)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_email,741));
  IF EXISTS(SELECT 1 FROM public.cm_newsletter_confirmations WHERE email=p_email AND created_at>now()-interval '10 minutes') THEN RETURN false; END IF;
  INSERT INTO public.cm_newsletter_confirmations(email,token_hash,version,consent_text)
  VALUES(p_email,p_hash,p_version,p_text)
  ON CONFLICT(email) DO UPDATE SET token_hash=p_hash,version=p_version,consent_text=p_text,created_at=now(),expires_at=now()+interval '24 hours';
  RETURN true;
END;
$$;
CREATE FUNCTION public.cm_newsletter_confirm(p_hash text) RETURNS text
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE request public.cm_newsletter_confirmations; address text;
BEGIN
  SELECT email INTO address FROM public.cm_newsletter_confirmations WHERE token_hash=p_hash;
  IF address IS NULL THEN RETURN null; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(address,741));
  SELECT * INTO request FROM public.cm_newsletter_confirmations WHERE token_hash=p_hash AND expires_at>now() FOR UPDATE;
  IF NOT FOUND THEN RETURN null; END IF;
  PERFORM public.cm_newsletter_choose(request.email,true,request.version,request.consent_text,'confirmation');
  RETURN request.email;
END;
$$;
CREATE FUNCTION public.cm_newsletter_claim(p_email text,p_lease uuid)
RETURNS SETOF public.cm_newsletter_preferences LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  UPDATE public.cm_newsletter_preferences SET lease=p_lease,locked_until=now()+interval '60 seconds',attempts=attempts+1
  WHERE email=p_email AND sync_pending AND next_attempt_at<=now() AND (locked_until IS NULL OR locked_until<now())
  RETURNING *;
$$;
CREATE FUNCTION public.cm_newsletter_finish(p_email text,p_revision uuid,p_lease uuid,p_error text)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  UPDATE public.cm_newsletter_preferences SET lease=null,locked_until=null,
    sync_pending=CASE WHEN revision=p_revision AND p_error IS NULL THEN false ELSE true END,
    last_error=CASE WHEN revision=p_revision THEN p_error ELSE null END,
    next_attempt_at=CASE WHEN revision<>p_revision OR p_error IS NULL THEN now() ELSE now()+interval '5 minutes' END
  WHERE email=p_email AND lease=p_lease;
$$;
CREATE FUNCTION public.cm_newsletter_purge() RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  DELETE FROM public.cm_newsletter_confirmations WHERE expires_at<now();
  DELETE FROM public.cm_newsletter_preferences WHERE NOT enabled AND NOT sync_pending AND updated_at<now()-interval '24 months';
$$;
REVOKE ALL ON FUNCTION public.cm_newsletter_choose(text,boolean,text,text,text),public.cm_newsletter_request(text,text,text,text),public.cm_newsletter_confirm(text),public.cm_newsletter_claim(text,uuid),public.cm_newsletter_finish(text,uuid,uuid,text),public.cm_newsletter_purge() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cm_newsletter_choose(text,boolean,text,text,text),public.cm_newsletter_request(text,text,text,text),public.cm_newsletter_confirm(text),public.cm_newsletter_claim(text,uuid),public.cm_newsletter_finish(text,uuid,uuid,text),public.cm_newsletter_purge() TO service_role;
-- Only accept provider withdrawals newer than the last local choice; duplicate
-- delivery and events for other Chrispy services must not create new profiles.
CREATE FUNCTION public.cm_newsletter_provider_withdraw(p_email text,p_at timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_email,741));
  IF EXISTS(SELECT 1 FROM public.cm_newsletter_preferences WHERE email=p_email AND enabled AND date_trunc('second',updated_at)<=p_at) THEN
    PERFORM public.cm_newsletter_choose(p_email,false,'mailerlite-webhook-v1','Disiscrizione comunicata da MailerLite.','provider');
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.cm_newsletter_provider_withdraw(text,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cm_newsletter_provider_withdraw(text,timestamptz) TO service_role;
COMMIT;
