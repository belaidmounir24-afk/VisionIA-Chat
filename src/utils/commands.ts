import { SlashCommand } from '../types';

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    name: '/aide',
    aliases: ['/help', '/?'],
    description: "Affiche le guide d'utilisation et les commandes disponibles.",
    usage: '/aide',
    category: 'aide',
  },
  {
    name: '/effacer',
    aliases: ['/clear', '/reset'],
    description: 'Efface tout le fil de discussion et réinitialise la mémoire.',
    usage: '/effacer',
    category: 'action',
  },
  {
    name: '/exporter',
    aliases: ['/export', '/sauvegarder'],
    description: 'Télécharge ou copie la transcription de la discussion en Markdown.',
    usage: '/exporter',
    category: 'action',
  },
  {
    name: '/exemple',
    aliases: ['/demo', '/sample'],
    description: "Charge l'infographie modèle (MCP vs RAG vs Agents IA) pour tester.",
    usage: '/exemple',
    category: 'action',
  },
  {
    name: '/mode',
    aliases: ['/style'],
    description: 'Bascule entre mode de réponse détaillé et mode synthétique.',
    usage: '/mode [detaille|concis]',
    category: 'action',
  },
  {
    name: '/statut',
    aliases: ['/ping', '/diagnostic'],
    description: "Vérifie l'état du serveur backend et de la connexion IA.",
    usage: '/statut',
    category: 'aide',
  },
  {
    name: '/reglages',
    aliases: ['/voix', '/audio', '/settings'],
    description: "Ouvre les réglages de synthèse vocale Web Speech API et les préférences.",
    usage: '/reglages',
    category: 'action',
  },
];

export function getCommandSuggestions(query: string): SlashCommand[] {
  if (!query.startsWith('/')) return [];
  const clean = query.toLowerCase().trim();
  const search = clean.slice(1);

  if (search === '') {
    return SLASH_COMMANDS;
  }

  return SLASH_COMMANDS.filter((cmd) => {
    if (cmd.name.toLowerCase().includes(clean)) return true;
    if (cmd.aliases?.some((a) => a.toLowerCase().includes(clean))) return true;
    if (cmd.description.toLowerCase().includes(search)) return true;
    return false;
  });
}

export function parseCommand(text: string): {
  isCommand: boolean;
  commandName: string;
  args: string[];
} {
  const trimmed = text.trim();
  if (!trimmed.startsWith('/')) {
    return { isCommand: false, commandName: '', args: [] };
  }

  const parts = trimmed.split(/\s+/);
  const commandName = parts[0].toLowerCase();
  const args = parts.slice(1);

  return {
    isCommand: true,
    commandName,
    args,
  };
}
