import { spotSymbol } from '@/lib/spot-symbols';
const paths: Record<string, string> = {
 message: 'M4 4h16v12H9l-5 4V4Z',
 bell: 'M6 8a6 6 0 0 1 12 0v6l2 3H4l2-3V8ZM10 21h4',
 like: 'M7 10v11H3V10h4ZM7 10l5-8 2 1v6h6l1 2-3 10H7',
 calendar: 'M4 5h16v16H4zM4 10h16M8 3v4M16 3v4',
 news: 'M4 3h16v18H4zM8 7h8M8 11h8M8 15h5',
 play: 'm8 4 12 8-12 8V4Z',
 trophy: 'M8 3h8v7a4 4 0 0 1-8 0V3ZM8 5H3v3a5 5 0 0 0 5 5M16 5h5v3a5 5 0 0 1-5 5M12 14v7M8 21h8',

 search: 'm21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
 menu: 'M4 6h16M4 12h16M4 18h16', close: 'm6 6 12 12M6 18 18 6',
 plus: 'M12 4v16M4 12h16', arrow: 'M4 12h16m-6-6 6 6-6 6',
 heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
 pin: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
 user: 'M20 21v-2a7 7 0 0 0-14 0v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
 photo: 'M3 4h18v16H3zM3 16l6-6 5 5 3-3 4 4M17 8h.01',
 route: 'm21 3-7 18-4-7-7-4 18-7ZM10 14 21 3',
 filter: 'M4 7h16M7 12h10M10 17h4', layers: 'm12 3 10 5-10 5L2 8l10-5ZM2 12l10 5 10-5M2 16l10 5 10-5',
};
export default function MapIcon({name, size=20, filled=false}: {name:string;size?:number;filled?:boolean}) {
 return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill={filled?'currentColor':'none'} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name] ?? spotSymbol(name)} /></svg>;
}
