import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-2xl text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full
                        bg-indigo-50 text-brand-primary text-sm font-medium mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-primary" />
          Now in beta
        </div>
        <h1 className="text-5xl font-extrabold tracking-tight mb-4">
          Send registration forms <span className="text-brand-primary">over SMS</span>.
        </h1>
        <p className="text-lg text-slate-600 mb-8">
          Popform lets your reception team send a patient a registration form while
          they&apos;re still on the phone — and receive the completed details
          back the moment they hit submit.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/dashboard" className="btn-primary">
            Open dashboard
          </Link>
          <a
            href="https://github.com"
            className="btn-secondary"
            target="_blank"
            rel="noreferrer"
          >
            Read the docs
          </a>
        </div>
      </div>
    </main>
  );
}
