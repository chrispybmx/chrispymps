import Link from 'next/link';
import MapIcon from '@/components/MapIcon';
import { OSTACOLI } from '@/lib/constants';
import type { SiteLanguage } from '@/lib/language';
import type { Ostacolo, Spot } from '@/lib/types';
import { conditionText, difficultyText, formatSpotDate, type SpotStatusHistoryItem } from '@/lib/spot-trust';
import './spot-trust.css';

type Facts = Pick<Spot, 'ostacoli' | 'difficulty' | 'surface' | 'wax_needed' | 'guardians'>;
export function BeforeYouRide({ spot, language = 'it' }: { spot: Facts; language?: SiteLanguage }) {
  const text = (it: string, en: string) => language === 'en' ? en : it;
  const obstacles = (spot.ostacoli ?? []).filter((value): value is Ostacolo => Boolean(OSTACOLI[value]));
  const difficulty = difficultyText(spot.difficulty, language);
  const surface = spot.surface?.trim();
  const access = spot.guardians?.trim();
  if (!obstacles.length && !difficulty && !surface && !access && !spot.wax_needed) return null;
  const obstacleLabel = (value: Ostacolo) => language === 'en' && value === 'stairs' ? 'Stairs' : language === 'en' && value === 'curb' ? 'Curb' : OSTACOLI[value].label;
  return <section className="cm-spot-facts" aria-labelledby="spot-facts-title">
    <h2 id="spot-facts-title">{text('Prima di partire', 'Before you go')}</h2>
    <dl>
      {obstacles.length > 0 && <div><dt>{text('Cosa trovi', 'Features')}</dt><dd className="cm-spot-features">{obstacles.map(value => <span key={value}><MapIcon name={value} size={18} />{obstacleLabel(value)}</span>)}</dd></div>}
      {difficulty && <div><dt>{text('Difficoltà', 'Difficulty')}</dt><dd>{difficulty}</dd></div>}
      {surface && <div><dt>{text('Superficie', 'Surface')}</dt><dd>{surface}</dd></div>}
      {spot.wax_needed && <div><dt>{text('Da portare', 'Bring')}</dt><dd>{text('Cera, secondo chi ha pubblicato lo spot', 'Wax, according to the contributor')}</dd></div>}
      {access && <div><dt>{text('Accesso', 'Access')}</dt><dd>{access}</dd></div>}
    </dl>
  </section>;
}

export function SpotStatusHistory({ items, language = 'it' }: { items: SpotStatusHistoryItem[]; language?: SiteLanguage }) {
  const text = (it: string, en: string) => language === 'en' ? en : it;
  if (!items.length) return null;
  return <section className="cm-spot-history" aria-labelledby="spot-history-title">
    <h2 id="spot-history-title">{text('Segnalazioni dei rider', 'Rider reports')}</h2>
    <ol>{items.map(item => {
      const date = formatSpotDate(item.created_at, language);
      return <li key={item.id}>
        <div className="cm-spot-report-heading"><strong>{conditionText(item.condition, language)}</strong>{date && <time dateTime={item.created_at}>{date}</time>}</div>
        <div className="cm-spot-report-author">{text('Segnalato da ', 'Reported by ')}{item.username ? <Link href={`/u/${encodeURIComponent(item.username)}`}>@{item.username}</Link> : text('un rider', 'a rider')}</div>
        {item.note?.trim() && <p>{item.note}</p>}
      </li>;
    })}</ol>
  </section>;
}
