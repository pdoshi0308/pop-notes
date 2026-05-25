'use client';

import { useMemo, useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Loader2, Lock, Plus, Trash2 } from 'lucide-react';
import { FIELD_CATALOGUE, FIELD_BY_ID } from '@/lib/fields';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import { useUnsavedChanges } from '@/lib/use-unsaved-changes';
import { Notice, type NoticeState } from '../components/notice';

interface BuilderEntry {
  id: string;
  required: boolean;
  label?: string;
}

export default function FormBuilder({
  workspaceId,
  initial,
  canEdit,
}: {
  workspaceId: string;
  initial: BuilderEntry[];
  canEdit: boolean;
}) {
  const [entries, setEntries] = useState<BuilderEntry[]>(initial);
  const [savedSnapshot, setSavedSnapshot] = useState<BuilderEntry[]>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [note, setNote] = useState<NoticeState>(null);

  const dirty = useMemo(
    () => JSON.stringify(entries) !== JSON.stringify(savedSnapshot),
    [entries, savedSnapshot]
  );
  useUnsavedChanges(dirty);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const inUse = useMemo(() => new Set(entries.map((e) => e.id)), [entries]);
  const available = FIELD_CATALOGUE.filter((f) => !inUse.has(f.id));

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setEntries((prev) => {
      const oldIndex = prev.findIndex((p) => p.id === active.id);
      const newIndex = prev.findIndex((p) => p.id === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  function addField(id: string) {
    setEntries((prev) => [...prev, { id, required: false }]);
  }

  function removeField(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  function updateEntry(id: string, patch: Partial<BuilderEntry>) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    setNote(null);
    const supabase = createSupabaseBrowserClient();
    const payload = entries.map((e) => {
      const def = FIELD_BY_ID[e.id];
      const out: BuilderEntry = { id: e.id, required: !!e.required };
      if (def?.customLabel && e.label) out.label = e.label;
      return out;
    });
    const { error } = await supabase
      .from('form_configs')
      .upsert(
        {
          workspace_id: workspaceId,
          fields: payload,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'workspace_id' }
      );
    setSaving(false);
    if (!error) {
      setSavedSnapshot(entries);
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } else {
      setNote({ kind: 'err', text: error.message });
    }
  }

  return (
    <div className="px-6 md:px-8 py-8 md:py-10 max-w-6xl">
      <div className="flex items-center justify-between mb-8 gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Form Builder</h1>
          <p className="text-slate-600 mt-1">
            {canEdit
              ? 'Drag to reorder. Toggle which fields are required.'
              : 'Read-only — only admins can change the form.'}
          </p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-3">
            {saved && (
              <span className="text-sm text-brand-success font-medium animate-fade-in">
                Saved
              </span>
            )}
            <button className="btn-primary" onClick={save} disabled={saving || !dirty}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save changes'}
            </button>
          </div>
        )}
      </div>

      {note && <div className="mb-4"><Notice note={note} /></div>}

      <div className="grid lg:grid-cols-[1fr_400px] gap-8">
        <div>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
            On the form
          </h2>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={entries.map((e) => e.id)} strategy={verticalListSortingStrategy}>
              <ul className="space-y-2">
                {entries.map((entry) => (
                  <SortableRow
                    key={entry.id}
                    entry={entry}
                    canEdit={canEdit}
                    onRequiredChange={(r) => updateEntry(entry.id, { required: r })}
                    onLabelChange={(l) => updateEntry(entry.id, { label: l })}
                    onRemove={() => removeField(entry.id)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>

          {canEdit && available.length > 0 && (
            <>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mt-8 mb-3">
                Add a field
              </h2>
              <ul className="grid sm:grid-cols-2 gap-2">
                {available.map((f) => (
                  <li key={f.id}>
                    <button
                      className="w-full flex items-center justify-between p-3 rounded-xl border border-dashed border-slate-300 hover:border-brand-primary hover:bg-rose-50/40 transition text-left"
                      onClick={() => addField(f.id)}
                    >
                      <div>
                        <p className="text-sm font-medium">{f.label}</p>
                        {f.description && (
                          <p className="text-xs text-slate-500">{f.description}</p>
                        )}
                      </div>
                      <Plus className="w-4 h-4 text-slate-400" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <aside>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Preview
          </h2>
          <PhonePreview entries={entries} />
        </aside>
      </div>
    </div>
  );
}

function SortableRow({
  entry,
  canEdit,
  onRequiredChange,
  onLabelChange,
  onRemove,
}: {
  entry: BuilderEntry;
  canEdit: boolean;
  onRequiredChange: (v: boolean) => void;
  onLabelChange: (v: string) => void;
  onRemove: () => void;
}) {
  const def = FIELD_BY_ID[entry.id];
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: entry.id, disabled: !canEdit || !!def?.locked });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
  };

  if (!def) return null;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="card p-3 flex items-center gap-3"
    >
      <button
        className="p-1 text-slate-400 hover:text-slate-600 cursor-grab disabled:cursor-not-allowed"
        {...attributes}
        {...listeners}
        disabled={!canEdit || !!def.locked}
        title={!canEdit ? 'Read-only' : def.locked ? 'Locked' : 'Drag to reorder'}
      >
        {def.locked || !canEdit ? <Lock className="w-4 h-4" /> : <GripVertical className="w-4 h-4" />}
      </button>

      <div className="flex-1 min-w-0">
        {def.customLabel ? (
          <input
            className="w-full text-sm font-medium bg-transparent border-none outline-none focus:bg-slate-50 px-1 py-0.5 rounded disabled:cursor-not-allowed"
            value={entry.label ?? def.label}
            onChange={(e) => onLabelChange(e.target.value)}
            placeholder="Custom label"
            disabled={!canEdit}
          />
        ) : (
          <p className="text-sm font-medium truncate">{def.label}</p>
        )}
        <p className="text-xs text-slate-500 truncate">
          {def.type} {def.options ? `· ${def.options.join(' / ')}` : ''}
        </p>
      </div>

      <label className="flex items-center gap-2 text-xs text-slate-600 select-none">
        <input
          type="checkbox"
          checked={entry.required || !!def.alwaysOn}
          disabled={!canEdit || !!def.alwaysOn}
          onChange={(e) => onRequiredChange(e.target.checked)}
          className="accent-brand-primary"
        />
        Required
      </label>

      {canEdit && (
        <button
          className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-brand-error transition disabled:opacity-30 disabled:hover:bg-transparent"
          onClick={onRemove}
          disabled={!!def.alwaysOn}
          title={def.alwaysOn ? 'This field is always on' : 'Remove'}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </li>
  );
}

function PhonePreview({ entries }: { entries: BuilderEntry[] }) {
  return (
    <div className="mx-auto w-[300px] rounded-[36px] border border-slate-200 bg-white p-3 shadow-card">
      <div className="rounded-[28px] bg-brand-bg p-4 h-[520px] overflow-y-auto">
        <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
          Registration
        </p>
        <h3 className="text-lg font-bold mt-1 mb-3">Your Business</h3>
        <div className="space-y-3">
          {entries.slice(0, 6).map((entry) => {
            const def = FIELD_BY_ID[entry.id];
            if (!def) return null;
            return (
              <div key={entry.id}>
                <p className="text-xs font-medium text-slate-700 mb-1">
                  {entry.label ?? def.label}
                  {(entry.required || def.alwaysOn) && (
                    <span className="text-brand-error ml-0.5">*</span>
                  )}
                </p>
                <div className="h-10 rounded-lg border border-slate-200 bg-white" />
              </div>
            );
          })}
          {entries.length > 6 && (
            <p className="text-xs text-slate-400 text-center pt-2">
              + {entries.length - 6} more on the next step
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
