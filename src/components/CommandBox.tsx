import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  ChangeEvent,
  KeyboardEvent,
  ClipboardEvent,
  DragEvent,
} from 'react';
import {
  Send,
  Paperclip,
  X,
  Play,
  Layers,
  ArrowUp,
  Camera,
  Image as ImageIcon,
  Sparkles,
  Command,
  Loader2,
} from 'lucide-react';
import { AttachedFile } from '../types';
import {
  formatDuration,
  formatFileSize,
  MAX_FILES_PER_MESSAGE,
} from '../utils/fileProcessor';
import { getCommandSuggestions, SLASH_COMMANDS } from '../utils/commands';

interface CommandBoxProps {
  onSendMessage: (text: string, files: AttachedFile[]) => void;
  onExecuteCommand: (commandStr: string) => void;
  attachedFiles: AttachedFile[];
  onAddFiles: (files: File[]) => void;
  onRemoveFile: (fileId: string) => void;
  isSending: boolean;
  sendProgress: { stage: string; percent: number };
  lastInstruction: string;
  errorMessage?: string | null;
  onClearError?: () => void;
}

export const CommandBox: React.FC<CommandBoxProps> = ({
  onSendMessage,
  onExecuteCommand,
  attachedFiles,
  onAddFiles,
  onRemoveFile,
  isSending,
  sendProgress,
  lastInstruction,
  errorMessage,
  onClearError,
}) => {
  const [text, setText] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);

  // Suggestions de commandes slash
  const suggestions = text.startsWith('/') ? getCommandSuggestions(text) : [];

  // Ajustement automatique de la hauteur du textarea
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const newHeight = Math.min(Math.max(textarea.scrollHeight, 44), 140);
    textarea.style.height = `${newHeight}px`;
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [text, adjustTextareaHeight]);

  // Fermer le menu joindre au clic extérieur
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        attachMenuRef.current &&
        !attachMenuRef.current.contains(e.target as Node)
      ) {
        setShowAttachMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Gestion de la soumission
  const handleSubmit = () => {
    if (isSending) return;

    const trimmed = text.trim();

    // Cas 1 : C'est une commande d'application (/...)
    if (trimmed.startsWith('/')) {
      onExecuteCommand(trimmed);
      setText('');
      if (textareaRef.current) {
        textareaRef.current.style.height = '44px';
      }
      return;
    }

    // Cas 2 : Message standard (texte ou fichiers)
    if (!trimmed && attachedFiles.length === 0) return;

    onSendMessage(trimmed, attachedFiles);
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = '44px';
    }
  };

  // Gestion des touches du clavier (Entrée pour envoyer, Maj+Entrée saut de ligne, Flèche haut rappel)
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Si la liste des suggestions de commandes est affichée
    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSuggestionIndex((prev) => (prev + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSuggestionIndex((prev) =>
          prev === 0 ? suggestions.length - 1 : prev - 1
        );
        return;
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
        e.preventDefault();
        const chosen = suggestions[selectedSuggestionIndex] || suggestions[0];
        if (chosen) {
          setText(chosen.name + ' ');
        }
        return;
      }
      if (e.key === 'Escape') {
        // Annuler les suggestions en supprimant le slash ou masquant
        return;
      }
    }

    // Flèche haut dans le champ vide pour rappeler la dernière instruction
    if (e.key === 'ArrowUp' && text === '' && lastInstruction) {
      e.preventDefault();
      setText(lastInstruction);
      return;
    }

    // Envoi avec Entrée (sans Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Collage d'images depuis le presse-papiers avec Ctrl+V / Cmd+V
  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const clipboardData = e.clipboardData;
    if (!clipboardData || !clipboardData.items) return;

    const filesToUpload: File[] = [];
    for (let i = 0; i < clipboardData.items.length; i++) {
      const item = clipboardData.items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          filesToUpload.push(file);
        }
      }
    }

    if (filesToUpload.length > 0) {
      onAddFiles(filesToUpload);
    }
  };

  // Glisser-déposer sur ordinateur
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      onAddFiles(droppedFiles);
    }
  };

  // Sélection de fichiers via l'explorateur ou l'appareil photo
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = Array.from(e.target.files);
      onAddFiles(selected);
      // Réinitialiser la valeur pour permettre de ré-uploader le même fichier
      e.target.value = '';
    }
    setShowAttachMenu(false);
  };

  const canSend = (text.trim().length > 0 || attachedFiles.length > 0) && !isSending;

  return (
    <div
      className={`fixed bottom-0 left-0 w-full z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 transition-colors ${
        isDragOver ? 'ring-4 ring-emerald-500/50 bg-emerald-50/70 dark:bg-emerald-950/40' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="max-w-4xl mx-auto px-3 sm:px-4 pt-2.5 pb-safe pb-3">
        {/* Barre de progression pendant l'envoi ou l'extraction vidéo */}
        {isSending && (
          <div className="mb-2.5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between text-xs font-medium text-emerald-800 dark:text-emerald-300 mb-1 px-1">
              <span className="flex items-center gap-1.5 truncate">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="truncate">
                  {sendProgress.stage || 'Traitement multimodal en cours...'}
                </span>
              </span>
              <span className="font-mono font-bold shrink-0">{sendProgress.percent}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-300 ease-out rounded-full"
                style={{ width: `${Math.max(5, sendProgress.percent)}%` }}
              />
            </div>
          </div>
        )}

        {/* Message d'erreur contextuel (format refusé, fichier trop lourd, etc.) */}
        {errorMessage && (
          <div className="mb-2 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center justify-between gap-2 shadow-xs">
            <span className="leading-snug">{errorMessage}</span>
            {onClearError && (
              <button
                type="button"
                onClick={onClearError}
                className="w-11 h-11 -my-2 -mr-1 rounded-lg flex items-center justify-center text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                aria-label="Fermer le message d'erreur"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Menu flottant des suggestions de commandes Slash */}
        {suggestions.length > 0 && (
          <div className="mb-2 p-1.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden max-h-56 overflow-y-auto animate-in slide-in-from-bottom-2 duration-150">
            <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800">
              <Command className="w-3.5 h-3.5 text-emerald-600" />
              <span>Commandes de l'application (Touche Tab ou Entrée)</span>
            </div>
            {suggestions.map((cmd, idx) => (
              <button
                key={cmd.name}
                type="button"
                onClick={() => {
                  setText(cmd.name + ' ');
                  textareaRef.current?.focus();
                }}
                className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between gap-3 text-xs transition-colors ${
                  idx === selectedSuggestionIndex
                    ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-950 dark:text-emerald-100'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {cmd.name}
                  </span>
                  <span className="truncate opacity-80">{cmd.description}</span>
                </div>
                <span className="font-mono text-[10px] text-slate-400 shrink-0">
                  {cmd.usage}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Miniatures des fichiers joints au-dessus du champ */}
        {attachedFiles.length > 0 && (
          <div className="mb-2 flex items-center gap-2 overflow-x-auto pb-1.5 pt-0.5 no-scrollbar">
            {attachedFiles.map((file) => (
              <div
                key={file.id}
                className="relative shrink-0 flex items-center gap-2 pl-2 pr-1.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 shadow-xs group"
              >
                {/* Miniature visuelle */}
                <div className="relative w-12 h-12 rounded-lg bg-slate-950 overflow-hidden shrink-0">
                  {file.previewUrl ? (
                    <img
                      src={file.previewUrl}
                      alt={file.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                  )}

                  {file.type === 'video' && (
                    <span className="absolute bottom-0.5 left-0.5 px-1 rounded bg-black/80 text-[9px] font-mono text-white flex items-center gap-0.5">
                      <Play className="w-2 h-2 fill-white" />
                      {formatDuration(file.duration || 0)}
                    </span>
                  )}
                </div>

                {/* Métadonnées du fichier */}
                <div className="max-w-[120px] sm:max-w-[150px] min-w-0 pr-1">
                  <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate leading-tight">
                    {file.name}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                    {file.type === 'video' ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                        {file.frames?.length || 0} trames (2s)
                      </span>
                    ) : (
                      formatFileSize(file.size)
                    )}
                  </p>
                </div>

                {/* Bouton pour retirer le fichier (Zone tactile accessible 44px) */}
                <button
                  type="button"
                  onClick={() => onRemoveFile(file.id)}
                  className="w-11 h-11 -mr-1 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                  aria-label={`Retirer le fichier ${file.name}`}
                  title="Retirer ce fichier"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}

            {attachedFiles.length < MAX_FILES_PER_MESSAGE && (
              <div className="text-[11px] text-slate-400 whitespace-nowrap pl-1 pr-2">
                {attachedFiles.length}/{MAX_FILES_PER_MESSAGE} fichiers
              </div>
            )}
          </div>
        )}

        {/* Ligne de saisie principale : Bouton Joindre + Textarea + Bouton Envoyer */}
        <div className="relative flex items-end gap-2 bg-slate-100/90 dark:bg-slate-800/90 p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-500 transition-all">
          {/* Inputs fichiers invisibles */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
            className="hidden"
            onChange={handleFileChange}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Bouton trombone « Joindre » (44px min) avec menu déroulant galerie / caméra */}
          <div className="relative shrink-0" ref={attachMenuRef}>
            <button
              type="button"
              onClick={() => setShowAttachMenu((prev) => !prev)}
              className="w-11 h-11 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-white dark:hover:bg-slate-700/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 active:scale-95"
              title="Joindre des images ou vidéos"
              aria-label="Joindre un fichier (images ou vidéos)"
              aria-expanded={showAttachMenu}
            >
              <Paperclip className="w-5 h-5" />
            </button>

            {/* Menu options Galerie / Caméra */}
            {showAttachMenu && (
              <div className="absolute bottom-13 left-0 w-52 p-1.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl z-50 animate-in slide-in-from-bottom-2 duration-150">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-11 px-3 rounded-xl flex items-center gap-3 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  <ImageIcon className="w-4 h-4 text-emerald-600" />
                  <span>Galerie / Fichiers</span>
                </button>

                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="w-full h-11 px-3 rounded-xl flex items-center gap-3 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  <Camera className="w-4 h-4 text-teal-600" />
                  <span>Prendre une photo</span>
                </button>
              </div>
            )}
          </div>

          {/* Champ de saisie multiligne */}
          <div className="relative flex-1 min-w-0 flex items-center">
            <textarea
              ref={textareaRef}
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={
                attachedFiles.length > 0
                  ? "Que voulez-vous analyser sur ces médias ? (/aide)"
                  : "Tapez une instruction ou /commande..."
              }
              className="w-full py-2.5 px-2 bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-sm leading-snug resize-none outline-none font-sans max-h-36 overflow-y-auto"
              aria-label="Champ d'instruction ou de commande"
            />

            {/* Rappel de la dernière instruction (Flèche haut visible si champ vide) */}
            {text === '' && lastInstruction && (
              <button
                type="button"
                onClick={() => setText(lastInstruction)}
                className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-md bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] text-slate-500 dark:text-slate-400 transition-colors mr-1"
                title={`Rappeler : « ${lastInstruction.slice(0, 30)}... »`}
              >
                <ArrowUp className="w-3 h-3" />
                <span>Rappeler</span>
              </button>
            )}
          </div>

          {/* Bouton « Envoyer » (44px min) */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSend}
            className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 ${
              canSend
                ? 'bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-md shadow-emerald-600/20 hover:scale-105 active:scale-95 cursor-pointer'
                : 'bg-slate-200 dark:bg-slate-700/60 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-60'
            }`}
            title="Envoyer l'instruction (Entrée)"
            aria-label="Envoyer l'instruction"
          >
            <Send className="w-5 h-5 fill-current" />
          </button>
        </div>

        {/* Message informatif de glisser-déposer sur grand écran */}
        <div className="hidden sm:flex items-center justify-between px-2 pt-1.5 text-[11px] text-slate-400 dark:text-slate-500">
          <span>Glissez-déposez des fichiers ou collez une capture avec Ctrl+V</span>
          <span>Entrée pour envoyer • Maj+Entrée pour saut de ligne</span>
        </div>
      </div>
    </div>
  );
};
