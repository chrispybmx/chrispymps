'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import styles from './angelica.module.css';

/* Il quiz: `ok` e' l'indice della risposta giusta, l'unica cliccabile.
   Le altre scappano. Per cambiare le domande basta toccare questo elenco. */
const QUIZ = [
  { q: 'Il sabato sera perfetto?', a: ['Discoteca fino all’alba', 'Divano, copertina e a letto alle 23'], ok: 1 },
  { q: 'Chi comanda davvero in casa?', a: ['Io', 'Il Bimby', 'Lilli'], ok: 2 },
  { q: 'Cosa fa rumore quando ti alzi dal divano?', a: ['Le ginocchia', 'Niente, sono una piuma'], ok: 0 },
  { q: 'Il Bimby per te è…', a: ['Solo un elettrodomestico', 'Un membro della famiglia'], ok: 1 },
  { q: 'Hai appena comprato casa. La frase che dici di più?', a: ['“Togliti le scarpe”', '“Fate come a casa vostra”'], ok: 0 },
  { q: 'Il drink della serata?', a: ['Tisana zenzero e limone', 'Shottini di tequila'], ok: 0 },
  { q: 'Lilli ti sveglia alle 5 di mattina. Tu…', a: ['Continui a dormire tranquilla', 'Ti alzi e le dai da mangiare'], ok: 1 },
  { q: 'Tra qualche anno sulla tua porta ci sarà scritto…', a: ['Stagista', 'Torno subito', 'Direttrice'], ok: 2 },
  { q: 'A che ora è “tardi”?', a: ['Le 4 di notte', 'Mezzanotte', 'Le 22:30'], ok: 2 },
  { q: 'Ultima domanda: quanti anni compi?', a: ['29, di nuovo', '30', '18 dentro'], ok: 1 },
];

export default function AngelicaClient({ fontClass }: { fontClass: string }) {
  const [qi, setQi] = useState(0);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <main className={`${fontClass} ${styles.desktop} ${styles.night}`}>
        <Fireworks />
        <div className={styles.flash} aria-hidden="true" />
        <div className={styles.finale}>
          <p className={styles.intro}>Ange, mia sorella,</p>
          <p className={styles.level}>il livello 3</p>
          <LevelThree />
          <section className={`${styles.window} ${styles.late}`} aria-labelledby="auguri-title">
            <div className={styles.titleBar}><span>auguri.exe</span></div>
            <div className={styles.message}>
              <p>Sei forte. Questo è solo l’inizio: hai creato le basi per avere vero successo.</p>
              <p>Ora è il momento di lavorare davvero, ma per le cose importanti, quelle che non puoi comprare.</p>
            </div>
            <h1 id="auguri-title" className={styles.auguri}>Buon compleanno Angelica!</h1>
            <p className={styles.statusBar}>Tocca lo schermo per altri fuochi</p>
          </section>
        </div>
      </main>
    );
  }

  const question = QUIZ[qi];
  const next = () => (qi + 1 < QUIZ.length ? setQi(qi + 1) : setDone(true));

  return (
    <main className={`${fontClass} ${styles.desktop}`}>
      <section key={qi} className={`${styles.window} ${styles.quiz}`} aria-labelledby="quiz-q">
        <div className={styles.titleBar}><span>quiz_30_anni.exe · {qi + 1} di {QUIZ.length}</span></div>
        <p id="quiz-q" className={styles.question}>{question.q}</p>
        <div className={styles.answers}>
          {question.a.map((answer, i) => i === question.ok
            ? <button key={answer} type="button" className={`${styles.button} ${styles.answer}`} onClick={next}>{answer}</button>
            : <Runaway key={answer}>{answer}</Runaway>)}
        </div>
        <div className={styles.progress} aria-hidden="true">
          {QUIZ.map((_, i) => <span key={i} className={i < qi ? styles.progressDone : undefined} />)}
        </div>
      </section>

      <Taskbar label="Quiz" />
    </main>
  );
}

/* Risposta sbagliata: resta ferma finche' non la premi, poi salta in un punto
   a caso dello schermo. Non si seleziona mai. Il click con detail 0 arriva
   solo dalla tastiera: col mouse o col dito ci pensa gia' pointerdown. */
function Runaway({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const flee = () => {
    const button = ref.current;
    if (!button) return;
    const { width, height } = button.getBoundingClientRect();
    const maxLeft = Math.max(8, window.innerWidth - Math.min(width, window.innerWidth - 16) - 8);
    const maxTop = Math.max(8, window.innerHeight - height - 56);
    setPos({ left: 8 + Math.random() * (maxLeft - 8), top: 8 + Math.random() * (maxTop - 8) });
  };
  return (
    <button ref={ref} type="button" className={`${styles.button} ${styles.answer} ${pos ? styles.fled : ''}`}
      style={pos ?? undefined} onPointerDown={flee} onClick={e => { if (e.detail === 0) flee(); }}>
      {children}
    </button>
  );
}

/* Super Saiyan 3 a pixel, disegnato a meta': la riga completa e' la meta'
   sinistra piu' il suo specchio. */
const SPRITE_HALF = [
  '...........K.......',
  '..........KYK.....K',
  '..........KYYK...KY',
  '......K...KYYYK.KYY',
  '......KYK.KYYYYKYYY',
  '......KYYKKYYYYYYYY',
  '.......KYYYYYYYYYYY',
  '......KYYYYYYYYYYYY',
  '.....KYYYYYYyYYYYYY',
  '....KYYYYYYYyYYYYYY',
  '...K.KYYYYYyYYYYYYY',
  '..KY.KYYYYYyKKKKKYY',
  '.KYYKYYYYYYyKSSSKYY',
  'KYYY.KYYYYYyKSSSSKY',
  '.KYY.KYYYYYyKSSSSSK',
  '..KYKYYYYYYyKsKKKSS',
  '..KY.KYYYYYyKSWGSSS',
  '.KYY.KYYYYYyKSSSSSs',
  'KYYYKYYYYYYyKsSSSSS',
  'KYYy.KYYYYYyKsSSSKK',
  '.KYy.KYYYYYYKsSSSSS',
  '..KYKYYYYYYYyKsSSSS',
  '..KY.KYYYYYYyyKKKKK',
  '.KYY.KYYYYYYyyyyKsS',
  'KYYYKYYYYYYyyyyyKsS',
  'KYYy.KYYYYyKKKKKKsS',
  '.KYy.KYYYKOOOOOOKBB',
  '.KYYKYYYKOOOOOOOKBB',
  'KYYYKYYKOOOOOOOOKBB',
  'KYYy.KYKOOOOoOOOOKB',
  'KYyKKYYKOOOOoOOOOKB',
  '.KK..KYKOOOOoOOOOOK',
  '....KYKOOOOOoOOOOOO',
  '.....KKOOOOOoOOOOOO',
  '....KOOOOOOOoOOOOOO',
  '....KKKKKKKKKKKKKKK',
];
const SPRITE_COLORS: Record<string, string> = {
  K: '#1a1008', Y: '#ffe13a', y: '#e8a200', S: '#ffcf9e', s: '#e89a6a',
  W: '#ffffff', G: '#19b39b', O: '#ff7b00', o: '#c95500', B: '#2447c9',
};

function LevelThree() {
  const rows = SPRITE_HALF.map(half => half + [...half].reverse().join(''));
  const rects: ReactNode[] = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length;) {
      let end = x + 1;
      while (end < row.length && row[end] === row[x]) end++;
      if (row[x] !== '.') rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={end - x} height={1} fill={SPRITE_COLORS[row[x]]} />);
      x = end;
    }
  });
  return (
    <svg className={styles.sprite} viewBox={`0 0 ${rows[0].length} ${rows.length}`} shapeRendering="crispEdges" aria-hidden="true">
      {rects}
    </svg>
  );
}

function Taskbar({ label }: { label: string }) {
  // Vuoto al primo render: l'ora del server non combacia con quella del browser.
  const [time, setTime] = useState('');
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }));
    tick();
    const id = window.setInterval(tick, 10_000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <footer className={styles.taskbar} aria-hidden="true">
      <span className={styles.start}>Start</span>
      <span className={styles.taskItem}>{label}</span>
      <span className={styles.clock}>{time}</span>
    </footer>
  );
}

type Rocket = { x: number; y: number; vx: number; vy: number; color: string };
type Spark = { x: number; y: number; vx: number; vy: number; life: number; color: string };

const COLORS = ['#ff0000', '#ffff00', '#00ff00', '#00ffff', '#ff00ff', '#ffffff', '#ff6a00'];
const GRAVITY = 0.08;
const pick = () => COLORS[Math.floor(Math.random() * COLORS.length)];

/* Fuochi a pixel quadrati, come uno screensaver anni '90. Un razzo sale fino al
   punto piu' alto e li' esplode; toccare lo schermo fa esplodere dove tocchi. */
function Fireworks() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = 0;
    let height = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const rockets: Rocket[] = [];
    const sparks: Spark[] = [];

    const explode = (x: number, y: number, color = pick()) => {
      const count = calm ? 30 : 70;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.2;
        const speed = 1.5 + Math.random() * 3;
        sparks.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1, color: Math.random() < 0.2 ? '#ffffff' : color });
      }
    };
    const launch = () => {
      const top = height * (0.12 + Math.random() * 0.35);
      rockets.push({
        x: width * (0.15 + Math.random() * 0.7),
        y: height,
        vx: (Math.random() - 0.5) * 1.5,
        vy: -Math.sqrt(2 * GRAVITY * (height - top)),
        color: pick(),
      });
    };

    const onPointer = (e: PointerEvent) => explode(e.clientX, e.clientY);
    canvas.addEventListener('pointerdown', onPointer);

    let frame = 0;
    let last = performance.now();
    let nextLaunch = 0;
    const loop = (now: number) => {
      // dt in frame da 60Hz: su schermi a 120Hz i fuochi non vanno al doppio.
      const dt = Math.min((now - last) / 16.67, 3);
      last = now;
      if (now >= nextLaunch) {
        launch();
        nextLaunch = now + (calm ? 2000 : 300 + Math.random() * 600);
      }

      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
      ctx.fillRect(0, 0, width, height);

      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        r.x += r.vx * dt;
        r.y += r.vy * dt;
        r.vy += GRAVITY * dt;
        ctx.fillStyle = r.color;
        ctx.fillRect(Math.round(r.x), Math.round(r.y), 3, 3);
        if (r.vy >= 0) {
          explode(r.x, r.y, r.color);
          rockets.splice(i, 1);
        }
      }

      const drag = 0.985 ** dt;
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.vx *= drag;
        s.vy = s.vy * drag + GRAVITY * 0.5 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.life -= 0.012 * dt;
        if (s.life <= 0) {
          sparks.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = s.life;
        ctx.fillStyle = s.color;
        ctx.fillRect(Math.round(s.x), Math.round(s.y), 3, 3);
      }

      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointerdown', onPointer);
    };
  }, []);

  return <canvas ref={canvasRef} className={styles.fireworks} aria-hidden="true" />;
}
