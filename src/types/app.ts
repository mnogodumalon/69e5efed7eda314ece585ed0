// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
export type GeoLocation = { lat: number; long: number; info?: string };

export interface Anbieterprofil {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    vorname?: string;
    nachname?: string;
    email?: string;
    telefon?: string;
    beschreibung?: string;
    profilbild?: string;
  };
}

export interface Standorte {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    anbieter?: string; // applookup -> URL zu 'Anbieterprofil' Record
    standort_name?: string;
    strasse?: string;
    hausnummer?: string;
    plz?: string;
    stadt?: string;
    geo_koordinaten?: GeoLocation; // { lat, long, info }
    beschreibung?: string;
    kontakt_telefon?: string;
    kontakt_email?: string;
  };
}

export interface Timeslots {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    anbieter?: string; // applookup -> URL zu 'Anbieterprofil' Record
    titel?: string;
    standort?: string; // applookup -> URL zu 'Standorte' Record
    startzeit?: string; // Format: YYYY-MM-DD oder ISO String
    endzeit?: string; // Format: YYYY-MM-DD oder ISO String
    dauer?: number;
    max_kapazitaet?: number;
    status?: LookupValue;
    hinweise?: string;
    online_termin?: boolean;
    online_link?: string;
  };
}

export interface Terminbuchung {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    timeslot?: string; // applookup -> URL zu 'Timeslots' Record
    buchungsart?: LookupValue;
    vorname?: string;
    nachname?: string;
    email?: string;
    telefon?: string;
    nachricht?: string;
    datenschutz_zustimmung?: boolean;
  };
}

export const APP_IDS = {
  ANBIETERPROFIL: '69e5efc19f07aefeba0ed3e3',
  STANDORTE: '69e5efc727cb16c4ee8dd8ae',
  TIMESLOTS: '69e5efc9877ad990dac1181f',
  TERMINBUCHUNG: '69e5efcbcd9a65bfa1fb08bb',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {
  'timeslots': {
    status: [{ key: "inaktiv", label: "Inaktiv (nicht buchbar)" }, { key: "ausgebucht", label: "Ausgebucht" }, { key: "aktiv", label: "Aktiv (buchbar)" }],
  },
  'terminbuchung': {
    buchungsart: [{ key: "buchung", label: "Verbindliche Buchung" }, { key: "reservierung", label: "Reservierung" }],
  },
};

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  'anbieterprofil': {
    'vorname': 'string/text',
    'nachname': 'string/text',
    'email': 'string/email',
    'telefon': 'string/tel',
    'beschreibung': 'string/textarea',
    'profilbild': 'file',
  },
  'standorte': {
    'anbieter': 'applookup/select',
    'standort_name': 'string/text',
    'strasse': 'string/text',
    'hausnummer': 'string/text',
    'plz': 'string/text',
    'stadt': 'string/text',
    'geo_koordinaten': 'geo',
    'beschreibung': 'string/textarea',
    'kontakt_telefon': 'string/tel',
    'kontakt_email': 'string/email',
  },
  'timeslots': {
    'anbieter': 'applookup/select',
    'titel': 'string/text',
    'standort': 'applookup/select',
    'startzeit': 'date/datetimeminute',
    'endzeit': 'date/datetimeminute',
    'dauer': 'number',
    'max_kapazitaet': 'number',
    'status': 'lookup/radio',
    'hinweise': 'string/textarea',
    'online_termin': 'bool',
    'online_link': 'string/url',
  },
  'terminbuchung': {
    'timeslot': 'applookup/select',
    'buchungsart': 'lookup/radio',
    'vorname': 'string/text',
    'nachname': 'string/text',
    'email': 'string/email',
    'telefon': 'string/tel',
    'nachricht': 'string/textarea',
    'datenschutz_zustimmung': 'bool',
  },
};

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateAnbieterprofil = StripLookup<Anbieterprofil['fields']>;
export type CreateStandorte = StripLookup<Standorte['fields']>;
export type CreateTimeslots = StripLookup<Timeslots['fields']>;
export type CreateTerminbuchung = StripLookup<Terminbuchung['fields']>;