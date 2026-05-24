'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CheckCircle2, Circle, ExternalLink, ArrowRight } from 'lucide-react';

const INSTALL_FLAG_KEY = 'pingform.extension_installed';

type Props = {
  chromeStoreUrl: string;
  submissionCount: number;
};

export function SetupChecklist({ chromeStoreUrl, submissionCount }: Props) {
  const [hasInstalled, setHasInstalled] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      if (localStorage.getItem(INSTALL_FLAG_KEY) === '1') {
        setHasInstalled(true);
      }
    } catch {
      // localStorage may be unavailable (private mode); fall through
    }
  }, []);

  const hasSubmissions = submissionCount > 0;
  // If they've ever received a submission, the extension is clearly installed —
  // auto-tick so long-time users don't see a stale "install me" step.
  const installDone = hasInstalled || hasSubmissions;

  const steps = [
    { label: 'Create your account', done: true },
    { label: 'Install the Pingform Chrome extension', done: installDone },
    { label: 'Send your first registration form', done: hasSubmissions },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const allDone = completedCount === steps.length;

  // Hide entirely before hydration to avoid a flash of "install me" for users
  // who've already ticked it locally.
  if (!mounted) {
    return <div className="card p-5 h-[180px] animate-pulse bg-slate-50/40" />;
  }

  if (allDone) {
    return (
      <div className="card p-4 flex items-center justify-between gap-3">
        <p className="text-sm text-slate-600 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          Setup complete — you're all set.
        </p>
        <Link
          href="/#how-it-works"
          className="text-xs text-slate-500 hover:text-brand-primary inline-flex items-center gap-1"
        >
          Refresher <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    );
  }

  const markInstalled = () => {
    try {
      localStorage.setItem(INSTALL_FLAG_KEY, '1');
    } catch {
      // ignore
    }
    setHasInstalled(true);
  };

  return (
    <div className="card p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold">Get started</h2>
        <span className="text-xs text-slate-400">
          {completedCount} of {steps.length} done
        </span>
      </div>
      <p className="text-sm text-slate-600 mt-1">
        Three quick steps and your front desk can start texting forms.
      </p>

      <ol className="mt-5 space-y-3">
        {steps.map((step, i) => (
          <li
            key={step.label}
            className="flex items-start gap-3 text-sm"
          >
            {step.done ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            ) : (
              <Circle className="w-5 h-5 text-slate-300 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p
                className={
                  step.done
                    ? 'text-slate-400 line-through'
                    : 'text-slate-800 font-medium'
                }
              >
                {step.label}
              </p>
              {/* Action only appears on the first unfinished step, to keep focus */}
              {!step.done && i === steps.findIndex((s) => !s.done) && (
                <div className="mt-2">
                  {i === 1 && (
                    <a
                      href={chromeStoreUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={markInstalled}
                      className="btn-primary inline-flex items-center gap-2 !py-2 !px-4 text-sm"
                    >
                      Add to Chrome <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                  {i === 2 && (
                    <Link
                      href="/dashboard/sms"
                      className="btn-primary inline-flex items-center gap-2 !py-2 !px-4 text-sm"
                    >
                      Customise your SMS <ArrowRight className="w-4 h-4" />
                    </Link>
                  )}
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-3 text-sm">
        <Link
          href="/#how-it-works"
          className="text-slate-500 hover:text-brand-primary inline-flex items-center gap-1"
        >
          See the 3-step flow <ArrowRight className="w-3 h-3" />
        </Link>
        {!installDone && (
          <button
            type="button"
            onClick={markInstalled}
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            Already installed?
          </button>
        )}
      </div>
    </div>
  );
}
