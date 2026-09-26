'use client';

import { trackMetric } from '@/lib/product-metrics';
import { useState, useMemo, useEffect, useRef, useTransition, type FormEvent } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Ostacolo, SpotCondition, SpotType } from '@/lib/types';
import { TIPI_SPOT, REGIONI_ITALIA, DIFFICOLTA, OSTACOLI } from '@/lib/constants';
import MapIcon from '@/components/MapIcon';
import BottomNav from '@/components/BottomNav';
import LanguageSwitch from '@/components/LanguageSwitch';
import { useLanguage } from '@/components/LanguageProvider';
import { useFavorites } from '@/hooks/useFavorites';
import { useUser } from '@/hooks/useUser';
import { miniatura } from '@/lib/immagini';
import { countryLabel, discoverCountries, discoverSearchParams, DISCOVER_PAGE_SIZE, EMPTY_DISCOVER_FILTERS, filterDiscoverSpots, parseDiscoverFilters, type DiscoverFilters, type DiscoverSpot } from './discover';
import styles from './scopri.module.css';

const AuthModal = dynamic(() => import('@/components/AuthModal'), { ssr: false });
interface Props { spots: DiscoverSpot[]; loadError?: boolean }
interface RiderResult { username: string; spotCount: number }
interface LikeState { count: number; hasLiked: boolean }
const obstacleEnglish: Partial<Record<Ostacolo, string>> = { stairs: 'Stairs', curb: 'Curb' };

function SpotCover({ spot, index, missing, streetview }: { spot: DiscoverSpot; index: number; missing: string; streetview: string }) {
  const [failed, setFailed] = useState(false);
  const [original, setOriginal] = useState(false);
  const url = spot.cover_url;
  useEffect(() => { setFailed(false); setOriginal(false); }, [url]);
  return <div className={styles.photo}>{url && !failed ? <img src={original ? url : miniatura(url, 640)} srcSet={original ? undefined : `${miniatura(url, 400)} 400w, ${miniatura(url, 640)} 640w`} sizes="(min-width:1440px) 300px, (min-width:960px) 32vw, (min-width:600px) 48vw, 100vw" alt={spot.name} loading={index < 3 ? 'eager' : 'lazy'} decoding="async" onError={() => { if (!original && miniatura(url, 640) !== url) setOriginal(true); else setFailed(true); }} /> : <div className={styles.noPhoto}><MapIcon name={spot.type} size={32} /><span>{missing}</span></div>}{spot.cover_source === 'streetview' && url && !failed && <span className={styles.source}>{streetview}</span>}</div>;
}

export default function ScopriClient({ spots, loadError = false }: Props) {
  const { language, locale, text } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramsString = searchParams.toString();
  const [filters, setFilters] = useState<DiscoverFilters>(() => parseDiscoverFilters(searchParams));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(DISCOVER_PAGE_SIZE);
  const [authOpen, setAuthOpen] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const [userResults, setUserResults] = useState<RiderResult[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState(false);
  const [userRetry, setUserRetry] = useState(0);
  const [likes, setLikes] = useState<Record<string, LikeState>>({});
  const [likeBusy, setLikeBusy] = useState<Set<string>>(new Set());
  const [likeError, setLikeError] = useState('');
  const scroller = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const titleRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const busyLikes = useRef(new Set<string>());
  const likeVersions = useRef(new Map<string, number>());
  const latestLikes = useRef(likes);
  latestLikes.current = likes;
  const activeUser = useRef<string | undefined>();
  const user = useUser();
  const userId = user?.id;
  activeUser.current = userId;
  const favorites = useFavorites();

  useEffect(() => {
    const parsed = parseDiscoverFilters(new URLSearchParams(paramsString));
    setFilters(previous => JSON.stringify(previous) === JSON.stringify(parsed) ? previous : parsed);
  }, [paramsString]);

  useEffect(() => {
    setVisibleCount(DISCOVER_PAGE_SIZE);
    if (scroller.current) scroller.current.scrollTop = 0;
    const timer = window.setTimeout(() => {
      const current = new URLSearchParams(window.location.search);
      for (const key of ['q', 'type', 'difficulty', 'country', 'region', 'obstacle', 'condition', 'sort']) current.delete(key);
      new URLSearchParams(discoverSearchParams(filters)).forEach((value, key) => current.set(key, value));
      const next = `${window.location.pathname}${current.size ? `?${current.toString()}` : ''}`;
      if (`${window.location.pathname}${window.location.search}` !== next) window.history.replaceState(window.history.state, '', next);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [filters]);

  useEffect(() => { setLikes({}); setLikeError(''); }, [userId]);
  useEffect(() => {
    setUserResults([]); setUsersError(false);
    const query = filters.query.trim().replace(/^@/, '');
    if (query.length < 2) { setUsersLoading(false); return; }
    const controller = new AbortController();
    setUsersLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/users?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error();
        if (!controller.signal.aborted) setUserResults(result.data ?? []);
      } catch { if (!controller.signal.aborted) setUsersError(true); }
      finally { if (!controller.signal.aborted) setUsersLoading(false); }
    }, 300);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [filters.query, userRetry]);

  const filtered = useMemo(() => filterDiscoverSpots(spots, filters), [spots, filters]);
  const visible = filtered.slice(0, visibleCount);
  const countries = useMemo(() => discoverCountries(spots, language), [spots, language]);
  const advancedCount = [filters.difficulty, filters.country, filters.region, filters.obstacle, filters.condition].filter(Boolean).length;
  const anyFilter = !!(filters.query || filters.type || advancedCount);
  const canFilterRegion = !filters.country || ['code:IT', 'name:italia', 'name:italy'].includes(filters.country);
  const typeLabel = (type: SpotType) => TIPI_SPOT[type]?.label ?? type;
  const obstacleLabel = (value: Ostacolo) => language === 'en' ? obstacleEnglish[value] ?? OSTACOLI[value].label : OSTACOLI[value].label;
  const conditionLabel = (value: SpotCondition) => value === 'alive' ? text('Utilizzabile', 'Rideable') : value === 'bustato' ? text('Bustato', 'Access issues') : text('Demolito', 'Demolished');

  // Load one bounded batch for the displayed page, with a single authentication check.
  const visibleIds = visible.map(spot => spot.id).join(',');
  useEffect(() => {
    if (!user || !visibleIds) return;
    const missing = visibleIds.split(',').filter(id => !latestLikes.current[id]).slice(0, DISCOVER_PAGE_SIZE);
    if (!missing.length) return;
    const controller = new AbortController();
    const actor = user.id;
    const versions = new Map(missing.map(id => [id, likeVersions.current.get(id) ?? 0]));
    fetch(`/api/spot-likes?spot_ids=${encodeURIComponent(missing.join(','))}`, { headers: { Authorization: `Bearer ${user.accessToken}` }, cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const result = await response.json();
        if (!response.ok || !result.ok || !Array.isArray(result.data)) return;
        if (!controller.signal.aborted && activeUser.current === actor) setLikes(previous => {
          const next = { ...previous };
          for (const row of result.data as { spot_id: string; count: number; hasLiked: boolean }[]) if (!busyLikes.current.has(row.spot_id) && versions.get(row.spot_id) === (likeVersions.current.get(row.spot_id) ?? 0)) next[row.spot_id] = { count: row.count, hasLiked: row.hasLiked };
          return next;
        });
      }).catch(() => {});
    return () => controller.abort();
  }, [user, visibleIds]); // state from this response must not trigger a second request

  function change<K extends keyof DiscoverFilters>(key: K, value: DiscoverFilters[K]) { setFilters(previous => ({ ...previous, [key]: value, ...(key === 'country' ? { region: '' } : {}) })); }
  function search(event: FormEvent) { event.preventDefault(); if (filters.query.trim()) trackMetric('search_used', 'discover'); input.current?.blur(); heading.current?.focus({ preventScroll: true }); }
  function reset() { setFilters({ ...EMPTY_DISCOVER_FILTERS }); input.current?.focus(); }
  function loadMore() {
    const first = filtered[visibleCount]?.id;
    setVisibleCount(count => count + DISCOVER_PAGE_SIZE);
    requestAnimationFrame(() => { if (first) { titleRefs.current[first]?.focus({ preventScroll: true }); titleRefs.current[first]?.scrollIntoView({ block: 'nearest' }); } });
  }
  async function likeSpot(id: string) {
    if (!user) { setAuthOpen(true); return; }
    if (busyLikes.current.has(id)) return;
    const actor = user.id;
    likeVersions.current.set(id, (likeVersions.current.get(id) ?? 0) + 1);
    busyLikes.current.add(id); setLikeBusy(new Set(busyLikes.current)); setLikeError('');
    try {
      const response = await fetch('/api/spot-likes', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.accessToken}` }, body: JSON.stringify({ spot_id: id }) });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(response.status === 401 ? 'auth' : 'save');
      if (activeUser.current === actor) setLikes(previous => ({ ...previous, [id]: { count: result.count, hasLiked: result.hasLiked } }));
    } catch (error) {
      if (activeUser.current !== actor) return;
      if (error instanceof Error && error.message === 'auth') setAuthOpen(true);
      setLikeError(text('Il voto non è stato salvato. Riprova.', 'Your like was not saved. Please try again.'));
    } finally { busyLikes.current.delete(id); setLikeBusy(new Set(busyLikes.current)); }
  }

  return <main className={styles.page}>
    <header className={styles.header}>
      <div className={styles.brandRow}><Link href="/" className={styles.brand} aria-label={text('Chrispy Maps, torna alla mappa', 'Chrispy Maps, back to map')}>Chrispy <span>Maps</span></Link><nav className={styles.headerNav} aria-label={text('Navigazione', 'Navigation')}><Link href="/" className={styles.mapLink}><MapIcon name="pin" />{text('Mappa', 'Map')}</Link><Link href="/preferiti" className={styles.savedLink}><MapIcon name="heart" />{text('Salvati', 'Saved')}</Link><LanguageSwitch /></nav></div>
      <div className={styles.searchRow}><div className={styles.title}><h1>{text('Scopri spot', 'Discover spots')}</h1><p>{text('Cerca un posto o i contributi di un rider.', 'Find a spot or explore a rider’s contributions.')}</p></div><form role="search" onSubmit={search} className={styles.search}><label className={styles.srOnly} htmlFor="discover-search">{text('Cerca spot, città o rider', 'Search spots, cities or riders')}</label><MapIcon name="search" /><input id="discover-search" ref={input} type="search" value={filters.query} onChange={event => change('query', event.target.value)} placeholder={text('Spot, città o @rider', 'Spot, city or @rider')} maxLength={200} autoComplete="off" />{filters.query && <button type="button" className={styles.clear} aria-label={text('Cancella ricerca', 'Clear search')} onClick={() => { change('query', ''); input.current?.focus(); }}><MapIcon name="close" /></button>}<button className={styles.searchSubmit} aria-label={text('Cerca', 'Search')} type="submit"><MapIcon name="arrow" /></button></form></div>
      <div className={styles.controls}><label className={styles.typeSelect}><span className={styles.srOnly}>{text('Categoria', 'Category')}</span><MapIcon name={filters.type || 'layers'} size={18} /><select value={filters.type} onChange={event => change('type', event.target.value as SpotType | '')}><option value="">{text('Tutte le categorie', 'All categories')}</option>{Object.keys(TIPI_SPOT).map(type => <option key={type} value={type}>{typeLabel(type as SpotType)}</option>)}</select></label><button type="button" className={`${styles.button} ${advancedCount ? styles.activeButton : ''}`} aria-expanded={filtersOpen} aria-controls="discover-filters" onClick={() => setFiltersOpen(value => !value)}><MapIcon name="filter" size={18} />{text('Filtri', 'Filters')}{advancedCount > 0 && <span>{advancedCount}</span>}</button>{anyFilter && <button className={styles.reset} onClick={reset}>{text('Azzera', 'Reset')}</button>}<label className={styles.sort}><span>{text('Ordine', 'Sort')}</span><select value={filters.sort} onChange={event => change('sort', event.target.value as DiscoverFilters['sort'])}><option value="newest">{text('Più recenti', 'Newest first')}</option><option value="name">{text('Nome A–Z', 'Name A–Z')}</option></select></label></div>
      {filtersOpen && <div id="discover-filters" className={styles.filterPanel}>
        <label>{text('Paese', 'Country')}<select value={filters.country} onChange={event => change('country', event.target.value)}><option value="">{text('Tutti i paesi', 'All countries')}</option>{countries.map(country => <option key={country.value} value={country.value}>{country.label}</option>)}</select></label>
        <label>{text('Ostacolo', 'Obstacle')}<select value={filters.obstacle} onChange={event => change('obstacle', event.target.value as Ostacolo | '')}><option value="">{text('Tutti gli ostacoli', 'All obstacles')}</option>{Object.keys(OSTACOLI).map(value => <option key={value} value={value}>{obstacleLabel(value as Ostacolo)}</option>)}</select></label>
        <label>{text('Difficoltà', 'Difficulty')}<select value={filters.difficulty} onChange={event => change('difficulty', event.target.value)}><option value="">{text('Tutti i livelli', 'All levels')}</option>{DIFFICOLTA.map(item => <option key={item.value} value={item.value}>{item.value === 'beginner' ? text('Principiante', 'Beginner') : item.value === 'intermediate' ? text('Intermedio', 'Intermediate') : 'Pro'}</option>)}</select></label>
        <label>{text('Condizione', 'Condition')}<select value={filters.condition} onChange={event => change('condition', event.target.value as SpotCondition | '')}><option value="">{text('Tutte le condizioni', 'All conditions')}</option>{(['alive', 'bustato', 'demolito'] as const).map(value => <option key={value} value={value}>{conditionLabel(value)}</option>)}</select></label>
        {canFilterRegion && <label>{text('Regione italiana', 'Italian region')}<select value={filters.region} onChange={event => change('region', event.target.value)}><option value="">{text('Tutte le regioni', 'All regions')}</option>{REGIONI_ITALIA.map(region => <option key={region.label} value={region.label}>{region.label}</option>)}</select></label>}
        <button className={`${styles.button} ${styles.doneFilters}`} onClick={() => { setFiltersOpen(false); heading.current?.focus({ preventScroll: true }); }}>{text('Mostra', 'Show')} {filtered.length} {text('spot', filtered.length === 1 ? 'spot' : 'spots')}</button>
      </div>}
    </header>

    <div className={styles.results} ref={scroller}>
      <div className={styles.resultsInner}>
        {(usersLoading || usersError || userResults.length > 0) && <section className={styles.riders} aria-label={text('Rider trovati', 'Riders found')}><h2>{text('Rider', 'Riders')}</h2>{usersLoading ? <p role="status">{text('Ricerca rider…', 'Searching riders…')}</p> : usersError ? <p>{text('Ricerca rider non disponibile.', 'Rider search is unavailable.')} <button onClick={() => setUserRetry(value => value + 1)}>{text('Riprova', 'Retry')}</button></p> : <ul>{userResults.map(rider => <li key={rider.username}><Link href={`/u/${encodeURIComponent(rider.username)}`}><MapIcon name="user" /><span><strong>@{rider.username}</strong><small>{rider.spotCount} {text('spot', rider.spotCount === 1 ? 'spot' : 'spots')}</small></span><MapIcon name="arrow" size={18} /></Link></li>)}</ul>}</section>}
        <div className={styles.resultHeading}>
          <div><h2 tabIndex={-1} ref={heading}>{loadError ? text('Spot non disponibili', 'Spots unavailable') : `${filtered.length} ${text('spot', filtered.length === 1 ? 'spot' : 'spots')}`}</h2>{!loadError && <span>{filters.sort === 'newest' ? text('In ordine di aggiunta', 'Ordered by date added') : text('In ordine alfabetico', 'Alphabetical order')}</span>}</div>
          <Link href="/sfoglia" className={`${styles.textLink} ${styles.browseLink}`}>{text('Uno spot alla volta', 'One spot at a time')} <MapIcon name="arrow" size={18} /></Link>
        </div>
        {favorites.error && <div className={styles.feedback} role="alert">{favorites.error === 'load' ? text('Non riesco a caricare i tuoi spot salvati.', 'Your saved spots could not be loaded.') : text('La modifica ai salvati non è riuscita.', 'The change to your saved spots could not be saved.')} <button onClick={() => favorites.reload()}>{text('Riprova', 'Retry')}</button></div>}
        {likeError && <p className={styles.feedback} role="alert">{likeError}</p>}
        {loadError ? <section className={styles.empty}><MapIcon name="pin" size={30} /><h2>{text('Non riesco a caricare gli spot.', 'Spots could not be loaded.')}</h2><p>{text('Controlla la connessione e riprova.', 'Check your connection and try again.')}</p><button className={styles.button} disabled={refreshing} onClick={() => startRefresh(() => router.refresh())}>{refreshing ? text('Caricamento…', 'Loading…') : text('Riprova', 'Retry')}</button></section> : !filtered.length ? <section className={styles.empty}><MapIcon name="search" size={30} /><h2>{text('Nessuno spot con questi filtri.', 'No spots match these filters.')}</h2><p>{text('Prova un altro nome, una città o una categoria.', 'Try a different name, city or category.')}</p>{anyFilter && <button className={styles.button} onClick={reset}>{text('Azzera i filtri', 'Clear filters')}</button>}<Link href="/" className={styles.textLink}>{text('Cerca sulla mappa', 'Search on the map')} <MapIcon name="arrow" size={18} /></Link></section> : <>
          <div className={styles.grid}>{visible.map((spot, index) => {
            const saved = favorites.isFav(spot.id);
            const like = likes[spot.id];
            const count = like?.count ?? spot.likes_count ?? 0;
            const country = countryLabel(spot, language);
            const location = [spot.city, country].filter(Boolean).join(' · ');
            const updatedAt = spot.condition_updated_at && !Number.isNaN(Date.parse(spot.condition_updated_at)) ? new Date(spot.condition_updated_at) : null;
            return <article className={styles.card} key={spot.id}>
              <Link href={`/map/spot/${encodeURIComponent(spot.slug)}`} className={styles.spotLink} ref={element => { titleRefs.current[spot.id] = element; }} aria-label={`${spot.name}${location ? `, ${location}` : ''}`}><SpotCover spot={spot} index={index} missing={text('Foto non disponibile', 'No photo available')} streetview={text('Immagine Street View', 'Street View image')} /><div className={styles.spotInfo}><div className={styles.category}><MapIcon name={spot.type} size={18} />{typeLabel(spot.type)}</div><h3>{spot.name}</h3>{location && <p className={styles.location}>{location}</p>}<p className={`${styles.condition} ${spot.condition !== 'alive' ? styles.warning : ''}`}>{spot.condition !== 'alive' ? conditionLabel(spot.condition) : updatedAt ? `${text('Stato confermato il', 'Status confirmed on')} ${new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(updatedAt)}` : text('Stato da confermare', 'Status not confirmed')}</p></div></Link>
              {spot.submitted_by_username && <Link className={styles.contributor} href={`/u/${encodeURIComponent(spot.submitted_by_username)}`}>{text('Aggiunto da', 'Added by')} <span>@{spot.submitted_by_username}</span></Link>}
              <div className={styles.cardActions}><button aria-pressed={saved} disabled={!favorites.loaded || favorites.pendingIds.has(spot.id)} onClick={() => favorites.toggleFav(spot.id)} className={saved ? styles.saved : ''} aria-label={`${saved ? text('Rimuovi dai salvati', 'Remove from saved') : text('Salva', 'Save')} ${spot.name}`}><MapIcon name="heart" size={19} filled={saved} /><span>{saved ? text('Salvato', 'Saved') : text('Salva', 'Save')}</span></button><button aria-pressed={like ? like.hasLiked : undefined} disabled={likeBusy.has(spot.id) || user === undefined} onClick={() => void likeSpot(spot.id)} className={like?.hasLiked ? styles.saved : ''} aria-label={`${like?.hasLiked ? text('Rimuovi il voto a', 'Unlike') : text('Mi piace', 'Like')} ${spot.name}`}><MapIcon name="like" size={19} /><span>{count > 0 ? count : text('Mi piace', 'Like')}</span></button><Link href={`/map?spot=${encodeURIComponent(spot.slug)}`} aria-label={`${text('Mostra sulla mappa', 'Show on map')}: ${spot.name}`}><MapIcon name="pin" size={19} /><span>{text('Mappa', 'Map')}</span></Link></div>
            </article>;
          })}</div>
          <div className={styles.pagination}><p>{text('Mostrati', 'Showing')} {Math.min(visibleCount, filtered.length)} {text('di', 'of')} {filtered.length} {text('spot', filtered.length === 1 ? 'spot' : 'spots')}</p>{visibleCount < filtered.length && <button className={styles.button} onClick={loadMore}>{text('Carica altri spot', 'Load more spots')} <MapIcon name="plus" size={18} /></button>}</div>
        </>}
      </div>
    </div>
    <BottomNav onOpenAuth={() => setAuthOpen(true)} />
    <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} onSuccess={() => setAuthOpen(false)} />
  </main>;
}
