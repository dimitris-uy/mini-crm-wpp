import { StatCards } from '@/components/dashboard/stat-cards';
import { FollowUpList } from '@/components/dashboard/follow-up-list';
import { InactiveList } from '@/components/dashboard/inactive-list';

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Overview of your WhatsApp CRM activity.
        </p>
      </div>

      {/* Stat cards */}
      <StatCards />

      {/* Two-column list layout */}
      <div className="grid gap-8 lg:grid-cols-2">
        <FollowUpList />
        <InactiveList />
      </div>
    </div>
  );
}
