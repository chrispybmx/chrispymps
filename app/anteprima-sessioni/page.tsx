import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { localSessionPreview } from '@/lib/rider-preview-server';
import SessionPreview from './SessionPreview';
export const metadata={title:'Sessioni: anteprima locale',robots:{index:false,follow:false},alternates:{canonical:null}};
export default async function Page() {if(!localSessionPreview((await headers()).get('host')))notFound();return <SessionPreview/>;}
