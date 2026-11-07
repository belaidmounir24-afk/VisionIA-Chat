import React, { useState } from 'react';
import {
  Sparkles,
  Bot,
  User,
  Copy,
  Check,
  AlertCircle,
  RefreshCw,
  Play,
  Layers,
  FileImage,
  Volume2,
  Square,
  Coins,
  Cpu,
  ArrowRight,
  Terminal,
} from 'lucide-react';
import { ChatMessage } from '../types';
import { formatDuration, formatFileSize } from '../utils/fileProcessor';

interface ChatFeedProps {
  messages: ChatMessage[];
  isLoading: boolean;
  loadingStage: string;
  onRetry: (messageId: string) => void;
  onOpenLightbox: (imageUrl: string, title: string, subtitle?: string) => void;
  onSelectPrompt: (text: string) => void;
  onLoadSample: () => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  currentPlayingId?: string | null;
  onToggleSpeech?: (messageId: string, text: string) => void;
}

function formatCost(costUsd: number): string {
  if (costUsd <= 0) return '< 0,00001 $';
  if (costUsd < 0.00001) {
    return '< 0,00001 $';
  }
  if (costUsd < 0.01) {
    return `~${costUsd.toFixed(5)} $`;
  }
  return `~${costUsd.toFixed(4)} $`;
}

export const ChatFeed: React.FC<ChatFeedProps> = ({
  messages,
  isLoading,
  loadingStage,
  onRetry,
  onOpenLightbox,
  onSelectPrompt,
  onLoadSample,
  messagesEndRef,
  currentPlayingId: externalPlayingId,
  onToggleSpeech: externalToggleSpeech,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [localPlayingId, setLocalPlayingId] = useState<string | null>(null);

  const activePlayingId = externalPlayingId !== undefined ? externalPlayingId : localPlayingId;

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Ignorer
    }
  };

  // Synthèse vocale Web Speech API (déléguée ou locale)
  const handleToggleSpeech = (messageId: string, text: string) => {
    if (externalToggleSpeech) {
      externalToggleSpeech(messageId, text);
      return;
    }

    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    if (localPlayingId === messageId) {
      window.speechSynthesis.cancel();
      setLocalPlayingId(null);
      return;
    }

    window.speechSynthesis.cancel();
    setLocalPlayingId(null);

    const cleanText = text
      .replace(/```[\s\S]*?```/g, ' [bloc de code] ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[*_#~>•-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'fr-FR';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const frenchVoice = voices.find((v) => v.lang.startsWith('fr') || v.lang === 'fr-FR');
    if (frenchVoice) {
      utterance.voice = frenchVoice;
    }

    utterance.onstart = () => setLocalPlayingId(messageId);
    utterance.onend = () => setLocalPlayingId(null);
    utterance.onerror = () => setLocalPlayingId(null);

    setLocalPlayingId(messageId);
    window.speechSynthesis.speak(utterance);
  };

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 max-w-2xl mx-auto text-center space-y-6 animate-in fade-in duration-300">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-xl shadow-emerald-500/20">
          <Sparkles className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            Boîte de Commande Multimodale
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            Tapez vos instructions et joignez des images (JPG, PNG, WEBP) ou vidéos (MP4, MOV, WEBM). Vos fichiers sont optimisés en direct avant transmission à l'IA.
          </p>
        </div>

        {/* Suggestion pour tester immédiatement avec l'infographie de l'utilisateur */}
        <div className="w-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl p-4 text-left shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <FileImage className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-950 dark:text-emerald-200">
                  Infographie modèle disponible
                </p>
                <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80 mt-0.5">
                  « MCP vs RAG vs AI Agents » — compare les protocoles, le contexte augmenté et les agents autonomes.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onLoadSample}
              className="h-10 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shrink-0 shadow-sm transition-colors flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <span>Tester l'exemple</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Cartes de suggestions d'instructions */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left">
          <button
            type="button"
            onClick={() =>
              onSelectPrompt(
                'Analyse cette image et résume les 3 concepts clés présentés sous forme de tableau comparatif.'
              )
            }
            className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 text-left transition-all group shadow-xs"
          >
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
              📊 Synthèse de diagramme
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
              « Analyse cette image et résume les 3 concepts clés présentés sous forme de tableau comparatif. »
            </p>
          </button>

          <button
            type="button"
            onClick={() =>
              onSelectPrompt(
                'Identifie toutes les étapes temporelles dans cette vidéo et signale les anomalies détectées.'
              )
            }
            className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 text-left transition-all group shadow-xs"
          >
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
              🎬 Chronologie vidéo
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
              « Identifie toutes les étapes temporelles dans cette vidéo et signale les anomalies détectées. »
            </p>
          </button>

          <button
            type="button"
            onClick={() => onSelectPrompt('/aide')}
            className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 text-left transition-all group shadow-xs sm:col-span-2 flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Tapez <strong className="font-mono text-emerald-600 dark:text-emerald-400">/</strong> dans le champ pour découvrir les commandes d'application
              </span>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 transition-colors" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full max-w-4xl mx-auto px-3 sm:px-4 py-4 space-y-6">
      {messages.map((message) => {
        const isUser = message.role === 'user';
        const isSystem = message.role === 'system';
        const isPlayingThis = activePlayingId === message.id;

        if (isSystem) {
          return (
            <div key={message.id} className="flex justify-center my-3">
              <div className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 text-xs px-3.5 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 max-w-md text-center">
                {message.text}
              </div>
            </div>
          );
        }

        return (
          <div
            key={message.id}
            className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-2`}
          >
            {/* Badge de l'auteur */}
            <div className="flex items-center gap-2 px-1 text-xs text-slate-500 dark:text-slate-400">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-white ${
                  isUser
                    ? 'bg-slate-800 dark:bg-slate-700'
                    : 'bg-emerald-600'
                }`}
              >
                {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
              </div>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {isUser ? 'Vous' : 'Assistant Juridique'}
              </span>
              <span className="text-[11px] opacity-70">{message.timestamp}</span>
            </div>

            {/* Bulle de message principale */}
            <div
              className={`max-w-[92%] sm:max-w-[85%] rounded-2xl p-4 shadow-sm transition-all ${
                isUser
                  ? 'bg-slate-900 text-white rounded-tr-xs dark:bg-emerald-950 dark:border dark:border-emerald-800/60'
                  : message.isError
                  ? 'bg-rose-50 text-rose-950 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-900/60 rounded-tl-xs'
                  : 'bg-white text-slate-900 border border-slate-200/80 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-800 rounded-tl-xs'
              }`}
            >
              {/* Médias joints par l'utilisateur */}
              {isUser && message.files && message.files.length > 0 && (
                <div className="mb-3 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs text-slate-300 dark:text-emerald-300 pb-1 border-b border-slate-800 dark:border-emerald-800/40">
                    <FileImage className="w-3.5 h-3.5" />
                    <span>
                      {message.files.length} fichier{message.files.length > 1 ? 's' : ''} analysé{message.files.length > 1 ? 's' : ''} :
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {message.files.map((file, fIdx) => (
                      <div
                        key={fIdx}
                        className="group relative rounded-xl overflow-hidden border border-slate-800/80 dark:border-emerald-800/50 bg-black/40 flex flex-col cursor-pointer"
                        onClick={() =>
                          onOpenLightbox(
                            file.previewUrl,
                            file.name,
                            file.type === 'video'
                              ? `Vidéo (durée: ${formatDuration(file.duration || 0)}, ${file.frames?.length || 0} images extraites)`
                              : `Image (${formatFileSize(file.size)})`
                          )
                        }
                      >
                        <div className="relative aspect-video w-full bg-slate-950 overflow-hidden">
                          <img
                            src={file.previewUrl}
                            alt={file.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />

                          {file.type === 'video' && (
                            <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/80 text-white text-[10px] font-mono flex items-center gap-1 backdrop-blur-xs">
                              <Play className="w-2.5 h-2.5 fill-white" />
                              {formatDuration(file.duration || 0)}
                            </span>
                          )}

                          {file.frames && file.frames.length > 0 && (
                            <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-emerald-600/90 text-white text-[10px] font-mono flex items-center gap-0.5 shadow-xs">
                              <Layers className="w-2.5 h-2.5" />
                              {file.frames.length} trames
                            </span>
                          )}
                        </div>

                        <div className="p-1.5 bg-slate-900/90 dark:bg-emerald-950/90 text-[11px] truncate">
                          <p className="truncate font-medium text-slate-200 dark:text-emerald-100">
                            {file.name}
                          </p>
                          <p className="text-[10px] text-slate-400 dark:text-emerald-400">
                            {file.type === 'video' ? 'Vidéo 2s/trame' : formatFileSize(file.size)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Texte du message */}
              <div className="text-sm leading-relaxed whitespace-pre-wrap font-sans">
                {message.text}
              </div>



              {/* Message d'erreur avec bouton réessayer */}
              {message.isError && (
                <div className="mt-3 pt-3 border-t border-rose-200 dark:border-rose-900/60 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>L'envoi n'a pas pu aboutir.</span>
                  </div>
                  {message.canRetry && (
                    <button
                      type="button"
                      onClick={() => onRetry(message.id)}
                      className="h-11 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Réessayer</span>
                    </button>
                  )}
                </div>
              )}

              {/* Pied de message du modèle avec Indicateur de tokens, Coût estimé, Synthèse Vocale et Copie */}
              {!isUser && !message.isError && (() => {
                const tokenDetails = message.usage || {
                  totalTokens: Math.max(1, Math.round(message.text.length / 4)),
                  promptTokens: Math.max(1, Math.round(message.text.length / 8)),
                  candidatesTokens: Math.max(1, Math.round(message.text.length / 4)),
                  estimatedCostUsd: Number(((Math.max(1, Math.round(message.text.length / 4)) * 0.3) / 1000000).toFixed(6)),
                  modelName: 'gemini-3.1-flash-lite',
                };

                return (
                  <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2">
                    {/* Indicateur de tokens et coût estimé */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 px-2.5 py-1.5 rounded-xl border border-slate-200/70 dark:border-slate-700/60">
                      <div
                        className="flex items-center gap-1.5 min-w-0"
                        title={`Détail : ${tokenDetails.promptTokens} tokens en entrée (prompt) • ${tokenDetails.candidatesTokens} tokens en sortie (réponse)`}
                      >
                        <Cpu className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span className="truncate">
                          Tokens : <strong className="font-semibold text-slate-800 dark:text-slate-200">~{tokenDetails.totalTokens.toLocaleString('fr-FR')}</strong>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-1.5 hidden sm:inline">
                            ({tokenDetails.promptTokens} in / {tokenDetails.candidatesTokens} out)
                          </span>
                        </span>
                      </div>

                      <div
                        className="flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-950/70 px-2 py-0.5 rounded-lg border border-emerald-200/60 dark:border-emerald-800/50 shrink-0"
                        title="Coût approximatif calculé sur la base de la tarification officielle de l'API Gemini"
                      >
                        <Coins className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>Coût : {formatCost(tokenDetails.estimatedCostUsd)}</span>
                      </div>
                    </div>

                    {/* Actions : analyse certifiée, lecture vocale et copie */}
                    <div className="flex items-center justify-between text-xs text-slate-400 pt-0.5">
                      <span className="text-[11px] flex items-center gap-1 text-slate-400 dark:text-slate-500">
                        <Sparkles className="w-3 h-3 text-emerald-500" />
                        Réponse IA validée
                      </span>

                      <div className="flex items-center gap-1">
                        {/* Bouton de lecture / arrêt vocal (Web Speech API) */}
                        <button
                          type="button"
                          onClick={() => handleToggleSpeech(message.id, message.text)}
                          className={`h-11 px-3 -my-2 rounded-xl flex items-center gap-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                            isPlayingThis
                              ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 ring-1 ring-rose-500/40 hover:bg-rose-100 dark:hover:bg-rose-900/60'
                              : 'text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                          title={isPlayingThis ? 'Arrêter la lecture' : 'Lire la réponse à voix haute'}
                          aria-label={isPlayingThis ? 'Arrêter la lecture vocale' : 'Écouter la réponse'}
                        >
                          {isPlayingThis ? (
                            <>
                              <Square className="w-3.5 h-3.5 fill-current text-rose-600 dark:text-rose-400 shrink-0" />
                              <span className="text-xs font-semibold flex items-center gap-1.5 text-rose-700 dark:text-rose-300">
                                <span className="flex items-end gap-0.5 h-3">
                                  <span className="w-1 h-2 bg-rose-600 dark:bg-rose-400 rounded-full animate-bounce"></span>
                                  <span className="w-1 h-3.5 bg-rose-600 dark:bg-rose-400 rounded-full animate-bounce delay-100"></span>
                                  <span className="w-1 h-2 bg-rose-600 dark:bg-rose-400 rounded-full animate-bounce delay-200"></span>
                                </span>
                                Arrêter
                              </span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                              <span className="text-xs font-medium">Écouter</span>
                            </>
                          )}
                        </button>

                        {/* Bouton copier */}
                        <button
                          type="button"
                          onClick={() => handleCopy(message.text, message.id)}
                          className="w-11 h-11 -my-2 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                          title="Copier la réponse"
                          aria-label="Copier la réponse dans le presse-papiers"
                        >
                          {copiedId === message.id ? (
                            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        );
      })}

      {/* Indicateur de traitement et de réponse en direct */}
      {isLoading && (
        <div className="flex flex-col items-start space-y-2 animate-in fade-in duration-200">
          <div className="flex items-center gap-2 px-1 text-xs text-slate-500">
            <div className="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center text-white">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Assistant Multimodal
            </span>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl rounded-tl-xs p-4 shadow-sm flex items-center gap-3">
            <div className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-600"></span>
            </div>
            <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">
              {loadingStage || "L'IA analyse les médias et prépare sa réponse..."}
            </span>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
};
