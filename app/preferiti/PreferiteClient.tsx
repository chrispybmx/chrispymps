'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import MapIcon from '@/components/MapIcon';
import LanguageSwitch from '@/components/LanguageSwitch';
import { useLanguage } from '@/components/LanguageProvider';
import { useFavorites } from '@/hooks/useFavorites';
import { loadFavoriteSpots, type FavoriteSpot } from '@/lib/favorite-spots';
import { miniatura } from '@/lib/immagini';
import { TIPI_SPOT } from '@/lib/constants';
import styles from './favorites.module.css';

export default function PreferiteClient() {
  const { language, text } = useLanguage();
  const { favIds, loaded, error, pendingIds, scope, setFav, reload, legacyIds, importLegacy } = useFavorites();
  const [details, setDetails] = useState<Map<string, FavoriteSpot>>(new Map());
  const cache = useRef(new Map<string, FavoriteSpot>());
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [removed, setRemoved] = useState<{ id: string; name: string } | null>(null);
  const [legacy, setLegacy] = useState<string[]>([]);
  const [review, setReview] = useState(false);
  const [recoverySpots, setRecoverySpots] = useState<FavoriteSpot[]>([]);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryError, setRecoveryError] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [imported, setImported] = useState(false);
  const ids = useMemo(() => [...favIds], [favIds]);
  const identity = ids.join(',');

  useEffect(() => { setLegacy(legacyIds()); }, [legacyIds]);
  useEffect(() => { setRemoved(null); setReview(false); setSelected(new Set()); setImported(false); }, [scope]);

  useEffect(() => {
    if (!loaded) return;
    const controller = new AbortController();
    const missing = ids.filter(id => !cache.current.has(id));
    setLoadError(false);
    if (!missing.length) { setDetails(new Map(cache.current)); setLoading(false); return; }
    setLoading(true);
    loadFavoriteSpots(missing, controller.signal).then(spots => {
      if (controller.signal.aborted) return;
      for (const spot of spots) cache.current.set(spot.id, spot);
      setDetails(new Map(cache.current));
    }).catch(() => { if (!controller.signal.aborted) setLoadError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  // The key represents the complete list, without refetching for unrelated store updates.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, loaded, refresh]);

  useEffect(() => {
    if (!review || !legacy.length) return;
    const controller = new AbortController();
    setRecoveryLoading(true);
    setRecoveryError(false);
    loadFavoriteSpots(legacy, controller.signal).then(spots => { if (!controller.signal.aborted) setRecoverySpots(spots); })
      .catch(() => { if (!controller.signal.aborted) setRecoveryError(true); })
      .finally(() => { if (!controller.signal.aborted) setRecoveryLoading(false); });
    return () => controller.abort();
  }, [review, legacy, refresh]);

  const spots = ids.flatMap(id => details.has(id) ? [details.get(id)!] : []);
  const unavailable = loaded && !loading && !loadError ? ids.filter(id => !details.has(id)) : [];
  const retry = () => { void reload(); setRefresh(value => value + 1); };
  const remove = (spot: FavoriteSpot) => { setFav(spot.id, false); setRemoved({ id: spot.id, name: spot.name }); };
  const category = (spot: FavoriteSpot) => language === 'en' ? ({ street: 'Street', park: 'Skatepark', diy: 'DIY', trail: 'Trails', rail: 'Rail', ledge: 'Ledge', plaza: 'Plaza', gap: 'Gap', bowl: 'Bowl' } as Record<string, string>)[spot.type] ?? spot.type : TIPI_SPOT[spot.type]?.label ?? spot.type;

  return <main className={styles.page}>
    <header className={styles.header}>
      <Link href="/" className={styles.back}>{text('← Mappa', '← Map')}</Link>
      <LanguageSwitch />
    </header>
    <div className={styles.content}>
      <div className={styles.heading}><MapIcon name="heart" size={26} /><h1>{text('I tuoi spot salvati', 'Your saved spots')}</h1></div>
      <p className={styles.intro}>{scope === 'guest'
        ? text('Salvati su questo dispositivo. Quando accedi li ritrovi anche nel tuo account.', 'Saved on this device. Sign in to save them to your account too.')
        : text('I posti da ritrovare per la prossima uscita.', 'Places to find again for your next ride.')}</p>

      {(error || loadError) && <div className={styles.notice} role="alert">
        <p>{error === 'auth' ? text('La sessione è scaduta. Accedi di nuovo dalla mappa.', 'Your sign-in expired. Sign in again from the map.')
          : error === 'save' ? text('La modifica non è stata salvata. Il preferito è tornato allo stato precedente.', 'Your change was not saved. The previous saved state has been restored.')
          : text('Non siamo riusciti ad aggiornare tutti gli spot. I salvataggi già presenti restano disponibili.', 'We could not refresh all spots. Existing saved places are still available.')}</p>
        <button type="button" onClick={retry}>{text('Riprova', 'Try again')}</button>
      </div>}

      {removed && !favIds.has(removed.id) && <div className={styles.undo} role="status">
        <span>{text('Rimosso:', 'Removed:')} {removed.name}</span>
        <button type="button" onClick={() => { setFav(removed.id, true); setRemoved(null); }}>{text('Annulla', 'Undo')}</button>
      </div>}
      {!loaded && <p className={styles.state} role="status">{text('Caricamento dei preferiti…', 'Loading saved spots…')}</p>}
      {loaded && !ids.length && !error && <section className={styles.empty}>
        <MapIcon name="pin" size={36} /><h2>{text('Il prossimo giro parte da uno spot', 'Your next ride starts with a spot')}</h2>
        <p>{text('Salva con il cuore i posti che vuoi provare. Li ritrovi qui, pronti per la prossima uscita.', 'Tap the heart on places you want to ride. Find them here when you plan your next session.')}</p>
        <Link href="/" className={styles.primary}>{text('Cerca sulla mappa', 'Explore the map')} <MapIcon name="arrow" size={18} /></Link>
      </section>}

      {loaded && ids.length > 0 && <>
        <div className={styles.listHeading}><h2>{text('Da ritrovare', 'Ready for another visit')}</h2><span>{spots.length}{loading ? '…' : ''}</span></div>
        <div className={styles.list}>
          {spots.map(spot => {
            const cover = spot.spot_photos?.[0];
            return <article key={spot.id} className={styles.spot}>
              <Link href={`/map/spot/${encodeURIComponent(spot.slug)}`} className={styles.spotLink}>
                <div className={styles.photo}>
                  {cover ? <img src={miniatura(cover.url, 480)} alt="" loading="lazy" /> : <MapIcon name="photo" size={28} />}
                </div>
                <div className={styles.info}>
                  <span className={styles.category}><MapIcon name={spot.type} size={17} />{category(spot)}</span>
                  <h3>{spot.name}</h3>
                  {spot.city && <p className={styles.city}>{spot.city}</p>}
                  {spot.condition === 'bustato' && <p className={styles.condition}>{text('Accesso da verificare', 'Check access before riding')}</p>}
                  {spot.condition === 'demolito' && <p className={styles.condition}>{text('Segnalato come demolito', 'Reported as demolished')}</p>}
                  {cover?.source === 'streetview' && <p className={styles.credit}>{text('Immagine Street View', 'Street View image')}{cover.credit_name ? ` · ${cover.credit_name}` : ''}</p>}
                  {spot.submitted_by_username && <p className={styles.credit}>@{spot.submitted_by_username}</p>}
                  <span className={styles.open}>{text('Apri spot', 'Open spot')} <MapIcon name="arrow" size={16} /></span>
                </div>
              </Link>
              <button type="button" className={styles.remove} onClick={() => remove(spot)} aria-label={text(`Rimuovi ${spot.name} dai preferiti`, `Remove ${spot.name} from saved spots`)} title={text('Rimuovi dai preferiti', 'Remove from saved spots')}><MapIcon name="heart" filled size={20} /></button>
            </article>;
          })}
        </div>
        {loading && <p className={styles.state} role="status">{text('Caricamento degli spot…', 'Loading spots…')}</p>}
        {unavailable.length > 0 && <div className={styles.notice}>
          <p>{text(`${unavailable.length} spot salvati non sono più disponibili sulla mappa.`, `${unavailable.length} saved spots are no longer available on the map.`)}</p>
          <button type="button" onClick={() => unavailable.forEach(id => setFav(id, false))}>{text('Rimuovi i riferimenti non disponibili', 'Remove unavailable spots')}</button>
        </div>}
      </>}
      {pendingIds.size > 0 && <p className={styles.sync} role="status">{text('Salvataggio in corso…', 'Saving…')}</p>}

      {legacy.length > 0 && <section className={styles.recovery}>
        <h2>{text('Salvataggi precedenti su questo dispositivo', 'Previous saves on this device')}</h2>
        <p>{text('La versione precedente non distingueva gli account. Questi salvataggi potrebbero appartenere a un’altra persona: controllali prima di importarli.', 'The previous version did not separate accounts. These saves may belong to someone else: review them before importing.')}</p>
        {!review ? <button type="button" onClick={() => setReview(true)}>{text('Controlla i salvataggi precedenti', 'Review previous saves')}</button> : <>
          {recoveryLoading && <p role="status">{text('Caricamento…', 'Loading…')}</p>}
          {recoveryError && <p role="alert">{text('Caricamento non riuscito. Riprova.', 'Could not load these spots. Try again.')} <button type="button" onClick={retry}>{text('Riprova', 'Try again')}</button></p>}
          <div className={styles.recoveryList}>{recoverySpots.map(spot => <label key={spot.id}>
            <input type="checkbox" checked={selected.has(spot.id)} onChange={event => setSelected(previous => { const next = new Set(previous); if (event.target.checked) next.add(spot.id); else next.delete(spot.id); return next; })} />
            <span>{spot.name}{spot.city ? ` · ${spot.city}` : ''}</span>
          </label>)}</div>
          {!recoveryLoading && !recoveryError && !recoverySpots.length && <p>{text('Nessuno dei salvataggi precedenti è attualmente disponibile sulla mappa.', 'None of these previous saves is currently available on the map.')}</p>}
          {selected.size > 0 && <button type="button" onClick={() => { importLegacy([...selected]); setSelected(new Set()); setImported(true); }}>{text(`Importa ${selected.size} spot selezionati`, `Import ${selected.size} selected spots`)}</button>}
          {imported && <p role="status">{pendingIds.size > 0 ? text('Importazione in corso… La copia precedente rimane sul dispositivo.', 'Importing… The original copy remains on this device.') : error ? text('L’importazione non è stata completata. La copia precedente rimane sul dispositivo.', 'The import did not finish. The original copy remains on this device.') : text('Spot selezionati aggiunti ai tuoi preferiti. La copia precedente rimane sul dispositivo.', 'Selected spots added to your saved places. The original copy remains on this device.')}</p>}
        </>}
      </section>}
    </div>
  </main>;
}
