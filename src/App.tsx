import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { ChatFeed } from './components/ChatFeed';
import { CommandBox } from './components/CommandBox';
import { MediaLightbox } from './components/MediaLightbox';
import { CommandHelpModal } from './components/CommandHelpModal';
import { SettingsModal } from './components/SettingsModal';
import {
  AttachedFile,
  AttachedFileSummary,
  ChatMessage,
  ProcessingProgress,
} from './types';
import {
  processAttachedFiles,
  validateIncomingFiles,
} from './utils/fileProcessor';
import { parseCommand } from './utils/commands';
import {
  SpeechSettings,
  loadSpeechSettings,
  saveSpeechSettings,
  cleanTextForSpeech,
  isSpeechSynthesisSupported,
  getAvailableVoices,
} from './utils/speechManager';

const STORAGE_KEY_MESSAGES = 'marchedz_command_messages_v1';
const STORAGE_KEY_THEME = 'marchedz_command_theme';
const STORAGE_KEY_MOTION = 'marchedz_command_motion';
const SAMPLE_IMAGE_PATH = '/assets/aistudio/Screenshot_20261029_194653_1cf8afe2.jpg';

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_MESSAGES);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // Ignorer
    }
    return [];
  });

  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState<ProcessingProgress>({
    stage: '',
    percent: 0,
  });
  const [lastInstruction, setLastInstruction] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Thème et accessibilité
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_THEME);
    if (saved !== null) return saved === 'dark';
    return (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    );
  });

  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_MOTION);
    if (saved !== null) return saved === 'true';
    return (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  });

  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [answerMode, setAnswerMode] = useState<'detaille' | 'concis'>('detaille');

  // Synthèse vocale Web Speech API
  const [speechSettings, setSpeechSettings] = useState<SpeechSettings>(() => loadSpeechSettings());
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);

  const [lightbox, setLightbox] = useState<{
    isOpen: boolean;
    url: string;
    title: string;
    subtitle?: string;
  }>({
    isOpen: false,
    url: '',
    title: '',
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Stopper la synthèse vocale
  const stopSpeech = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setSpeakingMessageId(null);
  };

  // Lire un texte à haute voix via la Web Speech API
  const speakText = (text: string, messageId?: string) => {
    if (!isSpeechSynthesisSupported()) return;

    // Arrêter toute lecture en cours
    stopSpeech();

    const cleaned = cleanTextForSpeech(text);
    if (!cleaned) return;

    const utterance = new SpeechSynthesisUtterance(cleaned);
    utterance.rate = speechSettings.rate;
    utterance.pitch = speechSettings.pitch;
    utterance.volume = speechSettings.volume;

    const voices = getAvailableVoices();
    if (speechSettings.voiceUri) {
      const found = voices.find((v) => v.voiceURI === speechSettings.voiceUri);
      if (found) {
        utterance.voice = found;
      }
    } else {
      const frVoice = voices.find((v) => v.lang.toLowerCase().startsWith('fr'));
      if (frVoice) {
        utterance.voice = frVoice;
      }
    }

    utterance.onstart = () => {
      setIsSpeaking(true);
      if (messageId) setSpeakingMessageId(messageId);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setSpeakingMessageId(null);
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      setSpeakingMessageId(null);
    };

    setIsSpeaking(true);
    if (messageId) setSpeakingMessageId(messageId);
    window.speechSynthesis.speak(utterance);
  };

  // Bascule rapide de la synthèse vocale (activation/désactivation)
  const handleToggleSpeechGlobal = () => {
    const nextVal = !speechSettings.autoRead;
    const updated: SpeechSettings = { ...speechSettings, autoRead: nextVal };
    setSpeechSettings(updated);
    saveSpeechSettings(updated);
    if (!nextVal && isSpeaking) {
      stopSpeech();
    }
  };

  // Bascule de lecture pour un message précis
  const handleToggleMessageSpeech = (messageId: string, text: string) => {
    if (isSpeaking && speakingMessageId === messageId) {
      stopSpeech();
    } else {
      speakText(text, messageId);
    }
  };

  // Mise à jour et sauvegarde des réglages
  const handleUpdateSpeechSettings = (newSettings: SpeechSettings) => {
    setSpeechSettings(newSettings);
    saveSpeechSettings(newSettings);
  };

  // Arrêter la lecture lors du démontage
  useEffect(() => {
    return () => {
      stopSpeech();
    };
  }, []);

  // Synchronisation du thème dans le DOM
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem(STORAGE_KEY_THEME, 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem(STORAGE_KEY_THEME, 'light');
    }
  }, [isDark]);

  // Synchronisation des animations réduites
  useEffect(() => {
    const root = document.documentElement;
    if (reducedMotion) {
      root.classList.add('reduced-motion');
      localStorage.setItem(STORAGE_KEY_MOTION, 'true');
    } else {
      root.classList.remove('reduced-motion');
      localStorage.setItem(STORAGE_KEY_MOTION, 'false');
    }
  }, [reducedMotion]);

  // Sauvegarde des messages dans le stockage local
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(messages));
    } catch {
      // Dépassement possible du quota localStorage si beaucoup de données
    }
  }, [messages]);

  // Défilement automatique vers le dernier message
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSending]);

  // Ajout et traitement des fichiers reçus (galerie, caméra, glisser-déposer ou collage)
  const handleAddFiles = async (newRawFiles: File[]) => {
    setErrorMessage(null);

    const { validFiles, errors } = validateIncomingFiles(
      newRawFiles,
      attachedFiles.length
    );

    if (errors.length > 0) {
      setErrorMessage(errors[0]);
    }

    if (validFiles.length === 0) return;

    try {
      setIsSending(true);
      setSendProgress({
        stage: 'Optimisation des fichiers (images à 1600px, découpe vidéo 2s)...',
        percent: 20,
      });

      const processed = await processAttachedFiles(
        validFiles,
        (current, total, fileName) => {
          setSendProgress({
            stage: `Traitement de ${fileName} (${current}/${total})...`,
            percent: Math.round((current / total) * 70),
          });
        }
      );

      setAttachedFiles((prev) => [...prev, ...processed]);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Une erreur est survenue lors du traitement des fichiers.'
      );
    } finally {
      setIsSending(false);
      setSendProgress({ stage: '', percent: 0 });
    }
  };

  const handleRemoveFile = (id: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  // Envoi d'un message standard avec fichiers
  const handleSendMessage = async (text: string, files: AttachedFile[]) => {
    const userMessageId = `msg_${Date.now()}`;
    const timestampStr = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    if (text.trim()) {
      setLastInstruction(text.trim());
    }

    // Convertir les fichiers attachés en résumé pour l'historique
    const filesSummary: AttachedFileSummary[] = files.map((f) => ({
      type: f.type,
      name: f.name,
      size: f.size,
      mimeType: f.mimeType,
      previewUrl: f.previewUrl,
      dataUrl: f.dataUrl,
      duration: f.duration,
      frames: f.frames,
    }));

    const newUserMessage: ChatMessage = {
      id: userMessageId,
      role: 'user',
      text: text.trim(),
      files: filesSummary,
      timestamp: timestampStr,
    };

    setMessages((prev) => [...prev, newUserMessage]);
    setAttachedFiles([]);
    setIsSending(true);

    try {
      setSendProgress({
        stage: 'Préparation du message pour le modèle...',
        percent: 25,
      });

      const conversationHistory = messages.slice(-8).map((m) => ({
        role: m.role,
        text: m.text,
        files: m.files?.map((f) => ({
          type: f.type,
          name: f.name,
          dataUrl: f.previewUrl || f.dataUrl,
          duration: f.duration,
          frames: f.frames && f.frames.length > 0 ? [f.frames[0]] : undefined,
        })),
      }));

      setSendProgress({
        stage: "Transmission sécurisée à l'IA multimodale...",
        percent: 50,
      });

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            role: 'user',
            text:
              answerMode === 'concis'
                ? `${text.trim()} (Consigne supplémentaire : sois très concis et synthétique)`.trim()
                : text.trim(),
            files: filesSummary.map((f) => ({
              type: f.type,
              name: f.name,
              mimeType: f.mimeType,
              dataUrl: f.dataUrl || f.previewUrl,
              duration: f.duration,
              frames: f.frames,
            })),
          },
          history: conversationHistory,
        }),
      });

      setSendProgress({
        stage: 'Réception et décodage de la réponse...',
        percent: 85,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Impossible d'obtenir une réponse de l'IA.");
      }

      setSendProgress({ stage: 'Terminé', percent: 100 });

      const assistantMessage: ChatMessage = {
        id: `ai_${Date.now()}`,
        role: 'model',
        text: data.reply,
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
        usage: data.usage,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (speechSettings.autoRead) {
        speakText(assistantMessage.text, assistantMessage.id);
      }
    } catch (err: unknown) {
      console.error('Erreur chat:', err);
      const isNetworkError =
        err instanceof TypeError && err.message.toLowerCase().includes('fetch');

      const errorText = isNetworkError
        ? 'Le réseau semble coupé ou le serveur est inaccessible. Veuillez vérifier votre connexion Internet.'
        : err instanceof Error
        ? err.message
        : "Une erreur inconnue est survenue lors de l'appel au modèle.";

      const errorMessageObj: ChatMessage = {
        id: `err_${Date.now()}`,
        role: 'model',
        text: errorText,
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
        isError: true,
        canRetry: true,
        rawError: err instanceof Error ? err.message : String(err),
      };

      setMessages((prev) => [...prev, errorMessageObj]);
    } finally {
      setIsSending(false);
      setSendProgress({ stage: '', percent: 0 });
    }
  };

  // Réessayer après une erreur
  const handleRetry = (errorId: string) => {
    const errorIndex = messages.findIndex((m) => m.id === errorId);
    if (errorIndex > 0) {
      const prevUserMessage = messages[errorIndex - 1];
      if (prevUserMessage && prevUserMessage.role === 'user') {
        // Supprimer le message d'erreur
        setMessages((prev) => prev.filter((m) => m.id !== errorId));
        // Relancer l'appel
        const filesToResend: AttachedFile[] = (prevUserMessage.files || []).map(
          (f, idx) => ({
            id: `retry_${idx}`,
            file: new File([], f.name),
            name: f.name,
            size: f.size,
            type: f.type,
            mimeType: f.mimeType,
            previewUrl: f.previewUrl,
            dataUrl: f.dataUrl,
            duration: f.duration,
            frames: f.frames,
          })
        );
        handleSendMessage(prevUserMessage.text, filesToResend);
      }
    }
  };

  // Traitement des commandes commençant par « / »
  const handleExecuteCommand = async (commandStr: string) => {
    const { commandName, args } = parseCommand(commandStr);

    switch (commandName) {
      case '/aide':
      case '/help':
      case '/?':
        setIsHelpOpen(true);
        break;

      case '/effacer':
      case '/clear':
      case '/reset':
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel();
        }
        setMessages([]);
        setAttachedFiles([]);
        setErrorMessage(null);
        localStorage.removeItem(STORAGE_KEY_MESSAGES);
        setMessages([
          {
            id: `sys_${Date.now()}`,
            role: 'system',
            text: 'Historique de la conversation effacé avec succès.',
            timestamp: new Date().toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            }),
          },
        ]);
        break;

      case '/exporter':
      case '/export':
      case '/sauvegarder': {
        if (messages.length === 0) {
          setErrorMessage('Aucun message à exporter pour le moment.');
          return;
        }

        const transcript = messages
          .map((m) => {
            const author = m.role === 'user' ? '👤 Utilisateur' : '🤖 Assistant Multimodal';
            const filesInfo =
              m.files && m.files.length > 0
                ? `\n[Fichiers joints : ${m.files.map((f) => f.name).join(', ')}]`
                : '';
            return `### ${author} (${m.timestamp})${filesInfo}\n\n${m.text}\n`;
          })
          .join('\n---\n\n');

        const blob = new Blob([transcript], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `discussion-ia-${new Date().toISOString().slice(0, 10)}.md`;
        a.click();
        URL.revokeObjectURL(url);

        setMessages((prev) => [
          ...prev,
          {
            id: `sys_${Date.now()}`,
            role: 'system',
            text: 'Discussion exportée au format Markdown.',
            timestamp: new Date().toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            }),
          },
        ]);
        break;
      }

      case '/exemple':
      case '/demo':
      case '/sample':
        await handleLoadSampleImage();
        break;

      case '/mode': {
        const target = args[0]?.toLowerCase();
        if (target === 'concis') {
          setAnswerMode('concis');
          setMessages((prev) => [
            ...prev,
            {
              id: `sys_${Date.now()}`,
              role: 'system',
              text: 'Mode de réponse configuré sur : Synthétique / Concis.',
              timestamp: new Date().toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              }),
            },
          ]);
        } else if (target === 'detaille') {
          setAnswerMode('detaille');
          setMessages((prev) => [
            ...prev,
            {
              id: `sys_${Date.now()}`,
              role: 'system',
              text: 'Mode de réponse configuré sur : Détaillé et complet.',
              timestamp: new Date().toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              }),
            },
          ]);
        } else {
          const nextMode = answerMode === 'detaille' ? 'concis' : 'detaille';
          setAnswerMode(nextMode);
          setMessages((prev) => [
            ...prev,
            {
              id: `sys_${Date.now()}`,
              role: 'system',
              text: `Mode de réponse basculé vers : ${
                nextMode === 'concis' ? 'Synthétique' : 'Détaillé'
              }.`,
              timestamp: new Date().toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              }),
            },
          ]);
        }
        break;
      }

      case '/statut': {
        try {
          const res = await fetch('/api/health');
          const data = await res.json();
          setMessages((prev) => [
            ...prev,
            {
              id: `sys_${Date.now()}`,
              role: 'system',
              text: `Statut serveur : Opérationnel (${res.status}). Clé Gemini API : ${
                data.hasApiKey ? 'Configurée' : 'Non détectée'
              }. Modèle multimodal haute vélocité actif.`,
              timestamp: new Date().toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              }),
            },
          ]);
        } catch {
          setErrorMessage('Impossible de joindre le serveur backend.');
        }
        break;
      }

      case '/reglages':
      case '/settings':
      case '/voix':
      case '/audio':
        setIsSettingsOpen(true);
        break;

      default:
        setErrorMessage(
          `Commande inconnue « ${commandName} ». Tapez /aide pour afficher la liste des commandes.`
        );
        break;
    }
  };

  // Chargement de l'infographie exemple (« MCP vs RAG vs AI Agents »)
  const handleLoadSampleImage = async () => {
    try {
      setIsSending(true);
      setSendProgress({
        stage: "Chargement de l'infographie modèle (MCP vs RAG vs AI Agents)...",
        percent: 40,
      });

      const response = await fetch(SAMPLE_IMAGE_PATH);
      if (!response.ok) {
        throw new Error("Impossible de charger l'image exemple.");
      }

      const blob = await response.blob();
      const sampleFile = new File([blob], 'mcp_vs_rag_vs_agents.jpg', {
        type: 'image/jpeg',
      });

      await handleAddFiles([sampleFile]);
      setLastInstruction(
        'Analyse cette infographie en comparant MCP, RAG et Agents IA : explique le rôle de chaque bloc technique.'
      );
    } catch {
      setErrorMessage("Impossible de charger l'infographie modèle.");
    } finally {
      setIsSending(false);
      setSendProgress({ stage: '', percent: 0 });
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors selection:bg-emerald-500 selection:text-white">
      {/* Barre de navigation / En-tête */}
      <Header
        isDark={isDark}
        onToggleTheme={() => setIsDark((prev) => !prev)}
        reducedMotion={reducedMotion}
        onToggleReducedMotion={() => setReducedMotion((prev) => !prev)}
        onClearHistory={() => handleExecuteCommand('/effacer')}
        onOpenHelp={() => setIsHelpOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isSpeechEnabled={speechSettings.autoRead}
        onToggleSpeech={handleToggleSpeechGlobal}
        isSpeaking={isSpeaking}
        onStopSpeech={stopSpeech}
        messageCount={messages.length}
      />



      {/* Fil de discussion principal */}
      <main className="flex-1 flex flex-col w-full pb-36 pt-2 overflow-y-auto">
        <ChatFeed
          messages={messages}
          isLoading={isSending}
          loadingStage={sendProgress.stage}
          onRetry={handleRetry}
          onOpenLightbox={(url, title, subtitle) =>
            setLightbox({ isOpen: true, url, title, subtitle })
          }
          onSelectPrompt={(text) => {
            if (text.startsWith('/')) {
              handleExecuteCommand(text);
            } else {
              setLastInstruction(text);
              handleSendMessage(text, attachedFiles);
            }
          }}
          onLoadSample={handleLoadSampleImage}
          messagesEndRef={messagesEndRef}
          currentPlayingId={speakingMessageId}
          onToggleSpeech={handleToggleMessageSpeech}
        />
      </main>

      {/* Boîte de commande fixée en bas pour mobile & desktop */}
      <CommandBox
        onSendMessage={handleSendMessage}
        onExecuteCommand={handleExecuteCommand}
        attachedFiles={attachedFiles}
        onAddFiles={handleAddFiles}
        onRemoveFile={handleRemoveFile}
        isSending={isSending}
        sendProgress={sendProgress}
        lastInstruction={lastInstruction}
        errorMessage={errorMessage}
        onClearError={() => setErrorMessage(null)}
      />

      {/* Modale d'aide et liste de commandes */}
      <CommandHelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        onSelectCommand={(cmd) => handleExecuteCommand(cmd)}
      />

      {/* Modale de réglages (Synthèse Vocale Web Speech API & Format) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={speechSettings}
        onUpdateSettings={handleUpdateSpeechSettings}
        answerMode={answerMode}
        onUpdateAnswerMode={setAnswerMode}
      />

      {/* Visionneuse haute résolution d'images et trames vidéo */}
      <MediaLightbox
        isOpen={lightbox.isOpen}
        onClose={() => setLightbox((prev) => ({ ...prev, isOpen: false }))}
        imageUrl={lightbox.url}
        title={lightbox.title}
        subtitle={lightbox.subtitle}
      />
    </div>
  );
}
