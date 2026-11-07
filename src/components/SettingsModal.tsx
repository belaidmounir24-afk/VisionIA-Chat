import React, { useState, useEffect } from 'react';
import {
  X,
  Volume2,
  VolumeX,
  Settings,
  Sparkles,
  Play,
  Square,
  Check,
  AlertCircle,
  Gauge,
  Sliders,
} from 'lucide-react';
import {
  SpeechSettings,
  getAvailableVoices,
  isSpeechSynthesisSupported,
  cleanTextForSpeech,
} from '../utils/speechManager';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: SpeechSettings;
  onUpdateSettings: (newSettings: SpeechSettings) => void;
  answerMode: 'detaille' | 'concis';
  onUpdateAnswerMode: (mode: 'detaille' | 'concis') => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  answerMode,
  onUpdateAnswerMode,
}) => {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isPlayingSample, setIsPlayingSample] = useState(false);
  const isSupported = isSpeechSynthesisSupported();

  // Charger les voix du système
  useEffect(() => {
    if (!isSupported) return;

    const updateVoices = () => {
      const v = getAvailableVoices();
      setVoices(v);
    };

    updateVoices();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }

    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [isSupported]);

  // Stopper la lecture d'échantillon à la fermeture
  useEffect(() => {
    if (!isOpen && isPlayingSample && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsPlayingSample(false);
    }
  }, [isOpen, isPlayingSample]);

  if (!isOpen) return null;

  const handleTestVoice = () => {
    if (!isSupported) return;

    if (isPlayingSample) {
      window.speechSynthesis.cancel();
      setIsPlayingSample(false);
      return;
    }

    window.speechSynthesis.cancel();

    const sampleText = cleanTextForSpeech(
      "Bonjour ! La synthèse vocale Web Speech API est active. Vos réponses seront lues à haute voix avec ces réglages."
    );

    const utterance = new SpeechSynthesisUtterance(sampleText);
    utterance.rate = settings.rate;
    utterance.pitch = settings.pitch;
    utterance.volume = settings.volume;

    if (settings.voiceUri) {
      const found = voices.find((v) => v.voiceURI === settings.voiceUri);
      if (found) {
        utterance.voice = found;
      }
    } else {
      // Voix française par défaut si aucune n'est choisie
      const frVoice = voices.find((v) => v.lang.toLowerCase().startsWith('fr'));
      if (frVoice) {
        utterance.voice = frVoice;
      }
    }

    utterance.onstart = () => setIsPlayingSample(true);
    utterance.onend = () => setIsPlayingSample(false);
    utterance.onerror = () => setIsPlayingSample(false);

    window.speechSynthesis.speak(utterance);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 id="settings-modal-title" className="text-base font-bold text-slate-900 dark:text-white">
                Réglages de l'Assistant
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Synthèse vocale Web Speech API &amp; Préférences
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            aria-label="Fermer les réglages"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corps des réglages */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Section Synthèse Vocale */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                  Synthèse Vocale (Web Speech API)
                </h3>
              </div>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  isSupported
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300'
                }`}
              >
                {isSupported ? 'Disponible dans votre navigateur' : 'Non pris en charge'}
              </span>
            </div>

            {/* Interrupteur principal Lecture automatique */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
              <div className="space-y-0.5 pr-4">
                <label
                  htmlFor="toggle-auto-read"
                  className="text-sm font-semibold text-slate-900 dark:text-slate-100 cursor-pointer"
                >
                  Lire les réponses à haute voix
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  L'assistant lira automatiquement chaque nouvelle réponse générée dès sa réception.
                </p>
              </div>
              <button
                id="toggle-auto-read"
                type="button"
                role="switch"
                aria-checked={settings.autoRead}
                onClick={() =>
                  onUpdateSettings({
                    ...settings,
                    autoRead: !settings.autoRead,
                  })
                }
                disabled={!isSupported}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed ${
                  settings.autoRead ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    settings.autoRead ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Options avancées de la voix */}
            {isSupported && (
              <div className="space-y-4 pt-1">
                {/* Sélection de la voix */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="select-voice"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Voix de lecture
                  </label>
                  <select
                    id="select-voice"
                    value={settings.voiceUri}
                    onChange={(e) =>
                      onUpdateSettings({
                        ...settings,
                        voiceUri: e.target.value,
                      })
                    }
                    className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Voix française recommandée par défaut</option>
                    {voices.map((v) => (
                      <option key={v.voiceURI} value={v.voiceURI}>
                        {v.name} ({v.lang})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Vitesse de lecture (Débit) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Gauge className="w-3.5 h-3.5 text-slate-500" />
                      Vitesse d'élocution (Débit)
                    </span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                      {settings.rate.toFixed(1)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.8"
                    max="1.5"
                    step="0.1"
                    value={settings.rate}
                    onChange={(e) =>
                      onUpdateSettings({
                        ...settings,
                        rate: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-emerald-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                    <span>0.8x (Posé)</span>
                    <span>1.0x (Normal)</span>
                    <span>1.2x (Dynamique)</span>
                    <span>1.5x (Rapide)</span>
                  </div>
                </div>

                {/* Bouton de test vocal */}
                <button
                  type="button"
                  onClick={handleTestVoice}
                  className={`w-full py-2.5 px-4 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold transition-all ${
                    isPlayingSample
                      ? 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-900/60 dark:text-rose-300'
                      : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300'
                  }`}
                >
                  {isPlayingSample ? (
                    <>
                      <Square className="w-4 h-4 fill-current" />
                      Arrêter l'échantillon vocal
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      Tester la voix configurée
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Section Style de réponse */}
          <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                Format des Réponses
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onUpdateAnswerMode('detaille')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  answerMode === 'detaille'
                    ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100 font-semibold ring-1 ring-emerald-500'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold">Détaillé</span>
                  {answerMode === 'detaille' && <Check className="w-4 h-4 text-emerald-600" />}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                  Analyses complètes, articles de lois et démarches détaillées.
                </p>
              </button>

              <button
                type="button"
                onClick={() => onUpdateAnswerMode('concis')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  answerMode === 'concis'
                    ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100 font-semibold ring-1 ring-emerald-500'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold">Synthétique</span>
                  {answerMode === 'concis' && <Check className="w-4 h-4 text-emerald-600" />}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                  Résumés percutants, idéal pour une lecture vocale rapide.
                </p>
              </button>
            </div>
          </div>
        </div>

        {/* Pied du modal */}
        <div className="flex items-center justify-end px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-colors"
          >
            Enregistrer et fermer
          </button>
        </div>
      </div>
    </div>
  );
};
