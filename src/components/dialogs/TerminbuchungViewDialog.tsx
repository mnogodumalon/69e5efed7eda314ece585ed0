import type { Terminbuchung, Timeslots } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { IconPencil } from '@tabler/icons-react';

interface TerminbuchungViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: Terminbuchung | null;
  onEdit: (record: Terminbuchung) => void;
  timeslotsList: Timeslots[];
}

export function TerminbuchungViewDialog({ open, onClose, record, onEdit, timeslotsList }: TerminbuchungViewDialogProps) {
  function getTimeslotsDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return timeslotsList.find(r => r.record_id === id)?.fields.titel ?? '—';
  }

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Terminbuchung anzeigen</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { onClose(); onEdit(record); }}>
            <IconPencil className="h-3.5 w-3.5 mr-1.5" />
            Bearbeiten
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Gewünschter Termin</Label>
            <p className="text-sm">{getTimeslotsDisplayName(record.fields.timeslot)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Art der Buchung</Label>
            <Badge variant="secondary">{record.fields.buchungsart?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Vorname</Label>
            <p className="text-sm">{record.fields.vorname ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Nachname</Label>
            <p className="text-sm">{record.fields.nachname ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">E-Mail-Adresse</Label>
            <p className="text-sm">{record.fields.email ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Telefonnummer</Label>
            <p className="text-sm">{record.fields.telefon ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Nachricht oder Anmerkungen</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.nachricht ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Ich stimme der Verarbeitung meiner Daten zur Terminverwaltung zu.</Label>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
              record.fields.datenschutz_zustimmung ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
            }`}>
              {record.fields.datenschutz_zustimmung ? 'Ja' : 'Nein'}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}