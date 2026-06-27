import { formatDate } from '@/lib/i18n/format';
import type { Locale } from '@/lib/i18n/config';
import { type DictionaryShapes } from '@/lib/i18n/get-dictionary';
import { getMeetings } from '@/lib/ventures/fixtures';
import type { VentureSummary } from '@/lib/ventures/types';

type Dict = DictionaryShapes['ventures'];

export function MeetingsView({
  locale,
  dict,
  venture,
}: {
  locale: Locale;
  dict: Dict;
  venture: VentureSummary;
}) {
  const meetings = getMeetings(venture.id);
  const now = Date.now();
  const upcoming = meetings.filter((m) => new Date(m.startsAt).getTime() >= now);
  const past = meetings.filter((m) => new Date(m.startsAt).getTime() < now);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-widest text-fg-faint">{venture.name}</span>
        <h1 className="text-h1 font-semibold text-fg">{dict.meetings.title}</h1>
        <p className="text-sm text-fg-muted">{dict.meetings.subtitle}</p>
        <button
          type="button"
          className="self-start rounded-md bg-brand px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
        >
          {dict.meetings.scheduleCta}
        </button>
      </header>

      <Section
        title={dict.meetings.upcomingHeading}
        meetings={upcoming}
        dict={dict}
        locale={locale}
      />
      <Section title={dict.meetings.pastHeading} meetings={past} dict={dict} locale={locale} />
    </div>
  );
}

function Section({
  title,
  meetings,
  dict,
  locale,
}: {
  title: string;
  meetings: readonly ReturnType<typeof getMeetings>[number][];
  dict: Dict;
  locale: Locale;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-h3 font-semibold text-fg">{title}</h2>
      {meetings.length === 0 ? (
        <p className="rounded-xl border border-edge bg-elevated p-5 text-sm text-fg-muted">
          {dict.meetings.noMeetings}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {meetings.map((meeting) => (
            <li
              key={meeting.id}
              className="flex flex-col gap-2 rounded-xl border border-edge bg-elevated p-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <span className="text-body font-medium text-fg">{meeting.title}</span>
                <span className="text-xs text-fg-faint">
                  {formatDate(locale, meeting.startsAt, 'medium')}
                </span>
              </div>
              {meeting.agenda ? <p className="text-sm text-fg-muted">{meeting.agenda}</p> : null}
              <div className="flex flex-wrap gap-2">
                {meeting.agenda ? (
                  <button
                    type="button"
                    className="rounded-md border border-edge px-3 py-1 text-xs text-fg transition-colors hover:border-edge-strong"
                  >
                    {dict.meetings.openAgenda}
                  </button>
                ) : null}
                {meeting.minutes ? (
                  <button
                    type="button"
                    className="rounded-md border border-edge px-3 py-1 text-xs text-fg transition-colors hover:border-edge-strong"
                  >
                    {dict.meetings.openMinutes}
                  </button>
                ) : null}
                {meeting.linkedVoteId ? (
                  <span className="rounded-full border border-brand/40 bg-brand/5 px-3 py-0.5 text-xs text-fg">
                    {dict.meetings.linkedVote}
                  </span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
