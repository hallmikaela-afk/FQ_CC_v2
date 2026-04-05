'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { EventDay } from '@/data/seed';
import { formatDate } from '@/data/seed';

declare global {
  interface Window {
    google: any;
    initGoogleMapsForEventDay?: () => void;
  }
}

function loadGoogleMapsScript(apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.maps?.places) { resolve(); return; }
    const existing = document.getElementById('google-maps-places-script');
    if (existing) {
      // Already loading — wait for callback
      const prev = window.initGoogleMapsForEventDay;
      window.initGoogleMapsForEventDay = () => { prev?.(); resolve(); };
      return;
    }
    window.initGoogleMapsForEventDay = resolve;
    const script = document.createElement('script');
    script.id = 'google-maps-places-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGoogleMapsForEventDay`;
    script.async = true;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export default function AddEventDayModal({
  open,
  onClose,
  projectId,
  weddingDate,
  nextSortOrder,
  onSaved,
  onDeleted,
  existingDay,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  weddingDate: string;
  nextSortOrder: number;
  onSaved: (day: EventDay) => void;
  onDeleted?: (id: string) => void;
  existingDay?: EventDay;
}) {
  const [dayName, setDayName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [venueName, setVenueName] = useState('');
  const [venueStreet, setVenueStreet] = useState('');
  const [venueCityStateZip, setVenueCityStateZip] = useState('');
  const [mapsUrl, setMapsUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');
  const venueInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  // Populate fields when editing an existing day
  useEffect(() => {
    if (open) {
      setDayName(existingDay?.day_name || '');
      setEventDate(existingDay?.event_date || weddingDate || '');
      setVenueName(existingDay?.venue_name || '');
      setVenueStreet(existingDay?.venue_street || '');
      setVenueCityStateZip(existingDay?.venue_city_state_zip || '');
      setMapsUrl('');
      setError('');
      setConfirmDelete(false);
    }
  }, [open, existingDay]);

  // Build maps URL whenever address fields change
  useEffect(() => {
    const parts = [venueName, venueStreet, venueCityStateZip].filter(Boolean);
    if (parts.length) {
      setMapsUrl(`https://maps.google.com/?q=${encodeURIComponent(parts.join(', '))}`);
    } else {
      setMapsUrl('');
    }
  }, [venueName, venueStreet, venueCityStateZip]);

  // Initialize Google Maps Places Autocomplete
  const initAutocomplete = useCallback(() => {
    if (!venueInputRef.current || !window.google?.maps?.places) return;
    if (autocompleteRef.current) return; // already initialized

    const ac = new window.google.maps.places.Autocomplete(venueInputRef.current, {
      types: ['establishment', 'geocode'],
      fields: ['name', 'address_components', 'formatted_address'],
    });

    ac.addListener('place_changed', () => {
      const place = ac.getPlace();
      if (!place) return;

      setVenueName(place.name || venueInputRef.current?.value || '');

      if (place.address_components) {
        const get = (type: string) =>
          place.address_components?.find((c: any) => c.types.includes(type))?.long_name || '';
        const getShort = (type: string) =>
          place.address_components?.find((c: any) => c.types.includes(type))?.short_name || '';

        const streetNum = get('street_number');
        const route = get('route');
        const city = get('locality') || get('sublocality_level_1');
        const state = getShort('administrative_area_level_1');
        const zip = get('postal_code');

        setVenueStreet([streetNum, route].filter(Boolean).join(' '));
        setVenueCityStateZip([city, state, zip].filter(Boolean).join(', '));
      }
    });

    autocompleteRef.current = ac;
  }, []);

  useEffect(() => {
    if (!open || !apiKey) return;
    loadGoogleMapsScript(apiKey).then(initAutocomplete).catch(() => {/* no key / network issue */});
  }, [open, apiKey, initAutocomplete]);

  // Re-init when the input mounts after open
  useEffect(() => {
    if (open && window.google?.maps?.places) initAutocomplete();
  }, [open, initAutocomplete]);

  if (!open) return null;

  const handleSave = async () => {
    if (!dayName.trim()) { setError('Event name is required.'); return; }
    setSaving(true);
    setError('');

    const payload = {
      project_id: projectId,
      day_name: dayName.trim(),
      event_date: eventDate || null,
      venue_name: venueName.trim() || null,
      venue_street: venueStreet.trim() || null,
      venue_city_state_zip: venueCityStateZip.trim() || null,
      sort_order: existingDay?.sort_order ?? nextSortOrder,
    };

    const method = existingDay ? 'PATCH' : 'POST';
    const body = existingDay ? { id: existingDay.id, ...payload } : payload;

    const res = await fetch('/api/event-days', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    setSaving(false);
    if (!res.ok) { setError('Something went wrong. Please try again.'); return; }
    const saved = await res.json();
    onSaved(saved);
    onClose();
  };

  const handleDelete = async () => {
    if (!existingDay) return;
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    await fetch(`/api/event-days?id=${existingDay.id}`, { method: 'DELETE' });
    setDeleting(false);
    onDeleted?.(existingDay.id);
    onClose();
  };

  const t = { heading: 'text-fq-dark/90', light: 'text-fq-muted/70', muted: 'text-fq-muted/60' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-fq-card rounded-2xl border border-fq-border shadow-2xl w-[480px] flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-fq-border shrink-0">
          <h2 className={`font-heading text-[20px] font-semibold ${t.heading}`}>
            {existingDay ? 'Edit Event Day' : 'Add Event Day'}
          </h2>
          <button onClick={onClose} className={`${t.muted} hover:text-fq-dark text-[18px] transition-colors`}>✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Event Name */}
          <div>
            <label className={`font-body text-[12px] font-medium ${t.heading} block mb-1.5`}>Event Name *</label>
            <input
              value={dayName}
              onChange={e => setDayName(e.target.value)}
              placeholder="e.g. Rehearsal Dinner, Ceremony, Reception…"
              autoFocus
              className={`w-full font-body text-[13px] ${t.light} bg-fq-bg border border-fq-border rounded-lg px-3 py-2 outline-none focus:border-fq-accent/50 placeholder:text-fq-muted/40`}
            />
          </div>

          {/* Date */}
          <div>
            <label className={`font-body text-[12px] font-medium ${t.heading} block mb-1.5`}>Date</label>
            <input
              type="date"
              value={eventDate}
              onChange={e => setEventDate(e.target.value)}
              className={`font-body text-[13px] ${t.light} bg-fq-bg border border-fq-border rounded-lg px-3 py-2 outline-none focus:border-fq-accent/50`}
            />
            {weddingDate && (
              <p className={`font-body text-[11px] ${t.muted} mt-1`}>
                Wedding day: {formatDate(weddingDate)} — add events before or after
              </p>
            )}
          </div>

          {/* Venue Name — Google Maps Autocomplete */}
          <div>
            <label className={`font-body text-[12px] font-medium ${t.heading} block mb-1.5`}>
              Venue Name
              {apiKey && <span className={`font-body font-normal text-[11px] ${t.muted} ml-1`}>— type to search Google Maps</span>}
            </label>
            <input
              ref={venueInputRef}
              value={venueName}
              onChange={e => setVenueName(e.target.value)}
              placeholder="Search venue by name…"
              className={`w-full font-body text-[13px] ${t.light} bg-fq-bg border border-fq-border rounded-lg px-3 py-2 outline-none focus:border-fq-accent/50 placeholder:text-fq-muted/40`}
            />
          </div>

          {/* Street Address */}
          <div>
            <label className={`font-body text-[12px] font-medium ${t.heading} block mb-1.5`}>
              Street Address
              <span className={`font-body font-normal text-[11px] ${t.muted} ml-1`}>— or paste full address to auto-split</span>
            </label>
            <input
              value={venueStreet}
              onChange={e => setVenueStreet(e.target.value)}
              onPaste={e => {
                const text = e.clipboardData.getData('text').trim();
                const commaIdx = text.indexOf(',');
                if (commaIdx !== -1) {
                  e.preventDefault();
                  setVenueStreet(text.slice(0, commaIdx).trim());
                  setVenueCityStateZip(text.slice(commaIdx + 1).trim());
                }
              }}
              placeholder="Paste full address or type street…"
              className={`w-full font-body text-[13px] ${t.light} bg-fq-bg border border-fq-border rounded-lg px-3 py-2 outline-none focus:border-fq-accent/50 placeholder:text-fq-muted/40`}
            />
          </div>

          {/* City, State ZIP */}
          <div>
            <label className={`font-body text-[12px] font-medium ${t.heading} block mb-1.5`}>City, State ZIP</label>
            <input
              value={venueCityStateZip}
              onChange={e => setVenueCityStateZip(e.target.value)}
              placeholder="City, ST 00000"
              className={`w-full font-body text-[13px] ${t.light} bg-fq-bg border border-fq-border rounded-lg px-3 py-2 outline-none focus:border-fq-accent/50 placeholder:text-fq-muted/40`}
            />
          </div>

          {/* Maps preview */}
          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1 font-body text-[12px] text-fq-accent hover:underline`}
            >
              Open in Google Maps ↗
            </a>
          )}

          {error && <p className="font-body text-[12px] text-fq-alert">{error}</p>}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 border-t border-fq-border">
          {existingDay ? (
            <div className="flex items-center justify-between">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className={`font-body text-[12px] ${confirmDelete ? 'text-fq-alert font-medium' : t.muted} hover:text-fq-alert transition-colors disabled:opacity-50`}
              >
                {deleting ? 'Deleting…' : confirmDelete ? 'Confirm — this will remove all vendors for this day' : 'Delete this event day'}
              </button>
              <div className="flex items-center gap-2">
                <button onClick={onClose} className={`font-body text-[13px] ${t.light} px-4 py-2 rounded-lg border border-fq-border hover:border-fq-dark/20 transition-colors`}>Cancel</button>
                <button onClick={handleSave} disabled={saving || !dayName.trim()} className="font-body text-[13px] font-medium bg-fq-dark text-white px-4 py-2 rounded-lg hover:bg-fq-dark/90 transition-colors disabled:opacity-40">
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-2">
              <button onClick={onClose} className={`font-body text-[13px] ${t.light} px-4 py-2 rounded-lg border border-fq-border hover:border-fq-dark/20 transition-colors`}>Cancel</button>
              <button onClick={handleSave} disabled={saving || !dayName.trim()} className="font-body text-[13px] font-medium bg-fq-dark text-white px-4 py-2 rounded-lg hover:bg-fq-dark/90 transition-colors disabled:opacity-40">
                {saving ? 'Saving…' : 'Add Event Day'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
