export interface Contact {
  jid: string;
  name: string | null;
  phone: string | null;
  status: 'prospect' | 'client';
  last_message_at: number | null;
  last_reply_at: number | null;
  follow_up_date: string | null;
  notes: string;
  created_at: number;
  updated_at: number;
}

export interface Message {
  id: string;
  contact_jid: string;
  sender: string;
  content: string;
  type: 'text' | 'image' | 'audio' | 'video' | 'document';
  timestamp: number;
}

export interface DashboardStats {
  total: number;
  prospects: number;
  clients: number;
  pendingFollowUps: number;
  inactive: number;
}
