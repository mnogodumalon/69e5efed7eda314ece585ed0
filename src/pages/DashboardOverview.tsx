import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichStandorte, enrichTimeslots, enrichTerminbuchung } from '@/lib/enrich';
import type { EnrichedTimeslots, EnrichedTerminbuchung } from '@/types/enriched';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { formatDate } from '@/lib/formatters';
import { useState, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { IconAlertCircle, IconTool, IconRefresh, IconCheck, IconPlus, IconPencil, IconTrash, IconCalendar, IconClock, IconMapPin, IconUsers, IconVideo, IconX, IconChevronLeft, IconChevronRight, IconCircleCheck, IconCircleX, IconClockOff } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/StatCard';
import { TimeslotsDialog } from '@/components/dialogs/TimeslotsDialog';
import { TerminbuchungDialog } from '@/components/dialogs/TerminbuchungDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AI_PHOTO_SCAN } from '@/config/ai-features';
import { format, parseISO, startOfWeek, addDays, isSameDay, isToday, addWeeks, subWeeks } from 'date-fns';
import { de } from 'date-fns/locale';

const APPGROUP_ID = '69e5efed7eda314ece585ed0';
const REPAIR_ENDPOINT = '/claude/build/repair';

const HOUR_START = 8;
const HOUR_END = 20;
const HOUR_HEIGHT = 48; // px per hour
const HOURS = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => i + HOUR_START);

// Computes column layout for overlapping timeslots within a day
function computeSlotLayout(slots: Array<{ id: string; startH: number; endH: number }>): Map<string, { col: number; totalCols: number }> {
  const result = new Map<string, { col: number; totalCols: number }>();
  if (slots.length === 0) return result;
  const sorted = [...slots].sort((a, b) => a.startH - b.startH || b.endH - a.endH);
  const columns: Array<typeof sorted> = [];
  for (const slot of sorted) {
    let placed = false;
    for (let c = 0; c < columns.length; c++) {
      if (!columns[c].some(s => slot.startH < s.endH && s.startH < slot.endH)) {
        columns[c].push(slot); placed = true; break;
      }
    }
    if (!placed) columns.push([slot]);
  }
  const totalCols = columns.length;
  for (let c = 0; c < columns.length; c++)
    for (const s of columns[c]) result.set(s.id, { col: c, totalCols });
  return result;
}

export default function DashboardOverview() {
  const {
    anbieterprofil, standorte, timeslots, terminbuchung,
    anbieterprofilMap, standorteMap, timeslotsMap,
    loading, error, fetchAll,
  } = useDashboardData();

  const enrichedStandorte = enrichStandorte(standorte, { anbieterprofilMap });
  const enrichedTimeslots = enrichTimeslots(timeslots, { anbieterprofilMap, standorteMap });
  const enrichedTerminbuchung = enrichTerminbuchung(terminbuchung, { timeslotsMap });

  // --- State (ALL hooks before early returns) ---
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedTimeslot, setSelectedTimeslot] = useState<EnrichedTimeslots | null>(null);
  const [timeslotDialogOpen, setTimeslotDialogOpen] = useState(false);
  const [editTimeslot, setEditTimeslot] = useState<EnrichedTimeslots | null>(null);
  const [deleteTimeslot, setDeleteTimeslot] = useState<EnrichedTimeslots | null>(null);
  const [buchungDialogOpen, setBuchungDialogOpen] = useState(false);
  const [editBuchung, setEditBuchung] = useState<EnrichedTerminbuchung | null>(null);
  const [deleteBuchung, setDeleteBuchung] = useState<EnrichedTerminbuchung | null>(null);
  const [selectedAnbieterId, setSelectedAnbieterId] = useState<string | null>(null);
  const [foregroundId, setForegroundId] = useState<string | null>(null);

  // Unique providers that actually have timeslots
  const anbieterForFilter = useMemo(() => {
    const seen = new Map<string, string>();
    enrichedTimeslots.forEach(ts => {
      const id = extractRecordId(ts.fields.anbieter);
      if (id && !seen.has(id)) {
        const anbieter = anbieterprofil.find(a => a.record_id === id);
        const vorname = anbieter?.fields.vorname ?? ts.anbieterName ?? id;
        seen.set(id, vorname);
      }
    });
    return Array.from(seen.entries()).map(([id, vorname]) => ({ id, vorname }));
  }, [enrichedTimeslots, anbieterprofil]);

  // Filtered timeslots for calendar + upcoming list
  const filteredTimeslots = useMemo(() => {
    if (!selectedAnbieterId) return enrichedTimeslots;
    return enrichedTimeslots.filter(ts => extractRecordId(ts.fields.anbieter) === selectedAnbieterId);
  }, [enrichedTimeslots, selectedAnbieterId]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  }, [currentWeekStart]);

  const timeslotsThisWeek = useMemo(() => {
    return filteredTimeslots.filter(ts => {
      if (!ts.fields.startzeit) return false;
      try {
        const d = parseISO(ts.fields.startzeit);
        return weekDays.some(day => isSameDay(d, day));
      } catch { return false; }
    });
  }, [enrichedTimeslots, weekDays]);

  const buchungenByTimeslot = useMemo(() => {
    const map = new Map<string, EnrichedTerminbuchung[]>();
    enrichedTerminbuchung.forEach(b => {
      const tsId = extractRecordId(b.fields.timeslot);
      if (!tsId) return;
      if (!map.has(tsId)) map.set(tsId, []);
      map.get(tsId)!.push(b);
    });
    return map;
  }, [enrichedTerminbuchung]);

  // KPI stats
  const totalTimeslots = timeslots.length;
  const activeTimeslots = timeslots.filter(ts => ts.fields.status?.key === 'aktiv').length;
  const totalBuchungen = terminbuchung.length;
  const todayTimeslots = enrichedTimeslots.filter(ts => {
    if (!ts.fields.startzeit) return false;
    try { return isToday(parseISO(ts.fields.startzeit)); } catch { return false; }
  }).length;

  const selectedBuchungen = selectedTimeslot
    ? (buchungenByTimeslot.get(selectedTimeslot.record_id) ?? [])
    : [];

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  const handleTimeslotCreate = async (fields: any) => {
    await LivingAppsService.createTimeslot(fields);
    fetchAll();
  };

  const handleTimeslotUpdate = async (fields: any) => {
    if (!editTimeslot) return;
    await LivingAppsService.updateTimeslot(editTimeslot.record_id, fields);
    fetchAll();
  };

  const handleTimeslotDelete = async () => {
    if (!deleteTimeslot) return;
    await LivingAppsService.deleteTimeslot(deleteTimeslot.record_id);
    if (selectedTimeslot?.record_id === deleteTimeslot.record_id) setSelectedTimeslot(null);
    setDeleteTimeslot(null);
    fetchAll();
  };

  const handleBuchungCreate = async (fields: any) => {
    await LivingAppsService.createTerminbuchungEntry(fields);
    fetchAll();
  };

  const handleBuchungUpdate = async (fields: any) => {
    if (!editBuchung) return;
    await LivingAppsService.updateTerminbuchungEntry(editBuchung.record_id, fields);
    fetchAll();
  };

  const handleBuchungDelete = async () => {
    if (!deleteBuchung) return;
    await LivingAppsService.deleteTerminbuchungEntry(deleteBuchung.record_id);
    setDeleteBuchung(null);
    fetchAll();
  };

  const statusBadge = (ts: EnrichedTimeslots) => {
    const key = ts.fields.status?.key;
    if (key === 'aktiv') return <Badge className="bg-green-100 text-green-800 border-green-200 text-xs shrink-0">Aktiv</Badge>;
    if (key === 'ausgebucht') return <Badge className="bg-orange-100 text-orange-800 border-orange-200 text-xs shrink-0">Ausgebucht</Badge>;
    return <Badge className="bg-gray-100 text-gray-600 border-gray-200 text-xs shrink-0">Inaktiv</Badge>;
  };

  const formatTime = (dt: string | undefined) => {
    if (!dt) return '–';
    try { return format(parseISO(dt), 'HH:mm'); } catch { return dt; }
  };

  const prevWeek = () => setCurrentWeekStart(w => subWeeks(w, 1));
  const nextWeek = () => setCurrentWeekStart(w => addWeeks(w, 1));
  const goToday = () => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

  return (
    <div className="space-y-6">
      {/* Workflow Navigation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <a href="#/intents/timeslot-erstellen" className="block bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-primary group overflow-hidden">
          <div className="flex items-center gap-3 min-w-0">
            <IconCalendar size={20} className="text-primary shrink-0" stroke={1.8} />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">Neuen Timeslot erstellen</p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">Anbieter wählen, Standort festlegen und Timeslot anlegen</p>
            </div>
            <IconChevronRight size={16} className="text-muted-foreground shrink-0 group-hover:text-primary transition-colors" stroke={2} />
          </div>
        </a>
        <a href="#/intents/termin-buchen" className="block bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-primary group overflow-hidden">
          <div className="flex items-center gap-3 min-w-0">
            <IconUsers size={20} className="text-primary shrink-0" stroke={1.8} />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">Termin buchen</p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">Anbieter auswählen, Termin finden und Buchung abschließen</p>
            </div>
            <IconChevronRight size={16} className="text-muted-foreground shrink-0 group-hover:text-primary transition-colors" stroke={2} />
          </div>
        </a>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Termine gesamt"
          value={String(totalTimeslots)}
          description="Alle Timeslots"
          icon={<IconCalendar size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Aktiv buchbar"
          value={String(activeTimeslots)}
          description="Offene Slots"
          icon={<IconCircleCheck size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Buchungen"
          value={String(totalBuchungen)}
          description="Insgesamt"
          icon={<IconUsers size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Heute"
          value={String(todayTimeslots)}
          description="Termine heute"
          icon={<IconClock size={18} className="text-muted-foreground" />}
        />
      </div>

      {/* Anbieter-Filterleiste */}
      {anbieterForFilter.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setSelectedAnbieterId(null)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
              selectedAnbieterId === null
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-muted-foreground border-border hover:bg-muted'
            }`}
          >
            Alle
          </button>
          {anbieterForFilter.map(a => (
            <button
              key={a.id}
              onClick={() => setSelectedAnbieterId(selectedAnbieterId === a.id ? null : a.id)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                selectedAnbieterId === a.id
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground border-border hover:bg-muted'
              }`}
            >
              {a.vorname}
            </button>
          ))}
        </div>
      )}

      {/* Main workspace: Weekly calendar + detail panel */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Weekly Calendar */}
        <div className="flex-1 min-w-0 bg-card border rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <button onClick={prevWeek} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
                <IconChevronLeft size={16} />
              </button>
              <span className="font-semibold text-sm">
                {format(currentWeekStart, 'dd. MMM', { locale: de })} – {format(addDays(currentWeekStart, 6), 'dd. MMM yyyy', { locale: de })}
              </span>
              <button onClick={nextWeek} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
                <IconChevronRight size={16} />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={goToday}>Heute</Button>
              <Button size="sm" onClick={() => { setEditTimeslot(null); setTimeslotDialogOpen(true); }}>
                <IconPlus size={14} className="mr-1 shrink-0" />
                <span className="hidden sm:inline">Neuer Termin</span>
                <span className="sm:hidden">Neu</span>
              </Button>
            </div>
          </div>

          {/* Time grid */}
          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
              {/* Day headers */}
              <div className="flex border-b">
                <div className="w-10 shrink-0" />
                {weekDays.map(day => {
                  const today = isToday(day);
                  return (
                    <div key={day.toISOString()} className={`flex-1 min-w-0 text-center py-2 border-l ${today ? 'bg-primary/5' : ''}`}>
                      <div className={`text-xs font-medium ${today ? 'text-primary' : 'text-muted-foreground'}`}>
                        {format(day, 'EEE', { locale: de })}
                      </div>
                      <div className={`text-sm font-bold mt-0.5 ${today ? 'text-primary' : 'text-foreground'}`}>
                        {format(day, 'd')}
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Time body */}
              <div className="flex overflow-y-auto" style={{ height: 400 }}>
                {/* Hour labels */}
                <div className="w-10 shrink-0 relative" style={{ height: HOURS.length * HOUR_HEIGHT }}>
                  {HOURS.map(h => (
                    <div key={h} className="absolute left-0 right-0 flex justify-end pr-1.5" style={{ top: (h - HOUR_START) * HOUR_HEIGHT - 7 }}>
                      <span className="text-[9px] text-muted-foreground/60 font-medium">{h}:00</span>
                    </div>
                  ))}
                </div>
                {/* Day columns */}
                <div className="flex flex-1 min-w-0" style={{ height: HOURS.length * HOUR_HEIGHT }}>
                  {weekDays.map(day => {
                    const daySlots = timeslotsThisWeek.filter(ts => {
                      if (!ts.fields.startzeit) return false;
                      try { return isSameDay(parseISO(ts.fields.startzeit), day); } catch { return false; }
                    });
                    const today = isToday(day);
                    return (
                      <div key={day.toISOString()} className={`flex-1 min-w-0 border-l relative ${today ? 'bg-primary/5' : ''}`}>
                        {/* Hour grid lines */}
                        {HOURS.map(h => (
                          <div key={h} className="absolute left-0 right-0 border-t border-border/30" style={{ top: (h - HOUR_START) * HOUR_HEIGHT }} />
                        ))}
                        {/* Timeslots with overlap-aware layout */}
                        {(() => {
                          const slotTimes = daySlots.map(ts => {
                            let startH = HOUR_START, endH = HOUR_START + 1;
                            try {
                              const s = parseISO(ts.fields.startzeit!);
                              startH = s.getHours() + s.getMinutes() / 60;
                              if (ts.fields.endzeit) {
                                const e = parseISO(ts.fields.endzeit);
                                endH = e.getHours() + e.getMinutes() / 60;
                              } else { endH = startH + 1; }
                            } catch {}
                            return { ts, startH, endH };
                          });
                          const layout = computeSlotLayout(slotTimes.map(s => ({ id: s.ts.record_id, startH: s.startH, endH: s.endH })));
                          return slotTimes.map(({ ts, startH, endH }) => {
                            const isSelected = selectedTimeslot?.record_id === ts.record_id;
                            const buchungen = buchungenByTimeslot.get(ts.record_id) ?? [];
                            const statusKey = ts.fields.status?.key;
                            const borderColor =
                              statusKey === 'aktiv' ? 'border-l-green-500' :
                              statusKey === 'ausgebucht' ? 'border-l-orange-400' :
                              'border-l-gray-400';
                            const topPx = Math.max(0, (startH - HOUR_START) * HOUR_HEIGHT);
                            const heightPx = Math.max(24, (endH - startH) * HOUR_HEIGHT);
                            const { col, totalCols } = layout.get(ts.record_id) ?? { col: 0, totalCols: 1 };
                            const hasConflict = totalCols > 1;
                            const colW = 100 / totalCols;
                            // A slot is "front" if explicitly foregrounded OR default (col 0)
                            // but only when no other overlapping slot is the foreground
                            const conflictingFgExists = hasConflict && slotTimes.some(o =>
                              o.ts.record_id !== ts.record_id &&
                              o.ts.record_id === foregroundId &&
                              startH < o.endH && o.startH < endH
                            );
                            const isFront = !hasConflict ||
                              foregroundId === ts.record_id ||
                              (!conflictingFgExists && col === 0);
                            return (
                              <button
                                key={ts.record_id}
                                title={hasConflict && !isFront ? 'Klicken um in den Vordergrund zu bringen' : undefined}
                                onClick={() => {
                                  if (hasConflict && !isFront) {
                                    setForegroundId(ts.record_id);
                                    setSelectedTimeslot(ts);
                                  } else {
                                    setSelectedTimeslot(isSelected ? null : ts);
                                  }
                                }}
                                className={`absolute text-left rounded border-l-2 px-1 py-0.5 overflow-hidden transition-all ${borderColor} ${
                                  isSelected ? 'bg-primary/10 ring-1 ring-primary' :
                                  isFront ? 'bg-muted/60 hover:bg-muted' : 'bg-muted/40 hover:bg-muted/60'
                                }`}
                                style={{
                                  top: topPx + 1,
                                  height: Math.max(heightPx - 2, 20),
                                  left: `calc(${col * colW}% + 1px)`,
                                  right: `calc(${100 - (col + 1) * colW}% + 1px)`,
                                  zIndex: isFront ? 2 : 1,
                                  opacity: hasConflict && !isFront ? 0.5 : 1,
                                }}
                              >
                                <div className="text-[10px] font-semibold truncate text-foreground leading-tight">
                                  {ts.fields.titel || 'Termin'}
                                </div>
                                {heightPx >= 32 && (
                                  <div className="text-[9px] text-muted-foreground truncate leading-tight">
                                    {formatTime(ts.fields.startzeit)}
                                    {ts.fields.max_kapazitaet ? ` · ${buchungen.length}/${ts.fields.max_kapazitaet}` : ''}
                                  </div>
                                )}
                              </button>
                            );
                          });
                        })()}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Detail panel */}
        <div className="w-full lg:w-80 shrink-0">
          {selectedTimeslot ? (
            <TimeslotDetail
              key={selectedTimeslot.record_id}
              ts={selectedTimeslot}
              buchungen={selectedBuchungen}
              onEdit={() => { setEditTimeslot(selectedTimeslot); setTimeslotDialogOpen(true); }}
              onDelete={() => setDeleteTimeslot(selectedTimeslot)}
              onClose={() => setSelectedTimeslot(null)}
              onAddBuchung={() => { setEditBuchung(null); setBuchungDialogOpen(true); }}
              onEditBuchung={(b) => { setEditBuchung(b); setBuchungDialogOpen(true); }}
              onDeleteBuchung={(b) => setDeleteBuchung(b)}
              statusBadge={statusBadge}
              formatTime={formatTime}
            />
          ) : (
            <div className="bg-card border rounded-2xl p-6 h-full flex flex-col items-center justify-center text-center gap-3 min-h-[200px]">
              <IconCalendar size={36} className="text-muted-foreground/30" stroke={1.5} />
              <p className="text-sm text-muted-foreground">Wähle einen Termin aus dem Kalender, um Details und Buchungen zu sehen.</p>
            </div>
          )}
        </div>
      </div>

      {/* Upcoming timeslots list */}
      <UpcomingTimeslots
        enrichedTimeslots={filteredTimeslots}
        buchungenByTimeslot={buchungenByTimeslot}
        onSelect={setSelectedTimeslot}
        selectedId={selectedTimeslot?.record_id}
        statusBadge={statusBadge}
        formatTime={formatTime}
      />

      {/* Dialogs */}
      <TimeslotsDialog
        open={timeslotDialogOpen}
        onClose={() => { setTimeslotDialogOpen(false); setEditTimeslot(null); }}
        onSubmit={editTimeslot ? handleTimeslotUpdate : handleTimeslotCreate}
        defaultValues={editTimeslot?.fields}
        anbieterprofilList={anbieterprofil}
        standorteList={standorte}
        enablePhotoScan={AI_PHOTO_SCAN['Timeslots']}
      />

      <TerminbuchungDialog
        open={buchungDialogOpen}
        onClose={() => { setBuchungDialogOpen(false); setEditBuchung(null); }}
        onSubmit={editBuchung ? handleBuchungUpdate : handleBuchungCreate}
        defaultValues={editBuchung
          ? editBuchung.fields
          : selectedTimeslot
            ? { timeslot: createRecordUrl(APP_IDS.TIMESLOTS, selectedTimeslot.record_id) }
            : undefined
        }
        timeslotsList={timeslots}
        enablePhotoScan={AI_PHOTO_SCAN['Terminbuchung']}
      />

      <ConfirmDialog
        open={!!deleteTimeslot}
        title="Termin löschen"
        description={`Soll der Termin "${deleteTimeslot?.fields.titel ?? ''}" wirklich gelöscht werden?`}
        onConfirm={handleTimeslotDelete}
        onClose={() => setDeleteTimeslot(null)}
      />

      <ConfirmDialog
        open={!!deleteBuchung}
        title="Buchung löschen"
        description={`Soll die Buchung von "${deleteBuchung?.fields.vorname ?? ''} ${deleteBuchung?.fields.nachname ?? ''}" wirklich gelöscht werden?`}
        onConfirm={handleBuchungDelete}
        onClose={() => setDeleteBuchung(null)}
      />
    </div>
  );
}

// --- Timeslot Detail Panel ---
function TimeslotDetail({
  ts,
  buchungen,
  onEdit,
  onDelete,
  onClose,
  onAddBuchung,
  onEditBuchung,
  onDeleteBuchung,
  statusBadge,
  formatTime,
}: {
  ts: EnrichedTimeslots;
  buchungen: EnrichedTerminbuchung[];
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
  onAddBuchung: () => void;
  onEditBuchung: (b: EnrichedTerminbuchung) => void;
  onDeleteBuchung: (b: EnrichedTerminbuchung) => void;
  statusBadge: (ts: EnrichedTimeslots) => React.ReactNode;
  formatTime: (dt: string | undefined) => string;
}) {
  const PAGE_SIZE = 3;
  const [buchungPage, setBuchungPage] = useState(0);
  const totalPages = Math.ceil(buchungen.length / PAGE_SIZE);
  const pagedBuchungen = buchungen.slice(buchungPage * PAGE_SIZE, (buchungPage + 1) * PAGE_SIZE);

  return (
    <div className="bg-card border rounded-2xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 px-4 py-3 border-b bg-muted/30">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-sm truncate">{ts.fields.titel || 'Termin'}</h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {statusBadge(ts)}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground">
            <IconPencil size={14} />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-accent transition-colors text-destructive">
            <IconTrash size={14} />
          </button>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground">
            <IconX size={14} />
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="px-4 py-3 space-y-2 border-b text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <IconClock size={14} className="shrink-0" />
          <span>{formatTime(ts.fields.startzeit)} – {formatTime(ts.fields.endzeit)}</span>
          <span className="text-xs">({formatDate(ts.fields.startzeit?.slice(0, 10))})</span>
        </div>
        {ts.fields.online_termin ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <IconVideo size={14} className="shrink-0" />
            <span>Online-Termin</span>
          </div>
        ) : ts.standortName ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <IconMapPin size={14} className="shrink-0" />
            <span className="truncate">{ts.standortName}</span>
          </div>
        ) : null}
        {ts.fields.max_kapazitaet != null && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <IconUsers size={14} className="shrink-0" />
            <span>{buchungen.length} / {ts.fields.max_kapazitaet} Buchungen</span>
          </div>
        )}
        {ts.anbieterName && (
          <div className="text-xs text-muted-foreground">Anbieter: {ts.anbieterName}</div>
        )}
      </div>

      {/* Buchungen */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Buchungen ({buchungen.length})</span>
          <button
            onClick={onAddBuchung}
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <IconPlus size={12} />
            Hinzufügen
          </button>
        </div>
        <div className="px-4 pb-3 space-y-2">
          {buchungen.length === 0 ? (
            <div className="text-center py-4 text-sm text-muted-foreground">Noch keine Buchungen</div>
          ) : (
            pagedBuchungen.map(b => (
              <div key={b.record_id} className="flex items-start justify-between gap-2 p-2 rounded-lg bg-muted/40 border">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">
                    {b.fields.vorname} {b.fields.nachname}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{b.fields.email}</div>
                  {b.fields.buchungsart && (
                    <Badge className="text-[10px] mt-1 py-0 px-1.5 h-4">
                      {b.fields.buchungsart.label}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => onEditBuchung(b)} className="p-1 rounded hover:bg-accent text-muted-foreground">
                    <IconPencil size={12} />
                  </button>
                  <button onClick={() => onDeleteBuchung(b)} className="p-1 rounded hover:bg-accent text-destructive">
                    <IconTrash size={12} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 pb-3 border-t pt-2 mt-auto">
            <button
              onClick={() => setBuchungPage(p => Math.max(0, p - 1))}
              disabled={buchungPage === 0}
              className="p-1 rounded-lg hover:bg-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <IconChevronLeft size={14} />
            </button>
            <span className="text-xs text-muted-foreground">
              {buchungPage + 1} / {totalPages}
            </span>
            <button
              onClick={() => setBuchungPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={buchungPage === totalPages - 1}
              className="p-1 rounded-lg hover:bg-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <IconChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Upcoming Timeslots ---
function UpcomingTimeslots({
  enrichedTimeslots,
  buchungenByTimeslot,
  onSelect,
  selectedId,
  statusBadge,
  formatTime,
}: {
  enrichedTimeslots: EnrichedTimeslots[];
  buchungenByTimeslot: Map<string, EnrichedTerminbuchung[]>;
  onSelect: (ts: EnrichedTimeslots) => void;
  selectedId?: string;
  statusBadge: (ts: EnrichedTimeslots) => React.ReactNode;
  formatTime: (dt: string | undefined) => string;
}) {
  const now = new Date();
  const upcoming = enrichedTimeslots
    .filter(ts => {
      if (!ts.fields.startzeit) return false;
      try { return parseISO(ts.fields.startzeit) >= now; } catch { return false; }
    })
    .sort((a, b) => {
      const da = a.fields.startzeit ?? '';
      const db = b.fields.startzeit ?? '';
      return da.localeCompare(db);
    })
    .slice(0, 10);

  if (upcoming.length === 0) return null;

  return (
    <div className="bg-card border rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b bg-muted/30">
        <h3 className="font-semibold text-sm">Nächste Termine</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/20">
              <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Titel</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground hidden sm:table-cell">Datum</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground hidden md:table-cell">Zeit</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground hidden lg:table-cell">Ort</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Status</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground hidden sm:table-cell">Buchungen</th>
            </tr>
          </thead>
          <tbody>
            {upcoming.map(ts => {
              const buchungen = buchungenByTimeslot.get(ts.record_id) ?? [];
              const isSelected = ts.record_id === selectedId;
              return (
                <tr
                  key={ts.record_id}
                  onClick={() => onSelect(ts)}
                  className={`border-b last:border-b-0 cursor-pointer transition-colors ${isSelected ? 'bg-primary/5' : 'hover:bg-muted/40'}`}
                >
                  <td className="px-4 py-2.5">
                    <span className="font-medium truncate block max-w-[160px]">{ts.fields.titel || '–'}</span>
                    <span className="text-xs text-muted-foreground sm:hidden">{formatDate(ts.fields.startzeit?.slice(0, 10))}</span>
                  </td>
                  <td className="px-4 py-2.5 hidden sm:table-cell text-muted-foreground">
                    {formatDate(ts.fields.startzeit?.slice(0, 10))}
                  </td>
                  <td className="px-4 py-2.5 hidden md:table-cell text-muted-foreground">
                    {formatTime(ts.fields.startzeit)} – {formatTime(ts.fields.endzeit)}
                  </td>
                  <td className="px-4 py-2.5 hidden lg:table-cell text-muted-foreground">
                    {ts.fields.online_termin ? (
                      <span className="flex items-center gap-1"><IconVideo size={13} className="shrink-0" /> Online</span>
                    ) : (
                      <span className="truncate block max-w-[120px]">{ts.standortName || '–'}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">{statusBadge(ts)}</td>
                  <td className="px-4 py-2.5 hidden sm:table-cell">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <IconUsers size={13} className="shrink-0" />
                      {buchungen.length}{ts.fields.max_kapazitaet ? `/${ts.fields.max_kapazitaet}` : ''}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- Skeleton ---
function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
      <Skeleton className="h-48 rounded-2xl" />
    </div>
  );
}

// --- Error ---
function DashboardError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const [repairing, setRepairing] = useState(false);
  const [repairStatus, setRepairStatus] = useState('');
  const [repairDone, setRepairDone] = useState(false);
  const [repairFailed, setRepairFailed] = useState(false);

  const handleRepair = async () => {
    setRepairing(true);
    setRepairStatus('Reparatur wird gestartet...');
    setRepairFailed(false);

    const errorContext = JSON.stringify({
      type: 'data_loading',
      message: error.message,
      stack: (error.stack ?? '').split('\n').slice(0, 10).join('\n'),
      url: window.location.href,
    });

    try {
      const resp = await fetch(REPAIR_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ appgroup_id: APPGROUP_ID, error_context: errorContext }),
      });

      if (!resp.ok || !resp.body) {
        setRepairing(false);
        setRepairFailed(true);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const raw of lines) {
          const line = raw.trim();
          if (!line.startsWith('data: ')) continue;
          const content = line.slice(6);
          if (content.startsWith('[STATUS]')) {
            setRepairStatus(content.replace(/^\[STATUS]\s*/, ''));
          }
          if (content.startsWith('[DONE]')) {
            setRepairDone(true);
            setRepairing(false);
          }
          if (content.startsWith('[ERROR]') && !content.includes('Dashboard-Links')) {
            setRepairFailed(true);
          }
        }
      }
    } catch {
      setRepairing(false);
      setRepairFailed(true);
    }
  };

  if (repairDone) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center">
          <IconCheck size={22} className="text-green-500" />
        </div>
        <div className="text-center">
          <h3 className="font-semibold text-foreground mb-1">Dashboard repariert</h3>
          <p className="text-sm text-muted-foreground max-w-xs">Das Problem wurde behoben. Bitte laden Sie die Seite neu.</p>
        </div>
        <Button size="sm" onClick={() => window.location.reload()}>
          <IconRefresh size={14} className="mr-1" />Neu laden
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <IconAlertCircle size={22} className="text-destructive" />
      </div>
      <div className="text-center">
        <h3 className="font-semibold text-foreground mb-1">Fehler beim Laden</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          {repairing ? repairStatus : error.message}
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onRetry} disabled={repairing}>Erneut versuchen</Button>
        <Button size="sm" onClick={handleRepair} disabled={repairing}>
          {repairing
            ? <span className="inline-block w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-1" />
            : <IconTool size={14} className="mr-1" />}
          {repairing ? 'Reparatur läuft...' : 'Dashboard reparieren'}
        </Button>
      </div>
      {repairFailed && <p className="text-sm text-destructive">Automatische Reparatur fehlgeschlagen. Bitte kontaktieren Sie den Support.</p>}
    </div>
  );
}
