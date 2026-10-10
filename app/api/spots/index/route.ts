import { NextRequest, NextResponse } from 'next/server';
import { localSessionPreview } from '@/lib/rider-preview-server';
import { previewSpots } from '@/lib/preview-spots';
import { supabaseServer } from '@/lib/supabase';
export const revalidate = 60;

/** Small public index for markers/search. Photos are requested for the visible results. */
export async function GET(req:NextRequest) {
  try {
  if(localSessionPreview(req?.headers.get('host')??null))return NextResponse.json({ok:true,data:await previewSpots(true)},{headers:{'Cache-Control':'no-store'}});
  const sb = await supabaseServer();
  const result: unknown[] = [];
  let withObstacles = true;
  const pageSize = 1000;
  for (let offset=0;;offset+=pageSize) {
    const select = () => sb.from('spots').select(withObstacles
      ? 'id,slug,name,type,lat,lon,city,region,country,country_code,condition,condition_updated_at,difficulty,ostacoli,submitted_by_username,approved_at'
      : 'id,slug,name,type,lat,lon,city,region,country,country_code,condition,condition_updated_at,difficulty,submitted_by_username,approved_at')
      .eq('status','approved').order('id').range(offset,offset+pageSize-1);
    let response = await select();
    if (response.error && withObstacles && ['42703','PGRST204'].includes(response.error.code) && response.error.message.includes('ostacoli')) {
      withObstacles=false; response=await select();
    }
    if (response.error) return NextResponse.json({ok:false,error:'Non riesco a caricare gli spot.'},{status:503,headers:{'Cache-Control':'no-store'}});
    const rows = response.data ?? [];
    result.push(...rows);
    if (rows.length<pageSize) break;
  }
  return NextResponse.json({ok:true,data:result},{headers:{'Cache-Control':'public, s-maxage=60, stale-while-revalidate=300'}});
  } catch { return NextResponse.json({ok:false,error:'Non riesco a caricare gli spot.'},{status:503,headers:{'Cache-Control':'no-store'}}); }
}
