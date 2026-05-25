type Kind = 'ok' | 'err' | 'info';

export type NoticeState = { kind: Kind; text: string } | null;

export function Notice({ note }: { note: NoticeState }) {
  if (!note) return null;
  const style =
    note.kind === 'ok'
      ? 'text-emerald-700 bg-emerald-50 border-emerald-100'
      : note.kind === 'err'
        ? 'text-rose-700 bg-rose-50 border-rose-100'
        : 'text-slate-700 bg-slate-50 border-slate-200';
  return (
    <p className={`text-sm rounded-lg px-3 py-2 border ${style}`}>{note.text}</p>
  );
}
