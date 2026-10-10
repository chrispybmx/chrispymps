import { expect,it,vi } from 'vitest';
import { NextRequest } from 'next/server';
import { readFile } from 'node:fs/promises';
const mock=vi.hoisted(()=>({from:vi.fn(),select:vi.fn()}));
vi.mock('@/lib/supabase',()=>({supabaseAdmin:()=>({from:mock.from})}));
import { GET } from '@/app/api/user-stats/route';

it('never queries or returns detailed spot activity with public profile stats',async()=>{
 const stats={lifetime_xp:100,current_level:'New Rider'};
 mock.from.mockImplementation((table:string)=>{
  if(!['profiles','user_stats','user_badges'].includes(table))throw new Error(`Unexpected private table: ${table}`);
  const data=table==='profiles'?{id:'test-id',username:'test'}:table==='user_stats'?stats:[];
  const chain={select:mock.select,eq:()=>chain,maybeSingle:async()=>({data}),order:async()=>({data})};
  mock.select.mockImplementation(()=>chain);return chain;
 });
 const response=await GET(new NextRequest('http://localhost/api/user-stats?username=test'));
 expect(response.status).toBe(200);
 expect(await response.json()).toEqual({ok:true,data:{stats,badges:[],recentXP:[]}});
 expect(response.headers.get('cache-control')).toContain('no-store');
 expect(mock.select.mock.calls.flat()).not.toContain('*');
 expect(mock.from.mock.calls.flat()).not.toContain('point_events');
});

it('does not query legacy ridden spots or render their history in the profile',async()=>{
 const source=await readFile(new URL('../app/u/[username]/page.tsx',import.meta.url),'utf8');
 expect(source).not.toContain(".from('spot_riders')");
 expect(source).not.toContain('SPOT GIRATI');
 expect(source).toContain('<RiderHistory ownerId={profile.id}');
 expect(source).toContain('<RiderPublicStats ownerId={profile.id}');
});
