import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
const fixture=vi.hoisted(()=>({endpoint:'/api/rider-sessions'}));
vi.mock('@/components/RiderSessions',()=>({
 useRiderSessions:()=>({user:null,snapshot:null,busy:false,error:'',endpoint:fixture.endpoint}),
 SessionCurrent:()=>null,
}));
import NearbySessionStart from '@/components/NearbySessionStart';

it.each(['/api/rider-sessions','/api/rider-sessions-preview'])('keeps Add spot actionable while GPS is pending (%s)',endpoint=>{
 fixture.endpoint=endpoint;
 const html=renderToStaticMarkup(createElement(NearbySessionStart,{spots:[],onClose:()=>{},onStarted:()=>{},onAddSpot:()=>{}}));
 expect(html).toContain('Cerco lo spot');
 const buttons=html.match(/<button\b[^>]*>[\s\S]*?<\/button>/g)||[];
 const add=buttons.find(button=>button.includes('Lo spot manca? Aggiungi spot'));
 expect(add).toBeDefined();
 expect(add).not.toMatch(/\sdisabled(?:=|\s|>)/);
});
