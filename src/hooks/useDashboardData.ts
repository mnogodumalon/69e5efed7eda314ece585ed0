import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Anbieterprofil, Standorte, Timeslots, Terminbuchung } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';

export function useDashboardData() {
  const [anbieterprofil, setAnbieterprofil] = useState<Anbieterprofil[]>([]);
  const [standorte, setStandorte] = useState<Standorte[]>([]);
  const [timeslots, setTimeslots] = useState<Timeslots[]>([]);
  const [terminbuchung, setTerminbuchung] = useState<Terminbuchung[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const [anbieterprofilData, standorteData, timeslotsData, terminbuchungData] = await Promise.all([
        LivingAppsService.getAnbieterprofil(),
        LivingAppsService.getStandorte(),
        LivingAppsService.getTimeslots(),
        LivingAppsService.getTerminbuchung(),
      ]);
      setAnbieterprofil(anbieterprofilData);
      setStandorte(standorteData);
      setTimeslots(timeslotsData);
      setTerminbuchung(terminbuchungData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Fehler beim Laden der Daten'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Silent background refresh (no loading state change → no flicker)
  useEffect(() => {
    async function silentRefresh() {
      try {
        const [anbieterprofilData, standorteData, timeslotsData, terminbuchungData] = await Promise.all([
          LivingAppsService.getAnbieterprofil(),
          LivingAppsService.getStandorte(),
          LivingAppsService.getTimeslots(),
          LivingAppsService.getTerminbuchung(),
        ]);
        setAnbieterprofil(anbieterprofilData);
        setStandorte(standorteData);
        setTimeslots(timeslotsData);
        setTerminbuchung(terminbuchungData);
      } catch {
        // silently ignore — stale data is better than no data
      }
    }
    function handleRefresh() { void silentRefresh(); }
    window.addEventListener('dashboard-refresh', handleRefresh);
    return () => window.removeEventListener('dashboard-refresh', handleRefresh);
  }, []);

  const anbieterprofilMap = useMemo(() => {
    const m = new Map<string, Anbieterprofil>();
    anbieterprofil.forEach(r => m.set(r.record_id, r));
    return m;
  }, [anbieterprofil]);

  const standorteMap = useMemo(() => {
    const m = new Map<string, Standorte>();
    standorte.forEach(r => m.set(r.record_id, r));
    return m;
  }, [standorte]);

  const timeslotsMap = useMemo(() => {
    const m = new Map<string, Timeslots>();
    timeslots.forEach(r => m.set(r.record_id, r));
    return m;
  }, [timeslots]);

  return { anbieterprofil, setAnbieterprofil, standorte, setStandorte, timeslots, setTimeslots, terminbuchung, setTerminbuchung, loading, error, fetchAll, anbieterprofilMap, standorteMap, timeslotsMap };
}