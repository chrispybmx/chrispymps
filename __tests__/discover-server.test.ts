import { describe,it,expect,vi,beforeEach } from 'vitest';
const mocks=vi.hoisted(()=>({from:vi.fn()}));
vi.mock('next/cache',()=>({unstable_cache:(fn:unknown)=>fn}));
vi.mock('@/lib/supabase',()=>({supabasePublic:()=>({from:mocks.from})}));
import { getDiscoverPage } from '@/lib/discover-server';
import { EMPTY_DISCOVER_FILTERS } from '@/app/scopri/discover';
const rows=Array.from({length:30},(_,i)=>({id:String(i),slug:'spot-'+i,name:'Spot '+String(i).padStart(2,'0'),type:'rail',lat:45,lon:11,city:i<2?'Châtel':'Roma',country:'Italia',country_code:'IT',condition:'alive',approved_at:'2026-01-01'}));
let covers:Record<string,ReturnType<typeof vi.fn>>;
beforeEach(()=>{vi.clearAllMocks();let request=0;mocks.from.mockImplementation(()=>{request++;const builder:Record<string,ReturnType<typeof vi.fn>>={};for(const name of ['select','eq','order','range','in','or','limit'])builder[name]=vi.fn(()=>builder);builder.then=vi.fn((resolve)=>resolve(request===1?{data:rows,error:null}:{data:rows.map(x=>({id:x.id,spot_photos:[{url:'https://img.example/a.jpg',position:0,moderation_status:'approved'}]})),error:null}));if(request===2)covers=builder;return builder;});});
describe('bounded discover pages',()=>{
 it('returns 24 rows and queries only their cover ids',async()=>{const page=await getDiscoverPage({...EMPTY_DISCOVER_FILTERS,sort:'name'});expect(page.spots).toHaveLength(24);expect(page.total).toBe(30);expect(page.nextOffset).toBe(24);expect(covers.in.mock.calls[0][1]).toHaveLength(24);expect(covers.limit).toHaveBeenCalledWith(1,{referencedTable:'spot_photos'});});
 it('retains accent-insensitive search on the server',async()=>{const page=await getDiscoverPage({...EMPTY_DISCOVER_FILTERS,query:'chatel'});expect(page.spots).toHaveLength(2);expect(page.nextOffset).toBeNull();});
 it('only returns the final page after its offset',async()=>{const page=await getDiscoverPage({...EMPTY_DISCOVER_FILTERS,sort:'name'},24);expect(page.spots).toHaveLength(6);expect(page.spots[0].name).toBe('Spot 24');expect(page.nextOffset).toBeNull();});
});
