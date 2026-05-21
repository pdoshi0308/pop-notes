'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Check, Loader2, MapPin, ChevronRight, ChevronLeft } from 'lucide-react';
import type { FieldDefinition } from '@/lib/fields';
import { formatUkMobile } from '@/lib/phone';

type ResolvedField = FieldDefinition & { required: boolean };
type WorkspaceInfo = { id: string; name: string };

interface ConfigResponse {
  ok: boolean;
  workspace: WorkspaceInfo;
  fields: ResolvedField[];
  error?: string;
}

const STEP_SIZE = 4;

export default function RegisterClient() {
  const search = useSearchParams();
  const workspaceId = search.get('workspace') ?? '';
  const refParam = search.get('ref') ?? '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);
  const [fields, setFields] = useState<ResolvedField[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [postcodeBusy, setPostcodeBusy] = useState(false);

  // ------- Load config -------
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        if (!workspaceId) throw new Error('Missing workspace');
        const res = await fetch(
          `/api/workspace-config?workspace_id=${encodeURIComponent(workspaceId)}`
        );
        const data: ConfigResponse = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error ?? 'Failed to load');
        if (cancelled) return;
        setWorkspace(data.workspace);
        setFields(data.fields);

        // Pre-fill mobile number from the SMS link.
        const initial: Record<string, string> = {};
        if (refParam) {
          const pretty = formatUkMobile(refParam);
          initial.mobile_number = pretty;
        }
        setValues(initial);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [workspaceId, refParam]);

  // ------- Chunk into steps when >4 fields -------
  const steps = useMemo(() => {
    if (fields.length <= STEP_SIZE) return [fields];
    const chunks: ResolvedField[][] = [];
    for (let i = 0; i < fields.length; i += STEP_SIZE) {
      chunks.push(fields.slice(i, i + STEP_SIZE));
    }
    return chunks;
  }, [fields]);

  const currentFields = steps[step] ?? [];
  const isLastStep = step === steps.length - 1;

  function setValue(id: string, value: string) {
    setValues((prev) => ({ ...prev, [id]: value }));
  }

  // ------- Postcode lookup via postcodes.io -------
  async function tryPostcodeLookup(postcode: string) {
    const cleaned = postcode.replace(/\s+/g, '').toUpperCase();
    if (cleaned.length < 5) return;
    setPostcodeBusy(true);
    try {
      const res = await fetch(`https://api.postcodes.io/postcodes/${cleaned}`);
      if (!res.ok) return;
      const data = await res.json();
      const r = data?.result;
      if (!r) return;
      setValues((prev) => {
        const next = { ...prev };
        if (!next.address_line_1) {
          next.address_line_1 = [r.thoroughfare, r.admin_ward]
            .filter(Boolean)
            .join(', ');
        }
        if (!next.address_line_2) {
          next.address_line_2 = r.admin_district ?? r.parish ?? '';
        }
        return next;
      });
    } catch {
      // silently ignore — patient can still type manually
    } finally {
      setPostcodeBusy(false);
    }
  }

  function validateStep(): string | null {
    for (const f of currentFields) {
      if (f.required && !values[f.id]?.toString().trim()) {
        return `Please fill in ${f.label.toLowerCase()}.`;
      }
    }
    return null;
  }

  async function handleNext() {
    const err = validateStep();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    if (isLastStep) {
      await submit();
    } else {
      setStep((s) => s + 1);
    }
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          // Use the ref the SMS link carried — that's the channel reception
          // is already subscribed to. The patient's edited mobile_number
          // still rides along inside `fields`.
          phone: refParam || values.mobile_number,
          fields: values,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Submit failed');
      setSubmitted(true);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Could not submit — please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ------- Render states -------
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error && !fields.length) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="card p-6 text-center max-w-sm">
          <p className="text-brand-error font-medium mb-2">Something&apos;s not right</p>
          <p className="text-sm text-slate-600">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return <ThanksScreen practiceName={workspace?.name ?? 'the practice'} />;
  }

  const progress = ((step + 1) / steps.length) * 100;

  return (
    <div className="flex-1 px-5 py-8 max-w-md mx-auto w-full">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
          Patient registration
        </p>
        <h1 className="text-2xl font-bold mt-1">{workspace?.name}</h1>
        {steps.length > 1 && (
          <div className="mt-4 h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full bg-brand-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </header>

      <form
        className="space-y-4 animate-fade-in"
        onSubmit={(e) => {
          e.preventDefault();
          handleNext();
        }}
      >
        {currentFields.map((field) => (
          <FieldRow
            key={field.id}
            field={field}
            value={values[field.id] ?? ''}
            onChange={(v) => setValue(field.id, v)}
            onPostcodeBlur={() =>
              field.postcodeLookup && tryPostcodeLookup(values[field.id] ?? '')
            }
            postcodeBusy={field.postcodeLookup && postcodeBusy}
          />
        ))}

        {error && (
          <p className="text-sm text-brand-error font-medium">{error}</p>
        )}

        <div className="flex items-center gap-2 pt-2">
          {step > 0 && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setStep((s) => s - 1)}
              disabled={submitting}
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          )}
          <button
            type="submit"
            className="btn-primary flex-1 py-3.5 text-base"
            disabled={submitting}
          >
            {submitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : isLastStep ? (
              <>Submit</>
            ) : (
              <>
                Continue <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Field renderer
// ---------------------------------------------------------------------------
function FieldRow({
  field,
  value,
  onChange,
  onPostcodeBlur,
  postcodeBusy,
}: {
  field: ResolvedField;
  value: string;
  onChange: (v: string) => void;
  onPostcodeBlur?: () => void;
  postcodeBusy?: boolean;
}) {
  const common = {
    id: `f-${field.id}`,
    name: field.id,
    required: field.required,
    placeholder: field.placeholder,
    value,
    onChange: (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => onChange(e.target.value),
    className: 'input text-base',
  };

  let control: React.ReactNode;
  if (field.type === 'textarea') {
    control = <textarea {...common} rows={4} />;
  } else if (field.type === 'select') {
    control = (
      <select {...common}>
        <option value="">Choose one…</option>
        {field.options?.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  } else if (field.type === 'radio') {
    control = (
      <div className="grid grid-cols-2 gap-2">
        {field.options?.map((o) => {
          const active = value === o;
          return (
            <button
              key={o}
              type="button"
              onClick={() => onChange(o)}
              className={[
                'py-3 rounded-xl border text-sm font-medium transition',
                active
                  ? 'bg-brand-primary text-white border-brand-primary'
                  : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300',
              ].join(' ')}
            >
              {o}
            </button>
          );
        })}
      </div>
    );
  } else {
    control = (
      <div className="relative">
        <input
          {...common}
          type={field.type}
          inputMode={field.type === 'tel' ? 'tel' : undefined}
          onBlur={onPostcodeBlur}
        />
        {postcodeBusy && (
          <Loader2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />
        )}
        {field.postcodeLookup && !postcodeBusy && (
          <MapPin className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
        )}
      </div>
    );
  }

  return (
    <div>
      <label htmlFor={`f-${field.id}`} className="label">
        {field.label}
        {field.required && <span className="text-brand-error ml-0.5">*</span>}
      </label>
      {control}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Confirmation screen
// ---------------------------------------------------------------------------
function ThanksScreen({ practiceName }: { practiceName: string }) {
  return (
    <div className="flex-1 flex items-center justify-center px-6">
      <div className="text-center max-w-sm animate-pop-in">
        <div className="w-20 h-20 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-6">
          <svg viewBox="0 0 36 36" className="w-10 h-10 text-brand-success">
            <path
              d="M7 19 L15 27 L29 11"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="60"
              className="animate-check"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-bold mb-2">Thanks!</h2>
        <p className="text-slate-600">
          Your details have been sent to {practiceName}.
        </p>
      </div>
    </div>
  );
}
