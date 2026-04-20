import { useState } from 'react';
import type { Standorte, Anbieterprofil } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { IconPencil, IconChevronDown } from '@tabler/icons-react';
import { GeoMapPicker } from '@/components/GeoMapPicker';

interface StandorteViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: Standorte | null;
  onEdit: (record: Standorte) => void;
  anbieterprofilList: Anbieterprofil[];
}

export function StandorteViewDialog({ open, onClose, record, onEdit, anbieterprofilList }: StandorteViewDialogProps) {
  const [showCoords, setShowCoords] = useState(false);

  function getAnbieterprofilDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return anbieterprofilList.find(r => r.record_id === id)?.fields.vorname ?? '—';
  }

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Standorte anzeigen</DialogTitle>
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
            <Label className="text-xs text-muted-foreground">Standortname</Label>
            <p className="text-sm">{record.fields.standort_name ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Straße</Label>
            <p className="text-sm">{record.fields.strasse ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Hausnummer</Label>
            <p className="text-sm">{record.fields.hausnummer ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Postleitzahl</Label>
            <p className="text-sm">{record.fields.plz ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Stadt</Label>
            <p className="text-sm">{record.fields.stadt ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Standort auf der Karte</Label>
            {record.fields.geo_koordinaten?.info && (
              <p className="text-sm text-muted-foreground break-words whitespace-normal">{record.fields.geo_koordinaten.info}</p>
            )}
            {record.fields.geo_koordinaten?.lat != null && record.fields.geo_koordinaten?.long != null && (
              <GeoMapPicker
                lat={record.fields.geo_koordinaten.lat}
                lng={record.fields.geo_koordinaten.long}
                readOnly
              />
            )}
            <button type="button" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors" onClick={() => setShowCoords(v => !v)}>
              {showCoords ? 'Koordinaten verbergen' : 'Koordinaten anzeigen'}
              <IconChevronDown className={`h-3 w-3 transition-transform ${showCoords ? "rotate-180" : ""}`} />
            </button>
            {showCoords && (
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-xs text-muted-foreground">Breitengrad:</span> {record.fields.geo_koordinaten?.lat?.toFixed(6) ?? '—'}</div>
                <div><span className="text-xs text-muted-foreground">Längengrad:</span> {record.fields.geo_koordinaten?.long?.toFixed(6) ?? '—'}</div>
              </div>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Beschreibung</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.beschreibung ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Telefon</Label>
            <p className="text-sm">{record.fields.kontakt_telefon ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">E-Mail</Label>
            <p className="text-sm">{record.fields.kontakt_email ?? '—'}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}