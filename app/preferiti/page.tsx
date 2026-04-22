import type { Metadata } from 'next';
import PreferiteClient from './PreferiteClient';

export const metadata: Metadata = {
  title: 'I miei spot preferiti | Chrispy Maps',
  description: 'I tuoi spot BMX, skate e scooter salvati su Chrispy Maps.',
};

export default function PreferitiPage() {
  return <PreferiteClient />;
}
