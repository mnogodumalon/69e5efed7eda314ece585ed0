import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Anbieterprofil, Standorte, Timeslots } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { EntitySelectStep } from '@/components/EntitySelectStep';
import { AnbieterprofilDialog } from '@/components/dialogs/AnbieterprofilDialog';
import { StandorteDialog } from '@/components/dialogs/StandorteDialog';
import { TimeslotsDialog } from '@/components/dialogs/TimeslotsDialog';
import { Button } from '@/components/ui/button';
import {
  IconUser,
  IconMapPin,
  IconCalendar,
  IconCheck,
  IconArrowRight,
  IconPlus,
  IconRefresh,
} from '@tabler/icons-react';

const WIZARD_STEPS = [
  { label: 'Anbieter' },
  { label: 'Standort' },
  { label: 'Timeslot' },
  { label: 'Fertig' },
];

export default function TimeslotErstellenPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize step from URL (1-based)
  const initialStep = (() => {
    const s = parseInt(searchParams.get('step') ?? '1', 10);
    return s >= 1 && s <= 4 ? s : 1;
  })();
  const initialAnbieterId = searchParams.get('anbieterId') ?? null;

  const [currentStep, setCurrentStep] = useState(initialStep);
  const [anbieterprofil, setAnbieterprofil] = useState<Anbieterprofil[]>([]);
  const [standorte, setStandorte] = useState<Standorte[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const [selectedAnbieterId, setSelectedAnbieterId] = useState<string | null>(initialAnbieterId);
  const [selectedStandortId, setSelectedStandortId] = useState<string | null>(null);
  const [createdTimeslot, setCreatedTimeslot] = useState<Timeslots | null>(null);

  const [anbieterDialogOpen, setAnbieterDialogOpen] = useState(false);
  const [standortDialogOpen, setStandortDialogOpen] = useState(false);
  const [timeslotDialogOpen, setTimeslotDialogOpen] = useState(false);

  const fetchAnbieter = useCallback(async () => {
    const data = await LivingAppsService.getAnbieterprofil();
    setAnbieterprofil(data);
  }, []);

  const fetchStandorte = useCallback(async () => {
    const data = await LivingAppsService.getStandorte();
    setStandorte(data);
  }, []);

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const [anbieterData, standorteData] = await Promise.all([
        LivingAppsService.getAnbieterprofil(),
        LivingAppsService.getStandorte(),
      ]);
      setAnbieterprofil(anbieterData);
      setStandorte(standorteData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Fehler beim Laden der Daten'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  // Sync currentStep to URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (currentStep > 1) {
      params.set('step', String(currentStep));
    } else {
      params.delete('step');
    }
    if (selectedAnbieterId) {
      params.set('anbieterId', selectedAnbieterId);
    } else {
      params.delete('anbieterId');
    }
    setSearchParams(params, { replace: true });
  }, [currentStep, selectedAnbieterId, searchParams, setSearchParams]);

  const goToStep = (step: number) => {
    setCurrentStep(step);
  };

  const handleAnbieterSelect = (id: string) => {
    setSelectedAnbieterId(id);
    setSelectedStandortId(null);
    goToStep(2);
  };

  const handleStandortSelect = (id: string) => {
    setSelectedStandortId(id);
    goToStep(3);
  };

  // Open TimeslotsDialog when arriving at step 3
  useEffect(() => {
    if (currentStep === 3 && selectedAnbieterId && selectedStandortId) {
      setTimeslotDialogOpen(true);
    }
  }, [currentStep, selectedAnbieterId, selectedStandortId]);

  const filteredStandorte = standorte.filter((s) => {
    const anbieterRecordId = extractRecordId(s.fields.anbieter);
    return anbieterRecordId === selectedAnbieterId;
  });

  const selectedAnbieter = anbieterprofil.find((a) => a.record_id === selectedAnbieterId);
  const selectedStandort = standorte.find((s) => s.record_id === selectedStandortId);

  const handleReset = () => {
    setSelectedAnbieterId(null);
    setSelectedStandortId(null);
    setCreatedTimeslot(null);
    setTimeslotDialogOpen(false);
    goToStep(1);
  };

  const formatDatetime = (dt: string | undefined) => {
    if (!dt) return '—';
    try {
      const d = new Date(dt);
      return d.toLocaleString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dt;
    }
  };

  return (
    <>
      <IntentWizardShell
        title="Neuen Timeslot erstellen"
        subtitle="Wähle einen Anbieter, dann einen Standort und konfiguriere deinen Timeslot."
        steps={WIZARD_STEPS}
        currentStep={currentStep}
        onStepChange={setCurrentStep}
        loading={loading}
        error={error}
        onRetry={fetchAll}
      >
        {/* Schritt 1 — Anbieter wählen */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Anbieter wählen</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Wähle das Anbieterprofil aus, dem der neue Timeslot zugeordnet werden soll.
              </p>
            </div>
            <EntitySelectStep
              items={anbieterprofil.map((a) => ({
                id: a.record_id,
                title: [a.fields.vorname, a.fields.nachname].filter(Boolean).join(' ') || a.record_id,
                subtitle: a.fields.email ?? undefined,
                stats: a.fields.telefon ? [{ label: 'Tel', value: a.fields.telefon }] : [],
                icon: <IconUser size={18} className="text-primary" />,
              }))}
              onSelect={handleAnbieterSelect}
              searchPlaceholder="Anbieter suchen..."
              emptyIcon={<IconUser size={32} />}
              emptyText="Noch kein Anbieterprofil vorhanden. Lege jetzt ein neues an."
              createLabel="Neuen Anbieter anlegen"
              onCreateNew={() => setAnbieterDialogOpen(true)}
              createDialog={
                <AnbieterprofilDialog
                  open={anbieterDialogOpen}
                  onClose={() => setAnbieterDialogOpen(false)}
                  onSubmit={async (fields) => {
                    await LivingAppsService.createAnbieterprofilEntry(fields);
                    await fetchAnbieter();
                  }}
                  defaultValues={undefined}
                />
              }
            />
          </div>
        )}

        {/* Schritt 2 — Standort wählen */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Standort wählen</h2>
              {selectedAnbieter && (
                <p className="text-sm text-muted-foreground mt-1">
                  Wähle einen Standort von{' '}
                  <span className="font-medium text-foreground">
                    {[selectedAnbieter.fields.vorname, selectedAnbieter.fields.nachname]
                      .filter(Boolean)
                      .join(' ')}
                  </span>
                  .
                </p>
              )}
            </div>
            <EntitySelectStep
              items={filteredStandorte.map((s) => ({
                id: s.record_id,
                title: s.fields.standort_name ?? s.record_id,
                subtitle: [
                  s.fields.strasse,
                  s.fields.hausnummer,
                  s.fields.plz && s.fields.stadt
                    ? `${s.fields.plz} ${s.fields.stadt}`
                    : s.fields.plz ?? s.fields.stadt,
                ]
                  .filter(Boolean)
                  .join(', '),
                icon: <IconMapPin size={18} className="text-primary" />,
              }))}
              onSelect={handleStandortSelect}
              searchPlaceholder="Standort suchen..."
              emptyIcon={<IconMapPin size={32} />}
              emptyText={
                selectedAnbieter
                  ? `Noch kein Standort für ${[selectedAnbieter.fields.vorname, selectedAnbieter.fields.nachname].filter(Boolean).join(' ')} vorhanden. Lege jetzt einen neuen an.`
                  : 'Noch kein Standort vorhanden.'
              }
              createLabel="Neuen Standort anlegen"
              onCreateNew={() => setStandortDialogOpen(true)}
              createDialog={
                <StandorteDialog
                  open={standortDialogOpen}
                  onClose={() => setStandortDialogOpen(false)}
                  onSubmit={async (fields) => {
                    await LivingAppsService.createStandorteEntry(fields);
                    await fetchStandorte();
                  }}
                  defaultValues={
                    selectedAnbieterId
                      ? { anbieter: createRecordUrl(APP_IDS.ANBIETERPROFIL, selectedAnbieterId) }
                      : undefined
                  }
                  anbieterprofilList={anbieterprofil}
                />
              }
            />
            <div className="pt-2">
              <Button
                variant="outline"
                onClick={() => goToStep(1)}
                className="gap-2"
              >
                Anbieter wechseln
              </Button>
            </div>
          </div>
        )}

        {/* Schritt 3 — Timeslot konfigurieren */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Timeslot konfigurieren</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Fülle die Details für deinen neuen Timeslot aus.
              </p>
            </div>

            {/* Zusammenfassung der Auswahl */}
            <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
              {selectedAnbieter && (
                <div className="flex items-center gap-2 text-sm">
                  <IconUser size={15} className="text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Anbieter:</span>
                  <span className="font-medium truncate">
                    {[selectedAnbieter.fields.vorname, selectedAnbieter.fields.nachname]
                      .filter(Boolean)
                      .join(' ')}
                  </span>
                </div>
              )}
              {selectedStandort && (
                <div className="flex items-center gap-2 text-sm">
                  <IconMapPin size={15} className="text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Standort:</span>
                  <span className="font-medium truncate">
                    {selectedStandort.fields.standort_name ?? selectedStandortId}
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={() => setTimeslotDialogOpen(true)}
                className="gap-2"
              >
                <IconCalendar size={16} stroke={2} />
                Timeslot-Formular öffnen
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedStandortId(null);
                  goToStep(2);
                }}
                className="gap-2"
              >
                Standort wechseln
              </Button>
            </div>

            {selectedAnbieterId && selectedStandortId && (
              <TimeslotsDialog
                open={timeslotDialogOpen}
                onClose={() => {
                  setTimeslotDialogOpen(false);
                  // Falls Dialog geschlossen wird ohne Submit — zurück zu Schritt 2
                  if (!createdTimeslot) {
                    goToStep(2);
                  }
                }}
                onSubmit={async (fields) => {
                  const result = await LivingAppsService.createTimeslot(fields);
                  // Build a minimal Timeslots object from the result
                  const newTimeslot: Timeslots = {
                    record_id: result?.id ?? result?.record_id ?? '',
                    createdat: new Date().toISOString(),
                    updatedat: null,
                    fields: fields as Timeslots['fields'],
                  };
                  setCreatedTimeslot(newTimeslot);
                  setTimeslotDialogOpen(false);
                  goToStep(4);
                }}
                defaultValues={{
                  anbieter: createRecordUrl(APP_IDS.ANBIETERPROFIL, selectedAnbieterId),
                  standort: createRecordUrl(APP_IDS.STANDORTE, selectedStandortId),
                }}
                anbieterprofilList={anbieterprofil}
                standorteList={standorte}
              />
            )}
          </div>
        )}

        {/* Schritt 4 — Zusammenfassung / Erfolg */}
        {currentStep === 4 && createdTimeslot && (
          <div className="space-y-6">
            {/* Erfolgs-Header */}
            <div className="flex flex-col items-center text-center py-6 gap-3">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <IconCheck size={28} stroke={2.5} className="text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Timeslot erfolgreich erstellt!</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Dein neuer Timeslot wurde angelegt und ist bereit.
                </p>
              </div>
            </div>

            {/* Timeslot-Details */}
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="p-4 border-b bg-muted/30">
                <div className="flex items-center gap-2">
                  <IconCalendar size={18} className="text-primary" />
                  <span className="font-semibold text-sm">
                    {createdTimeslot.fields.titel ?? 'Neuer Timeslot'}
                  </span>
                </div>
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                      Startzeit
                    </p>
                    <p className="font-medium">{formatDatetime(createdTimeslot.fields.startzeit)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                      Endzeit
                    </p>
                    <p className="font-medium">{formatDatetime(createdTimeslot.fields.endzeit)}</p>
                  </div>
                  {createdTimeslot.fields.max_kapazitaet != null && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                        Max. Kapazität
                      </p>
                      <p className="font-medium">{createdTimeslot.fields.max_kapazitaet} Plätze</p>
                    </div>
                  )}
                  {selectedStandort && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                        Standort
                      </p>
                      <p className="font-medium truncate">
                        {selectedStandort.fields.standort_name ?? selectedStandortId}
                      </p>
                    </div>
                  )}
                  {selectedAnbieter && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                        Anbieter
                      </p>
                      <p className="font-medium truncate">
                        {[selectedAnbieter.fields.vorname, selectedAnbieter.fields.nachname]
                          .filter(Boolean)
                          .join(' ')}
                      </p>
                    </div>
                  )}
                  {createdTimeslot.fields.dauer != null && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                        Dauer
                      </p>
                      <p className="font-medium">{createdTimeslot.fields.dauer} Minuten</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Aktionen */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={handleReset} variant="outline" className="gap-2">
                <IconRefresh size={16} stroke={2} />
                Weiteren Timeslot anlegen
              </Button>
              <a href="#/timeslots">
                <Button className="gap-2 w-full sm:w-auto">
                  <IconArrowRight size={16} stroke={2} />
                  Zu Timeslots
                </Button>
              </a>
            </div>
          </div>
        )}

        {/* Schritt 4 ohne createdTimeslot (Fallback) */}
        {currentStep === 4 && !createdTimeslot && (
          <div className="text-center py-12 space-y-4">
            <p className="text-muted-foreground text-sm">
              Es wurde kein Timeslot erstellt. Starte den Prozess neu.
            </p>
            <Button onClick={handleReset} variant="outline" className="gap-2">
              <IconPlus size={16} stroke={2} />
              Neu starten
            </Button>
          </div>
        )}
      </IntentWizardShell>
    </>
  );
}
