import { describe, expect, it } from 'vitest';
import { normalizeMapBounds, pointInBounds, readSpotQuery } from '@/lib/spot-query';

describe('worldwide viewport queries', () => {
  it('includes points on either side of the date line', () => {
    const {bounds} = readSpotQuery(new URLSearchParams('bbox=170,-30,-170,30'));
    expect(pointInBounds({lat:0,lon:179},bounds!)).toBe(true);
    expect(pointInBounds({lat:0,lon:-179},bounds!)).toBe(true);
    expect(pointInBounds({lat:0,lon:0},bounds!)).toBe(false);
  });
  it('normalizes a wrapped Leaflet viewport without losing its area', () => {
    const bounds=normalizeMapBounds({south:-20,north:20,west:170,east:190});
    expect(bounds).toEqual({south:-20,north:20,west:170,east:-170});
    expect(pointInBounds({lat:0,lon:181},bounds)).toBe(true);
    expect(pointInBounds({lat:0,lon:160},bounds)).toBe(false);
  });
  it('keeps full-world viewports and both hemispheres', () => {
    const bounds=normalizeMapBounds({south:-90,north:90,west:-400,east:400});
    expect(pointInBounds({lat:-89,lon:179},bounds)).toBe(true);
    expect(pointInBounds({lat:89,lon:-179},bounds)).toBe(true);
  });
  it.each(['1,2,3','1,2,3,4,5','0,,1,1','0,0,181,1','0,-91,1,1','0,50,1,20','NaN,0,1,1','0,0,Infinity,1','0,0,1),id.eq.secret,1'])('rejects invalid bbox %s', value => {
    expect(()=>readSpotQuery(new URLSearchParams({bbox:value}))).toThrow();
  });
  it.each(['-1','0.5','Infinity','100001','nope'])('rejects invalid offset %s', value => {
    expect(()=>readSpotQuery(new URLSearchParams({offset:value}))).toThrow();
  });
  it('validates bounded and deduplicated identifiers', () => {
    const id='11111111-1111-4111-8111-111111111111';
    expect(readSpotQuery(new URLSearchParams({ids:`${id},${id}`,view:'cover'}))).toMatchObject({ids:[id],coverOnly:true});
    expect(()=>readSpotQuery(new URLSearchParams({ids:'not-a-uuid'}))).toThrow();
    expect(()=>readSpotQuery(new URLSearchParams({ids:''}))).toThrow();
    const ids=Array.from({length:101},(_,n)=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`);
    expect(()=>readSpotQuery(new URLSearchParams({ids:ids.join(',')}))).toThrow();
  });
});
