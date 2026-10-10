import {describe,it,expect} from 'vitest';
import {sharedSpotIds,sharedSpotsPath} from '@/lib/shared-spots';
const a='123e4567-e89b-12d3-a456-426614174000';
const b='123e4567-e89b-12d3-a456-426614174001';
describe('shared ride selection',()=>{
 it('preserves order and removes duplicates',()=>expect(sharedSpotIds(`${b},${a},${b}`)).toEqual([b,a]));
 it('contains only selected public identifiers',()=>expect(sharedSpotsPath([a,b])).toBe(`/da-girare?spots=${a},${b}`));
 it.each(['',null,`${a},invalid`,'https://evil.example'])('rejects malformed lists %s',value=>expect(sharedSpotIds(value)).toEqual([]));
 it('rejects unbounded selections',()=>expect(sharedSpotIds(Array.from({length:25},(_,i)=>`123e4567-e89b-12d3-a456-${String(i).padStart(12,'0')}`).join(','))).toEqual([]));
});
