import { ConnectionStatus } from '@/components/settings/connection-status';
import { QrDisplay } from '@/components/settings/qr-display';
import { HistorySyncStatus } from '@/components/settings/history-sync-status';

export default function SettingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
        Ajustes
      </h1>
      <p className="mt-2 text-sm text-zinc-400">
        Administra tu conexion de WhatsApp y preferencias del CRM.
      </p>

      {/* WhatsApp Connection card */}
      <div className="mt-8">
        <h2 className="text-lg font-medium text-zinc-200">
          Conexion WhatsApp
        </h2>
        <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 sm:p-6 transition-colors hover:border-zinc-700">
          {/* Connection status bar */}
          <ConnectionStatus />

          {/* Divider */}
          <div className="my-6 border-t border-zinc-800" />

          {/* QR code / success state */}
          <QrDisplay />

          {/* History sync progress (only visible during sync) */}
          <HistorySyncStatus />
        </div>
      </div>
    </div>
  );
}
