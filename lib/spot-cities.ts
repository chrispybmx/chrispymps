import { cache } from 'react';
import { supabaseServer } from './supabase';

/** Pagination keeps cities visible after the first 1,000 published spots. */
export const getApprovedCityNames = cache(async (): Promise<string[]> => {
  const supabase = supabaseServer();
  const names = new Set<string>();
  const pageSize = 1000;

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from('spots')
      .select('city')
      .eq('status', 'approved')
      .not('city', 'is', null)
      .order('id')
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error('Could not load spot cities');
    for (const row of data ?? []) {
      if (row.city?.trim()) names.add(row.city);
    }
    if (!data || data.length < pageSize) break;
  }

  return [...names];
});
