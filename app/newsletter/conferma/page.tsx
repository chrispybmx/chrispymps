import type { Metadata } from 'next';
import { PRIVATE_ROBOTS } from '@/lib/seo';
import NewsletterConfirm from './NewsletterConfirm';
export const metadata:Metadata={title:'Conferma newsletter',robots:PRIVATE_ROBOTS,referrer:'no-referrer'};
export default function Page(){return <main style={{maxWidth:600,margin:'0 auto',padding:'48px 24px'}}><a href="/">Chrispy Maps</a><h1 style={{fontSize:32,marginTop:32}}>Conferma la newsletter</h1><NewsletterConfirm /></main>;}
