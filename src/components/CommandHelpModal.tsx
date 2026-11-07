import React, { useEffect } from 'react';
import { X, Terminal, FileText, CornerDownLeft, ArrowUp, Sparkles, Image, Video } from 'lucide-react';
import { SLASH_COMMANDS } from '../utils/commands';

interface CommandHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCommand: (cmdName: string) => void;
}

export const CommandHelpModal: React.FC<CommandHelpModalProps> = ({
  isOpen,
  onClose,
  onSelectCommand,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Aide et guide d'utilisation"
    >
      <div
        className="relative w-full max-w-xl max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base text-slate-900 dark:text-white">
                Guide &amp; Commandes
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Boîte de commande multimodale IA
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            aria-label="Fermer le guide"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corps avec défilement */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 text-sm text-slate-700 dark:text-slate-300">
          {/* Raccourcis et saisie */}
          <div>
            <h3 className="font-semibold text-xs tracking-wider uppercase text-slate-400 dark:text-slate-500 mb-3">
              Raccourcis &amp; Interaction
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span>Envoyer l'instruction</span>
                <kbd className="px-2 py-1 rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 font-mono font-semibold text-[11px] text-slate-800 dark:text-slate-200 shadow-xs flex items-center gap-1">
                  <CornerDownLeft className="w-3 h-3" /> Entrée
                </kbd>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span>Saut de ligne</span>
                <kbd className="px-2 py-1 rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 font-mono font-semibold text-[11px] text-slate-800 dark:text-slate-200 shadow-xs">
                  Maj + Entrée
                </kbd>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span>Rappeler la dernière instruction</span>
                <kbd className="px-2 py-1 rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 font-mono font-semibold text-[11px] text-slate-800 dark:text-slate-200 shadow-xs flex items-center gap-1">
                  <ArrowUp className="w-3 h-3" /> Flèche Haut
                </kbd>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span>Coller une image presse-papiers</span>
                <kbd className="px-2 py-1 rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 font-mono font-semibold text-[11px] text-slate-800 dark:text-slate-200 shadow-xs">
                  Ctrl + V
                </kbd>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between sm:col-span-2">
                <span>Lecture vocale haute fidélité (TTS)</span>
                <span className="font-semibold text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  Bouton « Écouter / Arrêter » sur chaque réponse
                </span>
              </div>
            </div>
          </div>

          {/* Règles de traitement des médias */}
          <div>
            <h3 className="font-semibold text-xs tracking-wider uppercase text-slate-400 dark:text-slate-500 mb-3">
              Traitement automatique des fichiers
            </h3>
            <div className="space-y-2">
              <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 flex items-start gap-3">
                <Image className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-semibold text-emerald-900 dark:text-emerald-200">
                    Images (JPG, PNG, WEBP)
                  </p>
                  <p className="text-emerald-800/80 dark:text-emerald-300/80 mt-0.5">
                    Redimensionnées côté client à un maximum de 1600 px pour une transmission rapide et une analyse haute définition.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-teal-50/60 dark:bg-teal-950/30 border border-teal-100 dark:border-teal-900/40 flex items-start gap-3">
                <Video className="w-5 h-5 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-semibold text-teal-900 dark:text-teal-200">
                    Vidéos (MP4, MOV, WEBM)
                  </p>
                  <p className="text-teal-800/80 dark:text-teal-300/80 mt-0.5">
                    Extraction côté client d'une image toutes les 2 secondes (jusqu'à 12 images par vidéo) avec horodatage transmis au modèle.
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                Limites autorisées : jusqu'à 10 fichiers par message, 20 Mo par fichier.
              </p>
            </div>
          </div>

          {/* Commandes slash */}
          <div>
            <h3 className="font-semibold text-xs tracking-wider uppercase text-slate-400 dark:text-slate-500 mb-3">
              Commandes d'application (commencent par /)
            </h3>
            <div className="space-y-2">
              {SLASH_COMMANDS.map((cmd) => (
                <button
                  key={cmd.name}
                  type="button"
                  onClick={() => {
                    onSelectCommand(cmd.name);
                    onClose();
                  }}
                  className="w-full text-left p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-emerald-50 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-800 hover:border-emerald-200 dark:hover:border-emerald-700/50 transition-colors flex items-center justify-between gap-3 group"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {cmd.name}
                      </span>
                      {cmd.aliases && (
                        <span className="text-[11px] text-slate-400">
                          ({cmd.aliases.join(', ')})
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                      {cmd.description}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    Insérer
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Pied de page */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-11 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
