import { describe, it, expect } from 'vitest';
import { parseExploreState, type ExploreState } from '@/lib/explore-state';
const now = 1800000000000;
const state: ExploreState = {
  version:1, savedAt:now, search:'Roma', type:'street', region:'Lazio', condition:null, difficulty:null, obstacle:'rail',
  selected:'spot-1', expanded:'spot-1', view:{lat:41.9,lon:12.5,zoom:16}, returnView:{lat:41.9,lon:12.5,zoom:12},
  returnBounds:{south:41.8,west:12.4,north:42,east:12.6}, panelHeight:320, scrollTop:120,returnScroll:520,seed:0.42,
  radiusMode:false,radiusCenter:null,radiusKm:10,radiusPanelOpen:false,
};
describe('exploration continuity', () => {
 it('restores filters, selected spot, viewport and list position together', () => {
  expect(parseExploreState(JSON.stringify(state),now)).toEqual(state);
 });
 it('discards expired sessions instead of reopening stale filters', () => {
  expect(parseExploreState(JSON.stringify(state),now+7200001)).toBeNull();
 });
 it.each([null,'broken','{}',JSON.stringify({...state,type:'missing'}),JSON.stringify({...state,view:{lat:1000,lon:0,zoom:16}}),JSON.stringify({...state,version:2})])('falls back safely for invalid storage %s', raw => {
  expect(parseExploreState(raw,now)).toBeNull();
 });
 it('retains radius search when returning from a spot', () => {
  const radius = {...state,radiusMode:true,radiusCenter:{lat:45,lon:9},radiusKm:25};
  expect(parseExploreState(JSON.stringify(radius),now)?.radiusKm).toBe(25);
 });
});
