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
}

export interface Message {
  id: string;
  projectId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: any;
  codeSnapshot?: string;
}

export interface GenerationResult {
  code: string;
  explanation: string;
  name: string;
}
