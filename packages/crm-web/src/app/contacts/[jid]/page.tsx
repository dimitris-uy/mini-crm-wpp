export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ jid: string }>;
}) {
  const { jid } = await params;

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
        Contact Detail
      </h1>
      <p className="mt-2 text-sm text-zinc-400">
        Viewing contact: <code className="text-cyan-400">{jid}</code>
      </p>
    </div>
  );
}
