import type { EnrichedStandorte, EnrichedTerminbuchung, EnrichedTimeslots } from '@/types/enriched';
import type { Anbieterprofil, Standorte, Terminbuchung, Timeslots } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveDisplay(url: unknown, map: Map<string, any>, ...fields: string[]): string {
  if (!url) return '';
  const id = extractRecordId(url);
  if (!id) return '';
  const r = map.get(id);
  if (!r) return '';
  return fields.map(f => String(r.fields[f] ?? '')).join(' ').trim();
}

interface StandorteMaps {
  anbieterprofilMap: Map<string, Anbieterprofil>;
}

export function enrichStandorte(
  standorte: Standorte[],
  maps: StandorteMaps
): EnrichedStandorte[] {
  return standorte.map(r => ({
    ...r,
    anbieterName: resolveDisplay(r.fields.anbieter, maps.anbieterprofilMap, 'vorname', 'nachname'),
  }));
}

interface TimeslotsMaps {
  anbieterprofilMap: Map<string, Anbieterprofil>;
  standorteMap: Map<string, Standorte>;
}

export function enrichTimeslots(
  timeslots: Timeslots[],
  maps: TimeslotsMaps
): EnrichedTimeslots[] {
  return timeslots.map(r => ({
    ...r,
    anbieterName: resolveDisplay(r.fields.anbieter, maps.anbieterprofilMap, 'vorname', 'nachname'),
    standortName: resolveDisplay(r.fields.standort, maps.standorteMap, 'standort_name'),
  }));
}

interface TerminbuchungMaps {
  timeslotsMap: Map<string, Timeslots>;
}

export function enrichTerminbuchung(
  terminbuchung: Terminbuchung[],
  maps: TerminbuchungMaps
): EnrichedTerminbuchung[] {
  return terminbuchung.map(r => ({
    ...r,
    timeslotName: resolveDisplay(r.fields.timeslot, maps.timeslotsMap, 'titel'),
  }));
}
