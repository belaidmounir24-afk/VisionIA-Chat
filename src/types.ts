export type FileCategory = 'image' | 'video';

export interface VideoFrame {
  timestamp: number;
  dataUrl: string;
  mimeType: string;
}

export interface AttachedFile {
  id: string;
  file: File;
  name: string;
  size: number;
  type: FileCategory;
  mimeType: string;
  previewUrl: string; // URL blob ou dataUrl pour la miniature
  dataUrl?: string; // base64 de l'image réduite à 1600px max
  duration?: number; // durée totale en secondes pour une vidéo
  frames?: VideoFrame[]; // images extraites toutes les 2s (max 12)
  isProcessing?: boolean;
  processProgress?: number;
  error?: string;
}

export interface AttachedFileSummary {
  type: FileCategory;
  name: string;
  size: number;
  mimeType: string;
  previewUrl: string;
  dataUrl?: string;
  duration?: number;
  frames?: VideoFrame[];
}

export interface TokenUsage {
  promptTokens: number;
  candidatesTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  modelName: string;
}

export type AiMode = 'RAG' | 'CAG';

export interface Citation {
  id: string;
  documentTitle: string;
  sourceFile: string;
  pageOrSection?: string;
  chunkSnippet: string;
  similarityScore: number;
}

export interface RagQueryPayload {
  query: string;
  topK?: number;
  minSimilarity?: number;
  filterDocumentId?: string;
}

export interface RagQueryResponse {
  success: boolean;
  mode: 'RAG';
  answer: string;
  citations: Citation[];
  metrics: {
    retrievalLatencyMs: number;
    generationLatencyMs: number;
    totalLatencyMs: number;
    tokensUsed: {
      prompt: number;
      completion: number;
      total: number;
    };
  };
}

export interface CagQueryPayload {
  query: string;
  contextKey: string;
  overrideTemperature?: number;
}

export interface CagQueryResponse {
  success: boolean;
  mode: 'CAG';
  answer: string;
  contextKey: string;
  cacheHit: boolean;
  metrics: {
    contextSizeTokens: number;
    generationLatencyMs: number;
    totalLatencyMs: number;
    tokensUsed: {
      prompt: number;
      completion: number;
      total: number;
    };
  };
}

export interface CagContextInfo {
  key: string;
  title: string;
  reference: string;
  tokenCount: number;
  description: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model' | 'system';
  text: string;
  files?: AttachedFileSummary[];
  timestamp: string;
  isError?: boolean;
  canRetry?: boolean;
  rawError?: string;
  usage?: TokenUsage;
  aiMode?: AiMode;
  citations?: Citation[];
  ragMetrics?: RagQueryResponse['metrics'];
  cagMetrics?: CagQueryResponse['metrics'];
  contextKey?: string;
  cacheHit?: boolean;
}

export interface SlashCommand {
  name: string;
  aliases?: string[];
  description: string;
  usage: string;
  category: 'action' | 'navigation' | 'aide';
}

export interface ProcessingProgress {
  stage: string;
  percent: number;
}

