'use client';

import { useMemo, useState } from 'react';
import type { Contact } from '@/lib/types';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const DAY_HEADERS = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];

interface CalendarViewProps {
  contacts: Contact[];
  onReschedule: (contact: Contact) => void;
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
}

interface CalendarDay {
  date: string; // YYYY-MM-DD
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  contacts: Contact[];
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildCalendarDays(month: Date, contacts: Contact[]): CalendarDay[] {
  const year = month.getFullYear();
  const m = month.getMonth();
  const today = toDateStr(new Date());

  // Group contacts by follow_up_date
  const byDate = new Map<string, Contact[]>();
  for (const c of contacts) {
    if (!c.follow_up_date) continue;
    const key = c.follow_up_date;
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(c);
  }

  // First day of the month
  const firstDay = new Date(year, m, 1);
  // Day of week (0=Sun). Convert to Mon=0 system.
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6; // Sunday becomes 6

  // Days in month
  const daysInMonth = new Date(year, m + 1, 0).getDate();

  // Build grid: pad leading days from previous month
  const days: CalendarDay[] = [];

  // Previous month padding
  const prevMonthDays = new Date(year, m, 0).getDate();
  for (let i = startDow - 1; i >= 0; i--) {
    const dayNum = prevMonthDays - i;
    const d = new Date(year, m - 1, dayNum);
    const dateStr = toDateStr(d);
    days.push({
      date: dateStr,
      dayNumber: dayNum,
      isCurrentMonth: false,
      isToday: dateStr === today,
      contacts: byDate.get(dateStr) || [],
    });
  }

  // Current month
  for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
    const d = new Date(year, m, dayNum);
    const dateStr = toDateStr(d);
    days.push({
      date: dateStr,
      dayNumber: dayNum,
      isCurrentMonth: true,
      isToday: dateStr === today,
      contacts: byDate.get(dateStr) || [],
    });
  }

  // Trailing days to fill 5 or 6 rows
  const totalRows = Math.ceil(days.length / 7);
  const totalCells = totalRows * 7;
  let nextDay = 1;
  while (days.length < totalCells) {
    const d = new Date(year, m + 1, nextDay);
    const dateStr = toDateStr(d);
    days.push({
      date: dateStr,
      dayNumber: nextDay,
      isCurrentMonth: false,
      isToday: dateStr === today,
      contacts: byDate.get(dateStr) || [],
    });
    nextDay++;
  }

  return days;
}

function dotColor(contact: Contact): string {
  const today = toDateStr(new Date());
  const date = contact.follow_up_date!;
  if (date < today) return 'bg-rose-400';
  if (date === today) return 'bg-cyan-400';
  return 'bg-zinc-400';
}

function nameColor(contact: Contact): string {
  const today = toDateStr(new Date());
  const date = contact.follow_up_date!;
  if (date < today) return 'text-rose-400 hover:text-rose-300';
  if (date === today) return 'text-cyan-400 hover:text-cyan-300';
  return 'text-zinc-400 hover:text-zinc-300';
}

export function CalendarView({
  contacts,
  onReschedule,
  currentMonth,
  onMonthChange,
}: CalendarViewProps) {
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const today = toDateStr(new Date());

  const days = useMemo(
    () => buildCalendarDays(currentMonth, contacts),
    [currentMonth, contacts],
  );

  function prevMonth() {
    const d = new Date(currentMonth);
    d.setMonth(d.getMonth() - 1);
    onMonthChange(d);
  }

  function nextMonth() {
    const d = new Date(currentMonth);
    d.setMonth(d.getMonth() + 1);
    onMonthChange(d);
  }

  function handleDayClick(day: CalendarDay) {
    if (day.contacts.length === 0) return;
    setExpandedDay((prev) => (prev === day.date ? null : day.date));
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
      {/* Header navigation */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <button
          type="button"
          onClick={prevMonth}
          className="rounded-lg px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
        >
          &larr; Anterior
        </button>
        <h3 className="text-sm font-semibold text-zinc-100">
          {MONTH_NAMES[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </h3>
        <button
          type="button"
          onClick={nextMonth}
          className="rounded-lg px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
        >
          Siguiente &rarr;
        </button>
      </div>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 border-b border-zinc-800">
        {DAY_HEADERS.map((d) => (
          <div
            key={d}
            className="px-1 py-2 text-center text-xs font-medium uppercase tracking-wider text-zinc-500"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const hasOverdue = day.contacts.some((c) => c.follow_up_date! < today);
          const hasContacts = day.contacts.length > 0;

          return (
            <div
              key={day.date}
              onClick={() => handleDayClick(day)}
              className={`min-h-[4.5rem] border-b border-r border-zinc-800/50 p-1.5 transition-colors sm:min-h-[5.5rem] sm:p-2 ${
                !day.isCurrentMonth ? 'bg-zinc-950/50' : ''
              } ${day.isToday ? 'border-cyan-500/30' : ''} ${
                hasOverdue && day.isCurrentMonth ? 'bg-rose-500/5' : ''
              } ${hasContacts ? 'cursor-pointer hover:bg-zinc-800/30' : ''}`}
            >
              {/* Day number */}
              <span
                className={`text-xs font-medium ${
                  !day.isCurrentMonth
                    ? 'text-zinc-700'
                    : day.isToday
                      ? 'text-cyan-400'
                      : 'text-zinc-400'
                }`}
              >
                {day.dayNumber}
              </span>

              {/* Desktop: show contact names */}
              <div className="mt-0.5 hidden space-y-0.5 sm:block">
                {day.contacts.slice(0, 2).map((c) => (
                  <button
                    key={c.jid}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onReschedule(c);
                    }}
                    className={`block w-full truncate rounded px-1 py-0.5 text-left text-[11px] font-medium transition-colors ${nameColor(c)}`}
                  >
                    {c.name || c.phone || 'Desconocido'}
                  </button>
                ))}
                {day.contacts.length > 2 && (
                  <span className="block px-1 text-[10px] text-zinc-500">
                    +{day.contacts.length - 2} mas
                  </span>
                )}
              </div>

              {/* Mobile: show colored dots */}
              {hasContacts && (
                <div className="mt-1 flex gap-0.5 sm:hidden">
                  {day.contacts.slice(0, 4).map((c) => (
                    <span
                      key={c.jid}
                      className={`inline-block h-1.5 w-1.5 rounded-full ${dotColor(c)}`}
                    />
                  ))}
                  {day.contacts.length > 4 && (
                    <span className="text-[9px] text-zinc-500">
                      +{day.contacts.length - 4}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile expanded day */}
      {expandedDay && (
        <MobileExpandedDay
          date={expandedDay}
          contacts={days.find((d) => d.date === expandedDay)?.contacts || []}
          onReschedule={onReschedule}
          onClose={() => setExpandedDay(null)}
        />
      )}
    </div>
  );
}

function MobileExpandedDay({
  date,
  contacts,
  onReschedule,
  onClose,
}: {
  date: string;
  contacts: Contact[];
  onReschedule: (contact: Contact) => void;
  onClose: () => void;
}) {
  if (contacts.length === 0) return null;

  // Format date for display
  const [, m, d] = date.split('-').map(Number);
  const monthLabel = MONTH_NAMES[m - 1];

  return (
    <div className="border-t border-zinc-800 bg-zinc-900/80 px-4 py-3 sm:hidden">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-400">
          {d} {monthLabel}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-zinc-500 hover:text-zinc-300"
        >
          Cerrar
        </button>
      </div>
      <div className="space-y-1">
        {contacts.map((c) => (
          <button
            key={c.jid}
            type="button"
            onClick={() => onReschedule(c)}
            className={`block w-full rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-zinc-800 ${nameColor(c)}`}
          >
            {c.name || c.phone || 'Desconocido'}
          </button>
        ))}
      </div>
    </div>
  );
}
