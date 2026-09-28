'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import styles from './angelica.module.css';

type Step = 'start' | 'ask' | 'yes' | 'no';

const TASK_LABEL: Record<Exclude<Step, 'yes'>, string> = { start: 'Messaggio', ask: 'Conferma', no: 'Errore' };

export default function AngelicaClient({ fontClass }: { fontClass: string }) {
  const [step, setStep] = useState<Step>('start');

  if (step === 'yes') {
    return (
      <main className={`${fontClass} ${styles.desktop} ${styles.night}`}>
        <Fireworks />
        <section className={`${styles.window} ${styles.party}`} aria-labelledby="auguri-title">
          <div className={styles.titleBar}><span>auguri.exe</span></div>
          <h1 id="auguri-title" className={styles.auguri}>Tanti auguri Angelica!</h1>
          <p className={styles.statusBar}>Tocca lo schermo per altri fuochi</p>
        </section>
      </main>
    );
  }

  return (
    <main className={`${fontClass} ${styles.desktop}`}>
      {step === 'start' && (
        <button type="button" className={`${styles.button} ${styles.bigButton}`} onClick={() => setStep('ask')}>
          Sei Angelica?
        </button>
      )}

      {step === 'ask' && (
        <Dialog title="Conferma" icon="question" onClose={() => setStep('start')}
          actions={<>
            <button type="button" className={styles.button} autoFocus onClick={() => setStep('yes')}>Sì</button>
            <button type="button" className={styles.button} onClick={() => setStep('no')}>No</button>
          </>}>
          Confermi di essere Angelica?
        </Dialog>
      )}

      {step === 'no' && (
        <Dialog title="Errore" icon="error" onClose={() => setStep('start')}
          actions={<button type="button" className={styles.button} autoFocus onClick={() => setStep('start')}>OK</button>}>
          <strong className={styles.errorCode}>Errore 404</strong>
          Pagina non trovata.
        </Dialog>
      )}

      <Taskbar label={TASK_LABEL[step]} />
    </main>
  );
}

function Dialog({ title, icon, onClose, actions, children }: {
  title: string; icon: 'question' | 'error'; onClose: () => void; actions: ReactNode; children: ReactNode;
}) {
  const id = useId();
  return (
    <section className={styles.window} role={icon === 'error' ? 'alertdialog' : 'dialog'} aria-modal="true"
      aria-labelledby={`${id}-title`} aria-describedby={`${id}-text`}>
      <div className={styles.titleBar}>
        <span id={`${id}-title`}>{title}</span>
        <button type="button" className={styles.titleClose} aria-label="Chiudi" onClick={onClose}>×</button>
      </div>
      <div className={styles.body}>
        <span className={icon === 'error' ? styles.iconError : styles.iconQuestion} aria-hidden="true">
          {icon === 'error' ? '×' : '?'}
        </span>
        <p id={`${id}-text`}>{children}</p>
      </div>
      <div className={styles.actions}>{actions}</div>
    </section>
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
