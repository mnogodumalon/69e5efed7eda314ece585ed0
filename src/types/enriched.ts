import type { Standorte, Terminbuchung, Timeslots } from './app';

export type EnrichedStandorte = Standorte & {
  anbieterName: string;
};

export type EnrichedTimeslots = Timeslots & {
  anbieterName: string;
  standortName: string;
};

export type EnrichedTerminbuchung = Terminbuchung & {
  timeslotName: string;
};
