import { ContactDetailShell } from './contact-detail-shell';

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ jid: string }>;
}) {
  const { jid } = await params;
  const decodedJid = decodeURIComponent(jid);

  return <ContactDetailShell jid={decodedJid} />;
}
