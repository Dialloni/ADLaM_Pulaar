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
  published?: boolean;   // publicly served at /p/<slug || id>
  publishedAt?: any;
  slug?: string;         // custom public URL name (doc id in /slugs)
}

export interface Message {
  id: string;
  projectId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: any;
  codeSnapshot?: string;
  images?: string[]; // data URLs of images the user attached (for display in the bubble)
}

export interface ChatThread {
  id: string;
  userId: string;
  title: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  createdAt: any;
  updatedAt: any;
}

export interface Submission {
  id: string;
  fields: Record<string, string>;
  createdAt: any;
  ua?: string;
}

export interface GenerationResult {
  code: string;
  explanation: string;
  name: string;
}
