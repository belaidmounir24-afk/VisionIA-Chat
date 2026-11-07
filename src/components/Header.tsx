import React from 'react';
import {
  Sparkles,
  Sun,
  Moon,
  Trash2,
  HelpCircle,
  Zap,
  Volume2,
  VolumeX,
  Settings,
  Square,
} from 'lucide-react';

interface HeaderProps {
  isDark: boolean;
  onToggleTheme: () => void;
  reducedMotion: boolean;
  onToggleReducedMotion: () => void;
  onClearHistory: () => void;
  onOpenHelp: () => void;
  onOpenSettings: () => void;
  isSpeechEnabled: boolean;
  onToggleSpeech: () => void;
  isSpeaking: boolean;
  onStopSpeech: () => void;
  messageCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  isDark,
  onToggleTheme,
  reducedMotion,
  onToggleReducedMotion,
  onClearHistory,
  onOpenHelp,
  onOpenSettings,
  isSpeechEnabled,
  onToggleSpeech,
  isSpeaking,
  onStopSpeech,
  messageCount,
}) => {
  return (
    <header className="sticky top-0 z-30 w-full border-b border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md transition-colors">
      <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between gap-2">
        {/* Logo et titre */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white shadow-md shadow-emerald-500/10 shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base md:text-lg text-slate-900 dark:text-white truncate">
                Boîte de Commande IA
              </h1>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                Multimodal 1600px
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="truncate">Gemini Multimodal • Web Speech API</span>
            </div>
          </div>
        </div>

        {/* Actions de la barre d'en-tête */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Bouton Synthèse vocale rapide (Lecture en cours ou bascule Muet) */}
          {isSpeaking ? (
            <button
              type="button"
              onClick={onStopSpeech}
              className="h-10 px-2.5 rounded-lg flex items-center gap-1.5 bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300 hover:bg-rose-200 dark:hover:bg-rose-900/80 transition-colors animate-pulse focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              title="Arrêter la lecture vocale en cours"
              aria-label="Arrêter la lecture vocale"
            >
              <Square className="w-4 h-4 fill-current" />
              <span className="text-xs font-semibold hidden sm:inline">Arrêter</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onToggleSpeech}
              className={`w-11 h-11 rounded-lg flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                isSpeechEnabled
                  ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60'
                  : 'text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title={
                isSpeechEnabled
                  ? 'Lecture à haute voix activée (cliquer pour couper)'
                  : 'Lecture à haute voix coupée (cliquer pour activer)'
              }
              aria-label="Bascule de la lecture à haute voix"
            >
              {isSpeechEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
          )}

          {/* Bouton Réglages complets (Voix, Débit, Format) */}
          <button
            type="button"
            onClick={onOpenSettings}
            className="w-11 h-11 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            title="Réglages de la synthèse vocale et de l'assistant"
            aria-label="Ouvrir les réglages de la synthèse vocale"
          >
            <Settings className="w-5 h-5" />
          </button>

          {/* Bouton d'aide */}
          <button
            type="button"
            onClick={onOpenHelp}
            className="w-11 h-11 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            title="Aide et commandes (/aide)"
            aria-label="Ouvrir le guide et la liste des commandes"
          >
            <HelpCircle className="w-5 h-5" />
          </button>

          {/* Bouton bascule mouvement réduit */}
          <button
            type="button"
            onClick={onToggleReducedMotion}
            className={`w-11 h-11 rounded-lg flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
              reducedMotion
                ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title={
              reducedMotion
                ? 'Animations réduites activées (cliquer pour désactiver)'
                : 'Activer le mode animations réduites'
            }
            aria-label="Bascule des animations réduites"
          >
            <Zap className="w-5 h-5" />
          </button>

          {/* Bouton thème clair/sombre */}
          <button
            type="button"
            onClick={onToggleTheme}
            className="w-11 h-11 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            title={isDark ? 'Passer au thème clair' : 'Passer au thème sombre'}
            aria-label="Basculer entre thème clair et sombre"
          >
            {isDark ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
          </button>

          {/* Bouton effacer l'historique */}
          {messageCount > 0 && (
            <button
              type="button"
              onClick={onClearHistory}
              className="w-11 h-11 rounded-lg flex items-center justify-center text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              title="Effacer la discussion (/effacer)"
              aria-label="Effacer toute la discussion"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
