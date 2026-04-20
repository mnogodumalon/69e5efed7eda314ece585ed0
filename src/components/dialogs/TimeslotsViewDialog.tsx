import type { Timeslots, Anbieterprofil, Standorte } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { IconPencil } from '@tabler/icons-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

function formatDate(d?: string) {
  if (!d) return '—';
  try { return format(parseISO(d), 'dd.MM.yyyy', { locale: de }); } catch { return d; }
}

interface TimeslotsViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: Timeslots | null;
  onEdit: (record: Timeslots) => void;
  anbieterprofilList: Anbieterprofil[];
  standorteList: Standorte[];
}

export function TimeslotsViewDialog({ open, onClose, record, onEdit, anbieterprofilList, standorteList }: TimeslotsViewDialogProps) {
  function getAnbieterprofilDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return anbieterprofilList.find(r => r.record_id === id)?.fields.vorname ?? '—';
  }

  function getStandorteDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return standorteList.find(r => r.record_id === id)?.fields.standort_name ?? '—';
  }

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Timeslots anzeigen</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { onClose(); onEdit(record); }}>
            <IconPencil className="h-3.5 w-3.5 mr-1.5" />
            Bearbeiten
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Anbieter</Label>
            <p className="text-sm">{getAnbieterprofilDisplayName(record.fields.anbieter)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Titel des Termins</Label>
            <p className="text-sm">{record.fields.titel ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Standort</Label>
            <p className="text-sm">{getStandorteDisplayName(record.fields.standort)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Startdatum und -uhrzeit</Label>
            <p className="text-sm">{formatDate(record.fields.startzeit)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Enddatum und -uhrzeit</Label>
            <p className="text-sm">{formatDate(record.fields.endzeit)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Dauer (Minuten)</Label>
            <p className="text-sm">{record.fields.dauer ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Maximale Anzahl Buchungen</Label>
            <p className="text-sm">{record.fields.max_kapazitaet ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Badge variant="secondary">{record.fields.status?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Hinweise für Buchende</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.hinweise ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Online-Termin (kein Standort erforderlich)</Label>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
              record.fields.online_termin ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
            }`}>
              {record.fields.online_termin ? 'Ja' : 'Nein'}
            </span>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Online-Meeting-Link</Label>
            <p className="text-sm">{record.fields.online_link ?? '—'}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}