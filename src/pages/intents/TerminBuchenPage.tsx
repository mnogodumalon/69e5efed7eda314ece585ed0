import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Anbieterprofil, Standorte, Timeslots, Terminbuchung } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { EntitySelectStep } from '@/components/EntitySelectStep';
import { StatusBadge } from '@/components/StatusBadge';
import { TerminbuchungDialog } from '@/components/dialogs/TerminbuchungDialog';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  IconUser,
  IconCalendar,
  IconClock,
  IconCheck,
  IconMapPin,
  IconArrowLeft,
  IconRefresh,
} from '@tabler/icons-react';

const WIZARD_STEPS = [
  { label: 'Anbieter' },
  { label: 'Termin' },
  { label: 'Buchung' },
  { label: 'Bestätigung' },
];

function formatDateTime(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  try {
    return format(new Date(dateStr), 'dd.MM.yyyy HH:mm', { locale: de });
  } catch {
    return dateStr;
  }
}

function calcDurationMinutes(start: string | undefined, end: string | undefined): number | null {
  if (!start || !end) return null;
  try {
    const diff = new Date(end).getTime() - new Date(start).getTime();
    return Math.round(diff / 60000);
  } catch {
    return null;
  }
}

export default function TerminBuchenPage() {
  const [searchParams] = useSearchParams();

  // Data state
  const [anbieterprofil, setAnbieterprofil] = useState<Anbieterprofil[]>([]);
  const [standorte, setStandorte] = useState<Standorte[]>([]);
  const [timeslots, setTimeslots] = useState<Timeslots[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Wizard state
  const initialStep = (() => {
    const s = parseInt(searchParams.get('step') ?? '1', 10);
    return s >= 1 && s <= 4 ? s : 1;
  })();
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [selectedAnbieterId, setSelectedAnbieterId] = useState<string | null>(
    searchParams.get('anbieterId') ?? null
  );
  const [selectedTimeslot, setSelectedTimeslot] = useState<Timeslots | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createdBuchung, setCreatedBuchung] = useState<Terminbuchung | null>(null);
  const [anbieterDialogOpen, setAnbieterDialogOpen] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [anbieterData, standorteData, timeslotsData] = await Promise.all([
        LivingAppsService.getAnbieterprofil(),
        LivingAppsService.getStandorte(),
        LivingAppsService.getTimeslots(),
      ]);
      setAnbieterprofil(anbieterData);
      setStandorte(standorteData);
      setTimeslots(timeslotsData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Fehler beim Laden der Daten'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // If anbieterId is in URL and we're past step 1, ensure we can show step 2
  useEffect(() => {
    if (selectedAnbieterId && currentStep === 1) {
      setCurrentStep(2);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Derived data
  const standorteMap = new Map<string, Standorte>(standorte.map(s => [s.record_id, s]));

  const selectedAnbieter = anbieterprofil.find(a => a.record_id === selectedAnbieterId) ?? null;

  const availableTimeslots = timeslots.filter(t => {
    if (!selectedAnbieterId) return false;
    const anbieterIdFromTimeslot = extractRecordId(t.fields.anbieter);
    if (anbieterIdFromTimeslot !== selectedAnbieterId) return false;
    if (t.fields.status?.key === 'ausgebucht') return false;
    return true;
  });

  function handleAnbieterSelect(id: string) {
    setSelectedAnbieterId(id);
    setSelectedTimeslot(null);
    setCurrentStep(2);
  }

  function handleTimeslotSelect(timeslot: Timeslots) {
    setSelectedTimeslot(timeslot);
    setCurrentStep(3);
    setDialogOpen(true);
  }

  function handleGoToStep(step: number) {
    setCurrentStep(step);
  }

  function handleReset() {
    setSelectedAnbieterId(null);
    setSelectedTimeslot(null);
    setCreatedBuchung(null);
    setDialogOpen(false);
    setCurrentStep(1);
  }

  // Step 3: when step changes to 3, open dialog
  useEffect(() => {
    if (currentStep === 3 && selectedTimeslot) {
      setDialogOpen(true);
    }
  }, [currentStep, selectedTimeslot]);

  // Step 1: Anbieter wählen
  const renderStep1 = () => (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Anbieter auswählen</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Wähle einen Anbieter aus, bei dem du einen Termin buchen möchtest.
        </p>
      </div>
      <EntitySelectStep
        items={anbieterprofil.map(a => ({
          id: a.record_id,
          title: [a.fields.vorname, a.fields.nachname].filter(Boolean).join(' ') || a.fields.email || a.record_id,
          subtitle: a.fields.beschreibung ?? a.fields.email ?? undefined,
          icon: <IconUser size={18} className="text-primary" />,
          stats: a.fields.telefon
            ? [{ label: 'Tel', value: a.fields.telefon }]
            : undefined,
        }))}
        onSelect={handleAnbieterSelect}
        searchPlaceholder="Anbieter suchen..."
        emptyIcon={<IconUser size={32} />}
        emptyText="Keine Anbieter gefunden."
        createLabel="Neuen Anbieter anlegen"
        onCreateNew={() => setAnbieterDialogOpen(true)}
        createDialog={
          anbieterDialogOpen ? (
            <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
              Anbieter-Erstellung ist nicht verfügbar — bitte wende dich an einen Administrator.
              <Button
                variant="ghost"
                size="sm"
                className="ml-2"
                onClick={() => setAnbieterDialogOpen(false)}
              >
                Schließen
              </Button>
            </div>
          ) : undefined
        }
      />
    </div>
  );

  // Step 2: Timeslot wählen
  const renderStep2 = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => handleGoToStep(1)}>
          <IconArrowLeft size={15} stroke={2} className="mr-1" />
          Zurück
        </Button>
        <div>
          <h2 className="text-lg font-semibold">Termin auswählen</h2>
          {selectedAnbieter && (
            <p className="text-sm text-muted-foreground">
              Anbieter:{' '}
              <span className="font-medium text-foreground">
                {[selectedAnbieter.fields.vorname, selectedAnbieter.fields.nachname]
                  .filter(Boolean)
                  .join(' ') || selectedAnbieter.fields.email}
              </span>
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{availableTimeslots.length}</span>{' '}
          {availableTimeslots.length === 1 ? 'verfügbarer Termin' : 'verfügbare Termine'}
        </p>
      </div>

      {availableTimeslots.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border rounded-xl">
          <IconCalendar size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">Keine verfügbaren Termine gefunden.</p>
          <p className="text-xs mt-1">Alle Timeslots sind entweder ausgebucht oder nicht verfügbar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {availableTimeslots.map(ts => {
            const standortId = extractRecordId(ts.fields.standort);
            const standort = standortId ? standorteMap.get(standortId) : undefined;
            const dauer = ts.fields.dauer ?? calcDurationMinutes(ts.fields.startzeit, ts.fields.endzeit);

            return (
              <button
                key={ts.record_id}
                onClick={() => handleTimeslotSelect(ts)}
                className="w-full text-left p-4 rounded-xl border bg-card hover:border-primary cursor-pointer transition-colors overflow-hidden"
              >
                <div className="flex items-start justify-between gap-2 min-w-0">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">
                      {ts.fields.titel ?? 'Termin'}
                    </p>
                    {ts.fields.status && (
                      <div className="mt-1">
                        <StatusBadge
                          statusKey={ts.fields.status.key}
                          label={ts.fields.status.label}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                  {ts.fields.startzeit && (
                    <div className="flex items-center gap-1.5">
                      <IconCalendar size={13} stroke={1.8} className="shrink-0" />
                      <span>{formatDateTime(ts.fields.startzeit)}</span>
                      {ts.fields.endzeit && (
                        <span className="text-muted-foreground/60">
                          – {formatDateTime(ts.fields.endzeit)}
                        </span>
                      )}
                    </div>
                  )}
                  {dauer != null && (
                    <div className="flex items-center gap-1.5">
                      <IconClock size={13} stroke={1.8} className="shrink-0" />
                      <span>{dauer} Minuten</span>
                    </div>
                  )}
                  {standort?.fields.standort_name && (
                    <div className="flex items-center gap-1.5">
                      <IconMapPin size={13} stroke={1.8} className="shrink-0" />
                      <span className="truncate">{standort.fields.standort_name}</span>
                    </div>
                  )}
                  {ts.fields.max_kapazitaet != null && (
                    <div className="flex items-center gap-1.5">
                      <IconUser size={13} stroke={1.8} className="shrink-0" />
                      <span>Max. {ts.fields.max_kapazitaet} {ts.fields.max_kapazitaet === 1 ? 'Person' : 'Personen'}</span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  // Step 3: Buchungsdetails (Dialog)
  const renderStep3 = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => { setDialogOpen(false); handleGoToStep(2); }}>
          <IconArrowLeft size={15} stroke={2} className="mr-1" />
          Zurück
        </Button>
        <div>
          <h2 className="text-lg font-semibold">Buchungsdetails ausfüllen</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Vervollständige deine Buchungsangaben im Dialog.
          </p>
        </div>
      </div>

      {selectedTimeslot && (
        <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
          <p className="text-sm font-semibold">{selectedTimeslot.fields.titel ?? 'Termin'}</p>
          <div className="text-xs text-muted-foreground space-y-1">
            {selectedTimeslot.fields.startzeit && (
              <div className="flex items-center gap-1.5">
                <IconCalendar size={13} stroke={1.8} className="shrink-0" />
                <span>{formatDateTime(selectedTimeslot.fields.startzeit)}</span>
                {selectedTimeslot.fields.endzeit && (
                  <span>– {formatDateTime(selectedTimeslot.fields.endzeit)}</span>
                )}
              </div>
            )}
            {selectedAnbieter && (
              <div className="flex items-center gap-1.5">
                <IconUser size={13} stroke={1.8} className="shrink-0" />
                <span>
                  {[selectedAnbieter.fields.vorname, selectedAnbieter.fields.nachname]
                    .filter(Boolean)
                    .join(' ') || selectedAnbieter.fields.email}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      <Button
        className="w-full"
        onClick={() => setDialogOpen(true)}
      >
        <IconCalendar size={16} stroke={2} className="mr-2" />
        Buchungsdialog öffnen
      </Button>

      {selectedTimeslot && (
        <TerminbuchungDialog
          open={dialogOpen}
          onClose={() => { setDialogOpen(false); }}
          onSubmit={async (fields) => {
            const result = await LivingAppsService.createTerminbuchungEntry(fields);
            setCreatedBuchung(result as Terminbuchung);
            setDialogOpen(false);
            setCurrentStep(4);
          }}
          defaultValues={{
            timeslot: createRecordUrl(APP_IDS.TIMESLOTS, selectedTimeslot.record_id),
          }}
          timeslotsList={timeslots}
        />
      )}
    </div>
  );

  // Step 4: Bestätigung
  const renderStep4 = () => {
    const buchungsart = createdBuchung?.fields.buchungsart;
    const buchungsartLabel =
      typeof buchungsart === 'object' && buchungsart !== null && 'label' in buchungsart
        ? buchungsart.label
        : typeof buchungsart === 'string'
        ? buchungsart
        : undefined;

    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center text-center py-6 gap-4">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <IconCheck size={32} stroke={2.5} className="text-green-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Buchung erfolgreich!</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Dein Termin wurde erfolgreich gebucht.
            </p>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5 space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Buchungsdetails
          </h3>
          <div className="space-y-2 text-sm">
            {selectedAnbieter && (
              <div className="flex items-start gap-2">
                <IconUser size={15} stroke={1.8} className="text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Anbieter</p>
                  <p className="font-medium truncate">
                    {[selectedAnbieter.fields.vorname, selectedAnbieter.fields.nachname]
                      .filter(Boolean)
                      .join(' ') || selectedAnbieter.fields.email}
                  </p>
                </div>
              </div>
            )}
            {selectedTimeslot && (
              <>
                <div className="flex items-start gap-2">
                  <IconCalendar size={15} stroke={1.8} className="text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Termin</p>
                    <p className="font-medium truncate">{selectedTimeslot.fields.titel ?? 'Termin'}</p>
                  </div>
                </div>
                {selectedTimeslot.fields.startzeit && (
                  <div className="flex items-start gap-2">
                    <IconClock size={15} stroke={1.8} className="text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Zeitraum</p>
                      <p className="font-medium">
                        {formatDateTime(selectedTimeslot.fields.startzeit)}
                        {selectedTimeslot.fields.endzeit && (
                          <span className="text-muted-foreground"> – {formatDateTime(selectedTimeslot.fields.endzeit)}</span>
                        )}
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
            {buchungsartLabel && (
              <div className="flex items-start gap-2">
                <IconCheck size={15} stroke={1.8} className="text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Buchungsart</p>
                  <p className="font-medium">{buchungsartLabel}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button variant="outline" className="flex-1" onClick={handleReset}>
            <IconRefresh size={16} stroke={2} className="mr-2" />
            Weiteren Termin buchen
          </Button>
          <Button className="flex-1" asChild>
            <a href="#/terminbuchung">
              Zu meinen Buchungen
            </a>
          </Button>
        </div>
      </div>
    );
  };

  return (
    <IntentWizardShell
      title="Termin buchen"
      subtitle="Wähle einen Anbieter und buche deinen Wunschtermin in wenigen Schritten."
      steps={WIZARD_STEPS}
      currentStep={currentStep}
      onStepChange={setCurrentStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {currentStep === 1 && renderStep1()}
      {currentStep === 2 && renderStep2()}
      {currentStep === 3 && renderStep3()}
      {currentStep === 4 && renderStep4()}
    </IntentWizardShell>
  );
}
