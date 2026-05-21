'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Check,
  Loader2,
  MapPin,
  ChevronRight,
  ChevronLeft,
  Search,
} from 'lucide-react';
import type { FieldDefinition } from '@/lib/fields';
import { formatUkMobile } from '@/lib/phone';
import { BRAND, brandUrl } from '@/lib/brand';

type ResolvedField = FieldDefinition & { required: boolean };
type WorkspaceInfo = { id: string; name: string };

interface ConfigResponse {
  ok: boolean;
  workspace: WorkspaceInfo;
  fields: ResolvedField[];
  error?: string;
}

interface PostcodeMatch {
  town: string;
  district: string;
  ward: string;
  thoroughfare?: string;
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
  const [postcodeMatch, setPostcodeMatch] = useState<PostcodeMatch | null>(null);
  const [postcodeNotFound, setPostcodeNotFound] = useState(false);

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

        const initial: Record<string, string> = {};
        if (refParam) initial.mobile_number = formatUkMobile(refParam);
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

  // ------- Postcode lookup -------
  async function doPostcodeLookup(raw: string) {
    const cleaned = raw.replace(/\s+/g, '').toUpperCase();
    if (cleaned.length < 5) return;
    setPostcodeBusy(true);
    setPostcodeNotFound(false);
    try {
      const res = await fetch(`https://api.postcodes.io/postcodes/${cleaned}`);
      if (!res.ok) {
        setPostcodeMatch(null);
        setPostcodeNotFound(true);
        return;
      }
      const data = await res.json();
      const r = data?.result;
      if (!r) {
        setPostcodeMatch(null);
        setPostcodeNotFound(true);
        return;
      }
      const town = r.admin_district || r.parish || r.admin_county || '';
      setPostcodeMatch({
        town,
        district: r.admin_district ?? '',
        ward: r.admin_ward ?? '',
        thoroughfare: r.thoroughfare ?? undefined,
      });
      // Format the postcode nicely (e.g. "SW1A 1AA"). The town is shown in
      // the success chip below — we deliberately don't write it into
      // address_line_2 because that's reserved for "Flat / apartment" both
      // semantically and for browser autofill (autocomplete="address-line2").
      setValues((prev) => ({
        ...prev,
        postcode: (cleaned.slice(0, -3) + ' ' + cleaned.slice(-3)).trim(),
      }));
    } catch {
      setPostcodeMatch(null);
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
      // Scroll to top on step change so patient sees the new step header.
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
          <p className="text-brand-error font-medium mb-2">
            Something&apos;s not right
          </p>
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
    <div className="flex-1 flex flex-col w-full max-w-md mx-auto"
         style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {/* Sticky header with progress */}
      <header className="sticky top-0 z-10 bg-brand-bg/95 backdrop-blur px-5 pt-6 pb-3 border-b border-slate-100">
        <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
          Patient registration
        </p>
        <h1 className="text-xl font-bold mt-0.5">{workspace?.name}</h1>
        {steps.length > 1 && (
          <div className="mt-3 h-1 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full bg-brand-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
        {steps.length > 1 && (
          <p className="text-[11px] text-slate-400 mt-1.5">
            Step {step + 1} of {steps.length}
          </p>
        )}
      </header>

      <form
        className="flex-1 px-5 py-5 space-y-5 animate-fade-in pb-32"
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
            onChange={(v) => {
              setValue(field.id, v);
              if (field.id === 'postcode') {
                // Reset success/error indicators when the patient edits the field.
                setPostcodeMatch(null);
                setPostcodeNotFound(false);
              }
            }}
            postcodeBusy={field.postcodeLookup && postcodeBusy}
            postcodeMatch={field.postcodeLookup ? postcodeMatch : null}
            postcodeNotFound={field.postcodeLookup ? postcodeNotFound : false}
            onPostcodeFind={() =>
              field.postcodeLookup && doPostcodeLookup(values[field.id] ?? '')
            }
          />
        ))}

        {error && (
          <p className="text-sm text-brand-error font-medium" role="alert">
            {error}
          </p>
        )}
      </form>

      {/* Sticky bottom action bar — always reachable by thumb. */}
      <div
        className="sticky bottom-0 left-0 right-0 bg-brand-bg/95 backdrop-blur border-t border-slate-100 px-5 pt-3 pb-5 flex items-center gap-2"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1.25rem)' }}
      >
        {step > 0 && (
          <button
            type="button"
            className="btn-secondary py-4 px-5"
            onClick={() => setStep((s) => s - 1)}
            disabled={submitting}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        <button
          type="button"
          onClick={handleNext}
          className="btn-primary flex-1 py-4 text-base font-semibold"
          disabled={submitting}
        >
          {submitting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : isLastStep ? (
            <>Submit</>
          ) : (
            <>
              Continue <ChevronRight className="w-5 h-5" />
            </>
          )}
        </button>
      </div>
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
  onPostcodeFind,
  postcodeBusy,
  postcodeMatch,
  postcodeNotFound,
}: {
  field: ResolvedField;
  value: string;
  onChange: (v: string) => void;
  onPostcodeFind?: () => void;
  postcodeBusy?: boolean;
  postcodeMatch?: PostcodeMatch | null;
  postcodeNotFound?: boolean;
}) {
  const autoComplete = AUTOCOMPLETE_BY_FIELD[field.id];
  const inputMode = INPUT_MODE_BY_FIELD[field.id] ?? INPUT_MODE_BY_TYPE[field.type];

  const baseInputClass =
    'input text-base py-4 rounded-2xl placeholder:text-slate-400';

  let control: React.ReactNode;

  if (field.type === 'textarea') {
    control = (
      <textarea
        id={`f-${field.id}`}
        name={field.id}
        required={field.required}
        placeholder={field.placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        className={baseInputClass}
      />
    );
  } else if (field.type === 'select') {
    control = (
      <select
        id={`f-${field.id}`}
        name={field.id}
        required={field.required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={baseInputClass}
      >
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
      <div className="grid grid-cols-2 gap-2.5">
        {field.options?.map((o) => {
          const active = value === o;
          return (
            <button
              key={o}
              type="button"
              onClick={() => onChange(o)}
              className={[
                'py-4 rounded-2xl border text-base font-medium transition active:scale-[0.98]',
                active
                  ? 'bg-brand-primary text-white border-brand-primary shadow-sm'
                  : 'bg-white border-slate-200 text-slate-700',
              ].join(' ')}
            >
              {o}
            </button>
          );
        })}
      </div>
    );
  } else if (field.postcodeLookup) {
    // Postcode field gets an inline Find button + result indicator.
    control = (
      <div className="space-y-2">
        <div className="flex gap-2">
          <input
            id={`f-${field.id}`}
            name={field.id}
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="postal-code"
            placeholder={field.placeholder}
            required={field.required}
            value={value}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            className={baseInputClass + ' flex-1 tracking-wider font-medium'}
          />
          <button
            type="button"
            onClick={onPostcodeFind}
            disabled={postcodeBusy || value.replace(/\s+/g, '').length < 5}
            className="px-4 rounded-2xl bg-brand-primary text-white font-semibold text-sm disabled:opacity-40 disabled:bg-slate-200 disabled:text-slate-400 active:scale-[0.97] transition flex items-center gap-1.5"
          >
            {postcodeBusy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Search className="w-4 h-4" /> Find
              </>
            )}
          </button>
        </div>
        {postcodeMatch && (
          <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 animate-fade-in">
            <Check className="w-4 h-4 shrink-0" />
            <span>
              Found:&nbsp;
              <span className="font-semibold">
                {[postcodeMatch.thoroughfare, postcodeMatch.town]
                  .filter(Boolean)
                  .join(', ')}
              </span>
              . Now add your house number below.
            </span>
          </div>
        )}
        {postcodeNotFound && (
          <p className="text-xs text-brand-error">
            We couldn&apos;t find that postcode. Type your address manually below.
          </p>
        )}
      </div>
    );
  } else {
    control = (
      <input
        id={`f-${field.id}`}
        name={field.id}
        type={field.type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        required={field.required}
        placeholder={field.placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={baseInputClass}
      />
    );
  }

  return (
    <div>
      <label
        htmlFor={`f-${field.id}`}
        className="block text-sm font-semibold text-slate-700 mb-2"
      >
        {field.label}
        {field.required && <span className="text-brand-error ml-0.5">*</span>}
      </label>
      {control}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Native fill / keyboard hints — make iOS + Android prefill from saved data.
// ---------------------------------------------------------------------------
const AUTOCOMPLETE_BY_FIELD: Record<string, string> = {
  full_name: 'name',
  email: 'email',
  mobile_number: 'tel',
  date_of_birth: 'bday',
  address_line_1: 'address-line1',
  address_line_2: 'address-line2',
  postcode: 'postal-code',
  emergency_contact_number: 'tel',
};

const INPUT_MODE_BY_FIELD: Record<string, React.HTMLAttributes<unknown>['inputMode']> = {
  mobile_number: 'tel',
  emergency_contact_number: 'tel',
  email: 'email',
};

const INPUT_MODE_BY_TYPE: Record<string, React.HTMLAttributes<unknown>['inputMode']> = {
  tel: 'tel',
  email: 'email',
};

// ---------------------------------------------------------------------------
// Confirmation screen
// ---------------------------------------------------------------------------
function ThanksScreen({ practiceName }: { practiceName: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-10">
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

      {/* Soft viral CTA — only seen after a successful submission, when the
          patient is feeling positive. Keeps the practice front of mind first. */}
      <a
        href={brandUrl()}
        target="_blank"
        rel="noreferrer noopener"
        className="mt-10 inline-flex items-center gap-2 px-4 py-2 rounded-full
                   bg-white border border-slate-200 shadow-sm
                   hover:border-indigo-200 hover:shadow transition group"
      >
        <span className="w-4 h-4 rounded-[5px] bg-gradient-to-br from-brand-primary to-brand-accent" />
        <span className="text-xs text-slate-600">
          Want this for your practice?{' '}
          <span className="font-semibold text-brand-primary">{BRAND.domain}</span>
        </span>
      </a>
    </div>
  );
}
