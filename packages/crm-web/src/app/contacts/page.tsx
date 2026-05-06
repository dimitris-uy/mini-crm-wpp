import { ContactsTable } from '@/components/contacts/contacts-table';

export default function ContactsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
          Contactos
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Administra tus contactos de WhatsApp.
        </p>
      </div>

      <ContactsTable />
    </div>
  );
}
