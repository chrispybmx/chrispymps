-- Aggregate usage only. Apply after staging verification; no user/event-level records.
BEGIN;
CREATE TABLE public.cm_product_metrics_daily (
  day date NOT NULL,
  event text NOT NULL,
  source text NOT NULL,
  total bigint NOT NULL CHECK (total > 0),
  PRIMARY KEY (day, event, source),
  CHECK ((event = 'search_used' AND source IN ('map','discover'))
    OR (event = 'spot_view' AND source = 'detail')
    OR (event = 'directions_open' AND source IN ('map','detail'))
    OR (event IN ('contribution_open','contribution_sent') AND source = 'add'))
);
ALTER TABLE public.cm_product_metrics_daily ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cm_product_metrics_daily FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cm_product_metrics_daily TO service_role;

CREATE FUNCTION public.cm_purge_product_metrics() RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  DELETE FROM public.cm_product_metrics_daily
  WHERE day < (now() AT TIME ZONE 'UTC')::date - 89;
$$;
CREATE FUNCTION public.cm_increment_product_metric(p_event text, p_source text) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  -- Opportunistic cleanup; schedule the purge RPC daily even without traffic.
  PERFORM public.cm_purge_product_metrics();
  INSERT INTO public.cm_product_metrics_daily (day,event,source,total)
  VALUES ((now() AT TIME ZONE 'UTC')::date,p_event,p_source,1)
  ON CONFLICT (day,event,source) DO UPDATE SET total = public.cm_product_metrics_daily.total + 1;
END;
$$;
REVOKE ALL ON FUNCTION public.cm_increment_product_metric(text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cm_purge_product_metrics() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cm_increment_product_metric(text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.cm_purge_product_metrics() TO service_role;
COMMIT;
