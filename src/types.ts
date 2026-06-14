export interface Project {
  id: string;
  userId: string;
  name: string;
  description: string;
  language: string;
  languageCode: string;
  code: string;
  createdAt: any;
  updatedAt: any;
  status?: 'live' | 'building' | 'draft';
  shareStatus?: 'pending' | 'approved' | 'rejected';
  featured?: boolean;
  sharedAt?: any;
}

export interface Message {
  id: string;
  projectId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: any;
  codeSnapshot?: string;
}

export interface ChatThread {
  id: string;
  userId: string;
  title: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  createdAt: any;
  updatedAt: any;
}

export interface GenerationResult {
  code: string;
  explanation: string;
  name: string;
}
