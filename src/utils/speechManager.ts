// Module de gestion de la synthèse vocale basé sur la Web Speech API (window.speechSynthesis)

export interface SpeechSettings {
  autoRead: boolean; // Lecture automatique des réponses de l'IA
  voiceUri: string; // Identifiant unique de la voix
  rate: number; // Vitesse d'élocution (0.8 à 1.5)
  pitch: number; // Hauteur de la voix (0.8 à 1.2)
  volume: number; // Volume (0.0 à 1.0)
}

export const DEFAULT_SPEECH_SETTINGS: SpeechSettings = {
  autoRead: true, // Activé par défaut selon la demande
  voiceUri: '',
  rate: 1.0,
  pitch: 1.0,
  volume: 1.0,
};

const STORAGE_KEY_SPEECH = 'marchedz_speech_settings_v1';

export function loadSpeechSettings(): SpeechSettings {
  if (typeof window === 'undefined') return DEFAULT_SPEECH_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SPEECH);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_SPEECH_SETTINGS, ...parsed };
    }
  } catch {
    // Échec de lecture local storage
  }
  return DEFAULT_SPEECH_SETTINGS;
}

export function saveSpeechSettings(settings: SpeechSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_SPEECH, JSON.stringify(settings));
  } catch {
    // Ignorer
  }
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

/**
 * Nettoie le texte Markdown pour obtenir une prononciation fluide, agréable et naturelle
 */
export function cleanTextForSpeech(text: string): string {
  if (!text) return '';

  return text
    // Supprimer les blocs de code volumineux pour ne pas épeler le code
    .replace(/```[\s\S]*?```/g, ' [extrait technique omis] ')
    // Remplacer le code inline par le mot sans accentuation syntaxique
    .replace(/`([^`]+)`/g, '$1')
    // Liens markdown [texte](url) -> texte
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Supprimer les URLs brutes
    .replace(/https?:\/\/[^\s]+/g, ' lien web ')
    // Nettoyer les puces et symboles markdown
    .replace(/[*_#~>•-]/g, ' ')
    // Remplacer les tirets doubles par des pauses
    .replace(/--+/g, ', ')
    // Remplacer abréviations fréquentes pour une meilleure diction
    .replace(/\bArt\./gi, 'Article ')
    .replace(/\bAl\./gi, 'Alinéa ')
    .replace(/\bD\.P\./gi, 'Décret présidentiel ')
    .replace(/\bCDC\b/g, 'Cahier des charges ')
    .replace(/\bBOMOP\b/g, 'BOMOP ')
    .replace(/\bCHU\b/g, 'C-H-U ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Récupère les voix disponibles sur le système, triées par pertinence (Français en premier)
 */
export function getAvailableVoices(): SpeechSynthesisVoice[] {
  if (!isSpeechSynthesisSupported()) return [];
  const voices = window.speechSynthesis.getVoices();
  
  // Tri : voix françaises en tête, puis alphabétique
  return [...voices].sort((a, b) => {
    const aIsFr = a.lang.toLowerCase().startsWith('fr');
    const bIsFr = b.lang.toLowerCase().startsWith('fr');
    if (aIsFr && !bIsFr) return -1;
    if (!aIsFr && bIsFr) return 1;
    return a.name.localeCompare(b.name);
  });
}
