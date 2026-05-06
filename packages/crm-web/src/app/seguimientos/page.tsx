import { SeguimientosShell } from '@/components/seguimientos/seguimientos-shell';

export default function SeguimientosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
          Seguimientos
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Gestiona tus seguimientos programados.
        </p>
      </div>

      <SeguimientosShell />
    </div>
  );
}
