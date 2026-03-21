'use client';

import { useState, useRef, useEffect, ReactNode } from 'react';
import Link from 'next/link';
import { formatCountdown, formatDate } from '@/data/seed';
import type { Project, CallNote, TeamMember } from '@/data/seed';

/* ── Inline editable text field ── */
function EditableField({
  value,
  onChange,
  className = '',
  placeholder = 'Click to edit...',
  inputClassName = '',
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
  inputClassName?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { onChange(draft); setEditing(false); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { onChange(draft); setEditing(false); }
          if (e.key === 'Escape') { setDraft(value); setEditing(false); }
        }}
        className={`bg-transparent border-b border-fq-accent/40 outline-none w-full py-0 text-fq-dark ${inputClassName || className}`}
        placeholder={placeholder}
      />
    );
  }

  return (
    <span
      onClick={() => { setDraft(value); setEditing(true); }}
      className={`cursor-text hover:border-b hover:border-fq-border/60 transition-colors ${className}`}
    >
      {value || <span className="text-fq-border italic">{placeholder}</span>}
    </span>
  );
}

/* ── Editable address box (two lines in one copyable block) ── */
function EditableAddressBox({
  icon,
  street,
  cityStateZip,
  onStreetChange,
  onCityStateZipChange,
  streetPlaceholder = 'Street address...',
  cityPlaceholder = 'City, State ZIP...',
}: {
  icon: ReactNode;
  street: string;
  cityStateZip: string;
  onStreetChange: (v: string) => void;
  onCityStateZipChange: (v: string) => void;
  streetPlaceholder?: string;
  cityPlaceholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draftStreet, setDraftStreet] = useState(street);
  const [draftCity, setDraftCity] = useState(cityStateZip);
  const streetRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) streetRef.current?.focus();
  }, [editing]);

  const save = () => {
    onStreetChange(draftStreet);
    onCityStateZipChange(draftCity);
    setEditing(false);
  };

  const t = { body: 'text-fq-muted/90', light: 'text-fq-muted/70', icon: 'text-fq-muted/60' };

  if (editing) {
    return (
      <div className="flex items-start gap-2">
        <span className={`${t.icon} w-4 text-center text-[12px] mt-0.5 shrink-0`}>{icon}</span>
        <div className="flex-1 min-w-0 space-y-0.5">
          <input
            ref={streetRef}
            value={draftStreet}
            onChange={(e) => setDraftStreet(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
            className={`bg-transparent border-b border-fq-accent/40 outline-none w-full py-0 font-body text-[13px] text-fq-dark`}
            placeholder={streetPlaceholder}
          />
          <input
            value={draftCity}
            onChange={(e) => setDraftCity(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
            className={`bg-transparent border-b border-fq-accent/40 outline-none w-full py-0 font-body text-[12px] text-fq-dark`}
            placeholder={cityPlaceholder}
          />
        </div>
      </div>
    );
  }

  const hasContent = street || cityStateZip;

  return (
    <div
      className="flex items-start gap-2 cursor-text group"
      onClick={() => { setDraftStreet(street); setDraftCity(cityStateZip); setEditing(true); }}
    >
      <span className={`${t.icon} w-4 text-center text-[12px] mt-0.5 shrink-0`}>{icon}</span>
      <div className="flex-1 min-w-0 group-hover:border-b group-hover:border-fq-border/60 transition-colors">
        {hasContent ? (
          <>
            <p className={`font-body text-[13px] ${t.body} leading-snug`}>{street}</p>
            <p className={`font-body text-[12px] ${t.light} leading-snug`}>{cityStateZip}</p>
          </>
        ) : (
          <p className="font-body text-[12px] text-fq-border italic">{streetPlaceholder}</p>
        )}
      </div>
    </div>
  );
}

/* ── Link row with clickable "Link" text + editable URL ── */
function LinkRow({
  icon,
  label,
  value,
  onChange,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const t = { light: 'text-fq-muted/70', icon: 'text-fq-muted/60' };

  return (
    <div className="flex items-center gap-2 text-[12px] font-body">
      <span className={`${t.icon} w-4 text-center shrink-0`}>{icon}</span>
      <span className={`${t.light} w-[130px] shrink-0`}>{label}</span>
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => { onChange(draft); setEditing(false); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { onChange(draft); setEditing(false); }
            if (e.key === 'Escape') { setDraft(value); setEditing(false); }
          }}
          className="flex-1 min-w-0 text-fq-dark bg-fq-bg border border-fq-border rounded px-2 py-1 text-[11px] outline-none focus:border-fq-accent/40"
          placeholder="https://..."
        />
      ) : (
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {value ? (
            <a
              href={value}
              target="_blank"
              rel="noopener noreferrer"
              className="text-fq-accent font-medium hover:underline shrink-0"
            >
              Link
            </a>
          ) : (
            <span className="text-fq-border italic shrink-0">—</span>
          )}
          <button
            onClick={() => { setDraft(value); setEditing(true); }}
            className={`${t.light} hover:text-fq-muted text-[10px] shrink-0`}
          >
            edit
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Editable Agenda Section (inline on card) ── */
function EditableAgendaSection({ initialItems, tClasses }: { initialItems: string[]; tClasses: Record<string, string> }) {
  const [items, setItems] = useState(initialItems);
  const [newItem, setNewItem] = useState('');
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingIdx !== null) inputRef.current?.focus();
  }, [editingIdx]);

  const addItem = () => {
    if (newItem.trim()) { setItems([...items, newItem.trim()]); setNewItem(''); }
  };

  const saveEdit = (idx: number) => {
    if (!editDraft.trim()) {
      setItems(items.filter((_, i) => i !== idx));
    } else {
      setItems(items.map((item, i) => i === idx ? editDraft.trim() : item));
    }
    setEditingIdx(null);
  };

  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));

  return (
    <div className="mb-3">
      <h3 className={`font-heading text-[15px] font-semibold ${tClasses.heading || tClasses.label} mb-2`}>Next Call Agenda</h3>
      <div className="space-y-1">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-1 group/agenda">
            {editingIdx === i ? (
              <div className="flex items-center gap-1 flex-1">
                <span className={`font-body text-[12px] ${tClasses.light} shrink-0`}>-</span>
                <input
                  ref={inputRef}
                  value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  onBlur={() => saveEdit(i)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveEdit(i);
                    if (e.key === 'Escape') setEditingIdx(null);
                  }}
                  className={`flex-1 bg-transparent border-b border-fq-accent/40 outline-none font-body text-[12px] text-fq-dark py-0`}
                />
              </div>
            ) : (
              <>
                <p
                  onClick={() => { setEditDraft(item); setEditingIdx(i); }}
                  className={`font-body text-[12px] ${tClasses.light} leading-snug flex-1 cursor-text hover:text-fq-dark transition-colors`}
                >
                  - {item}
                </p>
                <button
                  onClick={() => removeItem(i)}
                  className="text-fq-muted/30 hover:text-fq-alert text-[10px] opacity-0 group-hover/agenda:opacity-100 transition-opacity shrink-0 mt-0.5"
                >
                  ✕
                </button>
              </>
            )}
          </div>
        ))}
      </div>
      <input
        value={newItem}
        onChange={(e) => setNewItem(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') addItem(); }}
        placeholder="+ Add agenda item..."
        className={`w-full font-body text-[11px] ${tClasses.light} bg-transparent border-none outline-none placeholder:text-fq-muted/30 mt-1.5`}
      />
    </div>
  );
}

/* ── Card field configuration ── */
interface CardFieldConfig {
  id: string;
  pane: 'first' | 'expanded';
  visible: boolean;
}

interface CustomField {
  id: string;
  label: string;
  value: string;
}

const DEFAULT_FIRST_PANE_FIELDS = ['venue', 'venue_address', 'guests', 'budget', 'signed_date'];
const DEFAULT_EXPANDED_FIELDS = ['partners', 'client_address', 'links', 'call_notes', 'project_color'];

const ALL_FIELD_LABELS: Record<string, string> = {
  venue: 'Venue Name', venue_address: 'Venue Address', guests: 'Guest Count', budget: 'Budget', signed_date: 'Signed Date',
  partners: 'Partners', client_address: 'Client Address', links: 'Links & Resources', call_notes: 'Latest Call Note', project_color: 'Project Color',
};

function loadCardConfig(projectId: string): { fields: CardFieldConfig[]; customFields: CustomField[] } {
  if (typeof window === 'undefined') return { fields: [], customFields: [] };
  try {
    const saved = localStorage.getItem(`fq_card_config_${projectId}`);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  // Default config
  const fields: CardFieldConfig[] = [
    ...DEFAULT_FIRST_PANE_FIELDS.map(id => ({ id, pane: 'first' as const, visible: true })),
    ...DEFAULT_EXPANDED_FIELDS.map(id => ({ id, pane: 'expanded' as const, visible: true })),
  ];
  return { fields, customFields: [] };
}

function saveCardConfig(projectId: string, fields: CardFieldConfig[], customFields: CustomField[]) {
  localStorage.setItem(`fq_card_config_${projectId}`, JSON.stringify({ fields, customFields }));
}

/* ── Card Settings Panel ── */
function CardSettingsPanel({ fields, customFields, onFieldsChange, onCustomFieldsChange, onClose }: {
  fields: CardFieldConfig[];
  customFields: CustomField[];
  onFieldsChange: (f: CardFieldConfig[]) => void;
  onCustomFieldsChange: (f: CustomField[]) => void;
  onClose: () => void;
}) {
  const [newLabel, setNewLabel] = useState('');
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const toggleField = (id: string) => {
    onFieldsChange(fields.map(f => f.id === id ? { ...f, visible: !f.visible } : f));
  };

  const moveFieldPane = (id: string) => {
    onFieldsChange(fields.map(f => f.id === id ? { ...f, pane: f.pane === 'first' ? 'expanded' as const : 'first' as const } : f));
  };

  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    const reordered = [...fields];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(idx, 0, moved);
    onFieldsChange(reordered);
    setDragIdx(idx);
  };

  const addCustomField = () => {
    if (!newLabel.trim()) return;
    const id = `custom_${Date.now()}`;
    onCustomFieldsChange([...customFields, { id, label: newLabel.trim(), value: '' }]);
    onFieldsChange([...fields, { id, pane: 'first', visible: true }]);
    setNewLabel('');
  };

  const removeCustomField = (id: string) => {
    onCustomFieldsChange(customFields.filter(f => f.id !== id));
    onFieldsChange(fields.filter(f => f.id !== id));
  };

  const firstPaneFields = fields.filter(f => f.pane === 'first');
  const expandedFields = fields.filter(f => f.pane === 'expanded');

  return (
    <div className="border-t border-fq-border px-5 py-4 bg-fq-bg/30">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-heading text-[14px] font-semibold text-fq-dark/80">Card Settings</h4>
        <button onClick={onClose} className="text-fq-muted/40 hover:text-fq-dark text-[14px]">✕</button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* First Pane */}
        <div>
          <p className="font-body text-[10px] font-semibold text-fq-muted/70 uppercase tracking-wide mb-1">First Pane</p>
          {firstPaneFields.map((f, idx) => (
            <div key={f.id} draggable onDragStart={() => handleDragStart(fields.indexOf(f))}
              onDragOver={(e) => handleDragOver(e, fields.indexOf(f))}
              className="flex items-center gap-1.5 py-0.5 text-[11px] font-body cursor-grab">
              <span className="text-fq-muted/30 text-[9px]">⋮⋮</span>
              <input type="checkbox" checked={f.visible} onChange={() => toggleField(f.id)} className="w-3 h-3 rounded" />
              <span className="text-fq-dark/80 flex-1">{ALL_FIELD_LABELS[f.id] || customFields.find(c => c.id === f.id)?.label || f.id}</span>
              <button onClick={() => moveFieldPane(f.id)} className="text-fq-muted/40 hover:text-fq-accent text-[9px]">→</button>
              {f.id.startsWith('custom_') && (
                <button onClick={() => removeCustomField(f.id)} className="text-fq-muted/30 hover:text-fq-alert text-[9px]">✕</button>
              )}
            </div>
          ))}
        </div>

        {/* Expanded Pane */}
        <div>
          <p className="font-body text-[10px] font-semibold text-fq-muted/70 uppercase tracking-wide mb-1">More Details</p>
          {expandedFields.map((f, idx) => (
            <div key={f.id} draggable onDragStart={() => handleDragStart(fields.indexOf(f))}
              onDragOver={(e) => handleDragOver(e, fields.indexOf(f))}
              className="flex items-center gap-1.5 py-0.5 text-[11px] font-body cursor-grab">
              <span className="text-fq-muted/30 text-[9px]">⋮⋮</span>
              <input type="checkbox" checked={f.visible} onChange={() => toggleField(f.id)} className="w-3 h-3 rounded" />
              <span className="text-fq-dark/80 flex-1">{ALL_FIELD_LABELS[f.id] || customFields.find(c => c.id === f.id)?.label || f.id}</span>
              <button onClick={() => moveFieldPane(f.id)} className="text-fq-muted/40 hover:text-fq-accent text-[9px]">←</button>
              {f.id.startsWith('custom_') && (
                <button onClick={() => removeCustomField(f.id)} className="text-fq-muted/30 hover:text-fq-alert text-[9px]">✕</button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Add custom field */}
      <div className="flex items-center gap-1.5 mt-3">
        <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') addCustomField(); }}
          placeholder="New field label..."
          className="flex-1 font-body text-[11px] bg-white border border-fq-border rounded px-2 py-1 outline-none" />
        <button onClick={addCustomField} className="font-body text-[11px] text-fq-accent hover:text-fq-dark">+ Add Field</button>
      </div>
    </div>
  );
}

/* ── Main card ── */
const defaultLookup = (_id: string): TeamMember | undefined => undefined;

export default function ClientCard({ project, getTeamMember = defaultLookup }: { project: Project; getTeamMember?: (id: string) => TeamMember | undefined }) {
  const [showSettings, setShowSettings] = useState(false);
  const countdown = formatCountdown(project.event_date);
  const progressPct = project.tasks_total > 0
    ? (project.tasks_completed / project.tasks_total) * 100
    : 0;
  const callNoteCount = project.call_notes?.length ?? 0;

  // Card field configuration
  const [cardConfig, setCardConfig] = useState(() => loadCardConfig(project.id));
  const [cardFields, setCardFields] = useState<CardFieldConfig[]>(cardConfig.fields);
  const [customFields, setCustomFields] = useState<CustomField[]>(cardConfig.customFields);

  const handleFieldsChange = (fields: CardFieldConfig[]) => {
    setCardFields(fields);
    saveCardConfig(project.id, fields, customFields);
  };
  const handleCustomFieldsChange = (cf: CustomField[]) => {
    setCustomFields(cf);
    saveCardConfig(project.id, cardFields, cf);
  };
  const updateCustomFieldValue = (id: string, value: string) => {
    const updated = customFields.map(f => f.id === id ? { ...f, value } : f);
    setCustomFields(updated);
    saveCardConfig(project.id, cardFields, updated);
  };

  const isFieldVisible = (id: string, pane: 'first' | 'expanded') => {
    const field = cardFields.find(f => f.id === id);
    return field ? field.visible && field.pane === pane : (pane === 'first' ? DEFAULT_FIRST_PANE_FIELDS.includes(id) : DEFAULT_EXPANDED_FIELDS.includes(id));
  };

  // Editable state
  const [eventDate, setEventDate] = useState(project.event_date);
  const [serviceTier, setServiceTier] = useState(project.service_tier || '');
  const [concept, setConcept] = useState(project.concept || '');
  const [venueName, setVenueName] = useState(project.venue_name || '');
  const [venueStreet, setVenueStreet] = useState(project.venue_street || '');
  const [venueCityStateZip, setVenueCityStateZip] = useState(project.venue_city_state_zip || '');
  const [clientStreet, setClientStreet] = useState(project.client_street || '');
  const [clientCityStateZip, setClientCityStateZip] = useState(project.client_city_state_zip || '');
  const [guestCount, setGuestCount] = useState(project.guest_count?.toString() || '');
  const [budget, setBudget] = useState(project.estimated_budget || '');
  const [signedDate, setSignedDate] = useState(project.contract_signed_date || '');
  const [partner1, setPartner1] = useState(project.client1_name || '');
  const [partner2, setPartner2] = useState(project.client2_name || '');
  const [canvaLink, setCanvaLink] = useState(project.canva_link || '');
  const [internalShare, setInternalShare] = useState(project.internal_file_share || '');
  const [clientFolder, setClientFolder] = useState(project.client_shared_folder || '');
  const [portalLink, setPortalLink] = useState(project.client_portal_link || '');
  const [clientWebsite, setClientWebsite] = useState(project.client_website || '');
  const [sharepointFolder, setSharepointFolder] = useState(project.sharepoint_folder || '');
  const [selectedColor, setSelectedColor] = useState(project.color);
  const [expandedNote, setExpandedNote] = useState<CallNote | null>(null);
  const [callNotes, setCallNotes] = useState(project.call_notes || []);
  const [editingNoteContent, setEditingNoteContent] = useState(false);

  // Text color classes — lighter muted tones
  const t = {
    heading: 'text-fq-dark/90',
    body: 'text-fq-muted/90',
    light: 'text-fq-muted/70',
    icon: 'text-fq-muted/60',
    label: 'text-fq-muted/80',
  };

  return (
    <div className="bg-fq-card rounded-xl border border-fq-border shadow-sm overflow-hidden flex flex-col min-w-0">
      {/* Color bar */}
      <div className="h-[4px]" style={{ backgroundColor: selectedColor }} />

      <div className="p-5 pb-3 flex-1">
        {/* Header: Name (clickable link) + Countdown */}
        <div className="flex items-start justify-between mb-0.5">
          <Link href={`/projects/${project.id}`} className="flex items-center gap-1.5 min-w-0 group">
            <span className={`${t.icon} text-[14px] shrink-0`}>♡</span>
            <h2 className={`font-heading text-[18px] font-semibold ${t.heading} leading-tight truncate group-hover:text-fq-accent transition-colors`}>
              {project.name}
            </h2>
          </Link>
          <div className="text-right shrink-0 ml-2">
            <span className={`font-heading text-[20px] font-bold tracking-tight ${countdown.isUrgent ? 'text-fq-alert' : t.heading}`}>
              {countdown.text}
            </span>
            <p className={`font-body text-[10px] ${t.light}`}>countdown</p>
          </div>
        </div>

        {/* Date */}
        <div className="ml-5 mb-2">
          <EditableField
            value={formatDate(eventDate)}
            onChange={setEventDate}
            className={`font-body text-[12px] ${t.light}`}
            placeholder="Event date..."
          />
        </div>

        {/* Service tier badge */}
        <div className="ml-5 mb-1">
          <EditableField
            value={serviceTier}
            onChange={setServiceTier}
            className="text-[11px] font-body font-medium text-fq-accent bg-fq-light-accent px-2.5 py-0.5 rounded-full"
            inputClassName="text-[11px] font-body text-fq-accent bg-fq-light-accent px-2.5 py-0.5 rounded-full"
            placeholder="Service tier..."
          />
        </div>

        {/* Concept on its own line */}
        <div className="ml-5 mb-3">
          <EditableField
            value={concept}
            onChange={setConcept}
            className={`text-[11px] font-body ${t.light} bg-fq-bg px-2.5 py-0.5 rounded-full`}
            inputClassName={`text-[11px] font-body ${t.light} bg-fq-bg px-2.5 py-0.5 rounded-full`}
            placeholder="Concept..."
          />
        </div>

        {/* Metadata rows — visibility controlled by card config */}
        <div className="space-y-1.5 ml-5 mb-4 text-[13px] font-body">
          {isFieldVisible('venue', 'first') && (
            <div className="flex items-center gap-2">
              <span className={`${t.icon} w-4 text-center text-[12px]`}>◉</span>
              <EditableField value={venueName} onChange={setVenueName}
                className={`font-heading text-[15px] font-semibold ${t.heading}`} placeholder="Venue name..." />
            </div>
          )}

          {isFieldVisible('venue_address', 'first') && (
            <EditableAddressBox icon={<span>&nbsp;</span>} street={venueStreet} cityStateZip={venueCityStateZip}
              onStreetChange={setVenueStreet} onCityStateZipChange={setVenueCityStateZip}
              streetPlaceholder="Venue street address..." cityPlaceholder="City, State ZIP..." />
          )}

          {isFieldVisible('guests', 'first') && (
            <div className="flex items-center gap-2">
              <span className={`${t.icon} w-4 text-center text-[12px]`}>♗</span>
              <EditableField value={guestCount ? `${guestCount} guests` : ''} onChange={(v) => setGuestCount(v.replace(/[^0-9]/g, ''))}
                className={t.body} placeholder="Guest count..." />
            </div>
          )}

          {isFieldVisible('budget', 'first') && (
            <div className="flex items-center gap-2">
              <span className={`${t.icon} w-4 text-center text-[12px]`}>$</span>
              <EditableField value={budget} onChange={setBudget} className={t.body} placeholder="Budget..." />
            </div>
          )}

          {isFieldVisible('signed_date', 'first') && (
            <div className="flex items-center gap-2">
              <span className={`${t.icon} w-4 text-center text-[12px]`}>☐</span>
              <EditableField value={signedDate ? `Signed ${formatDate(signedDate)}` : ''} onChange={(v) => setSignedDate(v.replace('Signed ', ''))}
                className={t.body} placeholder="Signed date..." />
            </div>
          )}

          {/* Custom fields assigned to first pane */}
          {customFields.filter(cf => isFieldVisible(cf.id, 'first')).map(cf => (
            <div key={cf.id} className="flex items-center gap-2">
              <span className={`${t.icon} w-4 text-center text-[12px]`}>•</span>
              <span className={`font-body text-[11px] ${t.light} w-[80px] shrink-0`}>{cf.label}</span>
              <EditableField value={cf.value} onChange={(v) => updateCustomFieldValue(cf.id, v)}
                className={`font-body text-[13px] ${t.body}`} placeholder={`${cf.label}...`} />
            </div>
          ))}
        </div>

        {/* Task Progress */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className={`font-body text-[12px] ${t.label}`}>Task Progress</span>
            <span className={`font-body text-[12px] ${t.light}`}>
              {project.tasks_completed}/{project.tasks_total}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-[6px] bg-fq-border rounded-full overflow-hidden">
              <div
                className="h-full rounded-full animate-progress"
                style={{
                  width: `${progressPct}%`,
                  backgroundColor: selectedColor,
                }}
              />
            </div>
            <span className={`font-body text-[11px] ${t.light} w-8 text-right`}>
              {Math.round(progressPct)}%
            </span>
          </div>
        </div>

        {/* Links & Resources */}
        <div className="mb-3 space-y-1">
          <LinkRow icon="✎" label="Design Deck / Canva" value={canvaLink} onChange={setCanvaLink} />
          <LinkRow icon="⊡" label="Internal File Share" value={internalShare} onChange={setInternalShare} />
          <LinkRow icon="⊡" label="Client Shared Folder" value={clientFolder} onChange={setClientFolder} />
          <LinkRow icon="⊞" label="Client Portal" value={portalLink} onChange={setPortalLink} />
          <LinkRow icon="◎" label="Client Website" value={clientWebsite} onChange={setClientWebsite} />
          <LinkRow icon="⊘" label="SharePoint Folder" value={sharepointFolder} onChange={setSharepointFolder} />
        </div>

        {/* Badges row — overdue links to tasks, call notes links to notes page */}
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          {project.overdue_count > 0 && (
            <Link
              href={`/tasks?client=${project.id}&filter=overdue`}
              className="text-[11px] font-body font-medium text-fq-alert bg-fq-alert/10 px-2 py-0.5 rounded-full hover:bg-fq-alert/20 transition-colors"
            >
              {project.overdue_count} overdue
            </Link>
          )}
          {callNoteCount > 0 && (
            <Link
              href={`/projects/${project.id}/notes`}
              className={`text-[11px] font-body ${t.light} bg-fq-bg px-2 py-0.5 rounded-full hover:bg-fq-border/50 transition-colors`}
            >
              ☐ {callNoteCount} call note{callNoteCount !== 1 ? 's' : ''}
            </Link>
          )}
        </div>

        {/* Team members */}
        <div className="flex flex-wrap items-center gap-1.5 mb-2">
          {project.assigned_to.map((id) => {
            const member = getTeamMember(id);
            if (!member) return null;
            return (
              <span
                key={id}
                className={`text-[11px] font-body ${t.light} bg-fq-bg px-2 py-0.5 rounded-full`}
              >
                {member.name}
              </span>
            );
          })}
        </div>

        {/* Next Call Agenda — editable */}
        <EditableAgendaSection initialItems={project.next_call_agenda || []} tClasses={t} />

        {/* View project link */}
        <Link
          href={`/projects/${project.id}`}
          className="inline-block text-[11px] font-body font-medium text-fq-accent bg-fq-light-accent px-2.5 py-0.5 rounded-full hover:bg-fq-accent/20 transition-colors"
        >
          View project
        </Link>
      </div>

      {/* Settings gear */}
      <div className="flex items-center justify-end border-t border-fq-border">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`px-3 py-2.5 text-[12px] font-body ${showSettings ? 'text-fq-accent' : t.light} hover:text-fq-dark hover:bg-fq-bg/50 transition-colors`}
          title="Card settings"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2">
            <circle cx="8" cy="8" r="2.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41"/>
          </svg>
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <CardSettingsPanel
          fields={cardFields}
          customFields={customFields}
          onFieldsChange={handleFieldsChange}
          onCustomFieldsChange={handleCustomFieldsChange}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Details */}
      <div className="border-t border-fq-border px-5 py-5">
          <h3 className={`font-heading text-[16px] font-semibold ${t.heading} mb-3`}>
            Client Details
          </h3>

          {/* Partner cards */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="border border-fq-border rounded-lg p-2.5">
              <p className={`font-body text-[10px] ${t.light} mb-0.5`}>Partner 1</p>
              <EditableField value={partner1} onChange={setPartner1}
                className={`font-body text-[13px] ${t.heading} font-medium`} placeholder="Partner name..." />
            </div>
            <div className="border border-fq-border rounded-lg p-2.5">
              <p className={`font-body text-[10px] ${t.light} mb-0.5`}>Partner 2</p>
              <EditableField value={partner2} onChange={setPartner2}
                className={`font-body text-[13px] ${t.heading} font-medium`} placeholder="Partner name..." />
            </div>
          </div>

          {/* Client Address */}
          <div className="mb-4">
            <p className={`font-body text-[10px] ${t.light} mb-1`}>Client Address</p>
            <div className="text-[13px] font-body ml-1">
              <EditableAddressBox icon="⌂" street={clientStreet} cityStateZip={clientCityStateZip}
                onStreetChange={setClientStreet} onCityStateZipChange={setClientCityStateZip}
                streetPlaceholder="Client street address..." cityPlaceholder="City, State ZIP..." />
            </div>
          </div>

          {/* Custom fields assigned to expanded pane */}
          {customFields.filter(cf => isFieldVisible(cf.id, 'expanded')).length > 0 && (
            <div className="mb-4 space-y-1.5">
              {customFields.filter(cf => isFieldVisible(cf.id, 'expanded')).map(cf => (
                <div key={cf.id} className="flex items-center gap-2">
                  <span className={`${t.icon} w-4 text-center text-[12px]`}>•</span>
                  <span className={`font-body text-[11px] ${t.light} w-[80px] shrink-0`}>{cf.label}</span>
                  <EditableField value={cf.value} onChange={(v) => updateCustomFieldValue(cf.id, v)}
                    className={`font-body text-[13px] ${t.body}`} placeholder={`${cf.label}...`} />
                </div>
              ))}
            </div>
          )}

          {/* Latest Call Note — double-click to open editable modal */}
          {callNotes.length > 0 && (
            <div className="mb-4">
              <div className={`font-heading text-[14px] font-semibold ${t.heading} mb-2 flex items-center gap-1.5`}>
                <span className="text-fq-accent/70">✦</span>
                Latest Call Note
                <span className={`font-body text-[11px] font-normal ${t.light}`}>
                  ({callNotes.length} total) — double-click to edit
                </span>
              </div>
              <div
                onDoubleClick={() => { setExpandedNote(callNotes[0]); setEditingNoteContent(false); }}
                className="block bg-fq-bg rounded-lg p-3 border-l-[3px] border-fq-accent/60 hover:bg-fq-light-accent transition-colors mt-2 cursor-default"
              >
                <p className={`font-body text-[12px] font-semibold ${t.heading} mb-1`}>
                  {formatDate(callNotes[0].date)}
                  {callNotes[0].title && <span className={`font-normal ${t.light} ml-2`}>— {callNotes[0].title}</span>}
                </p>
                <p className={`font-body text-[12px] ${t.light} leading-relaxed line-clamp-3`}>
                  {callNotes[0].raw_text.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').substring(0, 200)}
                </p>
              </div>
            </div>
          )}

          {/* Project Color palette — at the bottom */}
          {project.project_colors && project.project_colors.length > 0 && (
            <div>
              <p className="font-body text-[12px] text-fq-accent/80 font-medium mb-2">Project Color</p>
              <div className="flex flex-wrap gap-1.5">
                {project.project_colors.map((c, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedColor(c)}
                    className={`w-7 h-7 rounded-full border-2 cursor-pointer hover:scale-110 transition-transform ${
                      selectedColor === c ? 'border-fq-dark/60 ring-2 ring-fq-accent/30' : 'border-fq-border/50'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          )}
      </div>

      {/* Call Note Edit Modal */}
      {expandedNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setExpandedNote(null)} />
          <div className="relative bg-fq-card rounded-2xl border border-fq-border shadow-2xl w-[680px] max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-5 pb-3 border-b border-fq-border">
              <div className="flex-1 min-w-0 mr-4">
                <p className={`font-heading text-[16px] font-semibold ${t.heading}`}>
                  {expandedNote.title || 'Call Note'}
                </p>
                <p className={`font-body text-[12px] ${t.light}`}>{formatDate(expandedNote.date)}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {editingNoteContent && (
                  <button onClick={() => setEditingNoteContent(false)} className={`font-body text-[11px] text-fq-accent hover:text-fq-dark transition-colors`}>✓ Done editing</button>
                )}
                <button onClick={() => setExpandedNote(null)} className="text-fq-muted/40 hover:text-fq-dark text-[18px]">✕</button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {!editingNoteContent ? (
                <div
                  onDoubleClick={() => setEditingNoteContent(true)}
                  className={`font-body text-[13px] ${t.body} leading-relaxed whitespace-pre-wrap cursor-default hover:bg-fq-bg/30 rounded-lg p-2 -m-2 transition-colors [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5`}
                  dangerouslySetInnerHTML={{ __html: expandedNote.raw_text }}
                />
              ) : (
                <div
                  contentEditable
                  suppressContentEditableWarning
                  ref={(el) => { if (el && !el.innerHTML) el.innerHTML = expandedNote.raw_text; }}
                  onInput={(e) => {
                    const html = (e.target as HTMLDivElement).innerHTML;
                    const updated = { ...expandedNote, raw_text: html };
                    setExpandedNote(updated);
                    setCallNotes(callNotes.map(n => n.id === expandedNote.id ? updated : n));
                  }}
                  className="min-h-[200px] font-body text-[13px] text-fq-muted/90 leading-relaxed outline-none border border-fq-border rounded-lg p-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5"
                />
              )}
              {!editingNoteContent && (
                <p className={`font-body text-[10px] ${t.light} mt-3`}>Double-click to edit</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
