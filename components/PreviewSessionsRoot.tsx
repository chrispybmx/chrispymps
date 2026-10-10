'use client';
import { usePathname } from 'next/navigation';
import { RiderSessionsProvider,SessionDock } from './RiderSessions';
import { PREVIEW_ACTOR,PREVIEW_TOKEN } from '@/lib/rider-preview';

const user={id:PREVIEW_ACTOR,username:'rider_demo',email:'demo@localhost',accessToken:PREVIEW_TOKEN};
export default function PreviewSessionsRoot({children}:{children:React.ReactNode}) {
 const pathname=usePathname();
 if(pathname==='/anteprima-sessioni')return <>{children}</>;
 return <RiderSessionsProvider user={user} endpoint="/api/rider-sessions-preview">
  {children}
  <SessionDock/>
 </RiderSessionsProvider>;
}
