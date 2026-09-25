/** Outlines of real spot features, shared between Leaflet and React. */
export const SPOT_SYMBOLS: Record<string, string> = {
 street: 'M3 19h18M5 19v-5h5v-5h5V4h4v15', park: 'M3 6v13h18V6M3 9c6 0 4 10 9 10s3-10 9-10',
 plaza: 'M3 19h18M5 15h14M7 11h10M9 7h6', diy: 'M4 19 19 4M4 5l3-2 3 3-2 3M14 16l3 3 3-3-3-3',
 trail: 'M3 19 8 8l5 11M12 19l5-15 4 15', pumptrack: 'M2 17c4 0 3-10 7-10s3 10 7 10 3-10 6-10',
 transition: 'M3 6c0 10 6 13 18 13M3 6v13h18', rail: 'M3 8h18M7 8v11M17 8v11',
 ledge: 'M3 10h18v5H3zM5 15v4M19 15v4', gap: 'M2 17h6v4M16 21v-4h6M8 9l4-3 4 3',
 bowl: 'M3 6v4a9 9 0 0 0 18 0V6M3 6h18', bank: 'M3 19 17 5h4v14z',
 stairs: 'M3 19h5v-5h5V9h5V4h3', hubba: 'M3 6 21 16M4 10l16 9M7 8v11M17 14v5',
 quarter: 'M3 4c0 11 6 15 18 15M3 4v15h18', wallride: 'M4 3v18h17M4 17 17 4',
 spine: 'M2 19c6 0 8-6 10-13 2 7 4 13 10 13', box: 'M3 8h18v12H3zM3 8l5-4h9l4 4M8 4v4', kicker: 'M3 19 17 8v11H3Z', pole_jam: 'M4 20h16M8 20l7-14', curb: 'M3 16h18M3 20h18M6 16v4M14 16v4', dirt_jump: 'M2 20 8 8l4 12M14 20l4-9 4 9',
 flat: 'M3 17h18M7 11h10', manual_pad: 'M3 12h18v6H3z', drop: 'M3 5h7v14h11M15 6v7l-3-3m3 3 3-3',
};
export function spotSymbol(type: string) { return SPOT_SYMBOLS[type] ?? SPOT_SYMBOLS.street; }
