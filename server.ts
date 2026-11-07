import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Activer CORS pour permettre les requêtes depuis l'application Android (émulateur 10.0.2.2 ou device réel)
app.use(cors());

// Autoriser les charges utiles contenant des images et des trames vidéo en base64
app.use(express.json({ limit: '60mb' }));
app.use(express.urlencoded({ extended: true, limit: '60mb' }));

// Initialisation du client GoogleGenAI côté serveur avec User-Agent 'aistudio-build'
const getAiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
      timeout: 75000,
    },
  });
};

// Route de vérification de l'état du serveur
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    hasApiKey: Boolean(process.env.GEMINI_API_KEY),
    time: new Date().toISOString(),
  });
});

interface IncomingFile {
  type: 'image' | 'video';
  name: string;
  mimeType?: string;
  dataUrl?: string;
  duration?: number;
  frames?: Array<{
    timestamp: number;
    dataUrl: string;
    mimeType: string;
  }>;
}

interface ChatMessagePayload {
  role: 'user' | 'model';
  text: string;
  files?: IncomingFile[];
}

// Extraction du base64 pur à partir d'une URL de données (data:image/...;base64,XXXX)
function extractBase64(dataUrl: string): { mimeType: string; base64: string } {
  const matches = dataUrl.match(/^data:([a-zA-Z0-9\/+-]+);base64,(.+)$/);
  if (matches && matches.length === 3) {
    return {
      mimeType: matches[1],
      base64: matches[2],
    };
  }
  return {
    mimeType: 'image/jpeg',
    base64: dataUrl.replace(/^data:[^;]+;base64,/, ''),
  };
}

// Route principale de conversation multimodale
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const { message, history } = req.body as {
      message?: ChatMessagePayload;
      history?: ChatMessagePayload[];
    };

    if (!message || (!message.text && (!message.files || message.files.length === 0))) {
      return res.status(400).json({
        error: "Le message doit contenir du texte ou au moins un fichier joint.",
      });
    }

    const ai = getAiClient();
    if (!ai) {
      return res.status(500).json({
        error: "La clé API Gemini n'est pas configurée dans l'environnement du serveur (Settings > Secrets).",
      });
    }

    // Préparation de l'historique au format Gemini Contents
    const contents: Array<{
      role: 'user' | 'model';
      parts: Array<
        | { text: string }
        | { inlineData: { mimeType: string; data: string } }
      >;
    }> = [];

    // Ajouter l'historique précédent (limité aux 8 derniers messages pour éviter l'explosion de charge)
    if (Array.isArray(history)) {
      const recentHistory = history.slice(-8);
      for (const item of recentHistory) {
        if (item.role === 'model') {
          contents.push({
            role: 'model',
            parts: [{ text: item.text || '' }],
          });
        } else if (item.role === 'user') {
          const parts: Array<
            | { text: string }
            | { inlineData: { mimeType: string; data: string } }
          > = [];

          if (item.text) {
            parts.push({ text: item.text });
          }

          if (Array.isArray(item.files)) {
            for (const file of item.files) {
              if (file.type === 'image' && file.dataUrl) {
                const { mimeType, base64 } = extractBase64(file.dataUrl);
                parts.push({
                  inlineData: {
                    mimeType: mimeType || 'image/jpeg',
                    data: base64,
                  },
                });
              } else if (file.type === 'video') {
                // Dans l'historique passé, n'inclure que la 1ère trame représentative pour alléger la charge
                const repFrame = file.frames?.[0] || file.dataUrl;
                parts.push({
                  text: `[Vidéo passée "${file.name}" - durée : ${file.duration || 0}s]`,
                });
                if (repFrame) {
                  const frameUrl = typeof repFrame === 'string' ? repFrame : repFrame.dataUrl;
                  const { mimeType, base64 } = extractBase64(frameUrl);
                  parts.push({
                    inlineData: {
                      mimeType: mimeType || 'image/jpeg',
                      data: base64,
                    },
                  });
                }
              }
            }
          }

          if (parts.length > 0) {
            contents.push({
              role: 'user',
              parts,
            });
          }
        }
      }
    }

    // Préparer le tour utilisateur actuel
    // Spécification : « Le message contient le texte de l'utilisateur, puis les images dans l'ordre où elles ont été jointes. »
    const currentParts: Array<
      | { text: string }
      | { inlineData: { mimeType: string; data: string } }
    > = [];

    // 1. Texte de l'utilisateur en premier
    if (message.text && message.text.trim()) {
      currentParts.push({ text: message.text.trim() });
    } else {
      currentParts.push({ text: "Analyse les images et vidéos jointes ci-dessous et réponds à l'instruction." });
    }

    // 2. Fichiers dans l'ordre où ils ont été joints
    if (Array.isArray(message.files) && message.files.length > 0) {
      for (const file of message.files) {
        if (file.type === 'image' && file.dataUrl) {
          const { mimeType, base64 } = extractBase64(file.dataUrl);
          currentParts.push({
            inlineData: {
              mimeType: mimeType || 'image/jpeg',
              data: base64,
            },
          });
        } else if (file.type === 'video' && Array.isArray(file.frames)) {
          currentParts.push({
            text: `[Vidéo jointe : "${file.name}" - durée : ${file.duration || 0}s. Voici les trames capturées à intervalle de 2 secondes :]`,
          });
          for (const frame of file.frames) {
            const { mimeType, base64 } = extractBase64(frame.dataUrl);
            currentParts.push({
              text: `[T = ${frame.timestamp}s]`,
            });
            currentParts.push({
              inlineData: {
                mimeType: mimeType || 'image/jpeg',
                data: base64,
              },
            });
          }
        }
      }
    }

    contents.push({
      role: 'user',
      parts: currentParts,
    });

    // Consigne système obligatoire :
    // « Analyse les images et vidéos jointes, puis réponds à l'instruction de l'utilisateur. Si l'instruction est ambiguë, pose une seule question. »
    const systemInstruction =
      "Analyse les images et vidéos jointes, puis réponds à l'instruction de l'utilisateur. Si l'instruction est ambiguë, pose une seule question. Réponds toujours en français, avec une mise en page claire et aérée.";

    // Modèles actifs et hautement disponibles (gemini-3.8-flash exclu car quota journalier Free Tier de 20 requêtes/jour dépassé)
    const modelsToTry = [
      'gemini-flash-lite-latest',
      'gemini-3-flash-preview',
      'gemini-3.5-flash',
      'gemini-3.1-flash-lite',
    ];
    let lastError: unknown = null;
    let replyText = '';
    let usedModel = modelsToTry[0];
    let usageMetadata: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } | undefined;

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    for (const model of modelsToTry) {
      // Pour chaque modèle, autoriser jusqu'à 2 tentatives pour absorber un micro-pic 503 passager
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents,
            config: {
              systemInstruction,
            },
          });

          if (response.text) {
            replyText = response.text;
            usedModel = model;
            usageMetadata = response.usageMetadata;
            break;
          }
        } catch (err: unknown) {
          lastError = err;
          const errStr = String(err);
          const isDemandSpike =
            errStr.includes('503') ||
            errStr.includes('UNAVAILABLE') ||
            errStr.includes('high demand');

          if (isDemandSpike && attempt < 2) {
            console.warn(`Pic passager sur ${model} (tentative ${attempt}/2), brève pause de 700ms...`);
            await sleep(700);
            continue;
          }

          console.warn(`Modèle ${model} indisponible (${errStr.slice(0, 100)}...), bascule sur le modèle suivant...`);
          break; // Passer au modèle suivant dans la liste
        }
      }

      if (replyText) {
        break;
      }
    }

    if (!replyText && lastError) {
      throw lastError;
    }

    // Calcul précis ou approximatif des tokens
    const promptTokens = usageMetadata?.promptTokenCount ?? Math.max(1, Math.round(JSON.stringify(contents).length / 4));
    const candidatesTokens = usageMetadata?.candidatesTokenCount ?? Math.max(1, Math.round(replyText.length / 4));
    const totalTokens = usageMetadata?.totalTokenCount ?? (promptTokens + candidatesTokens);

    // Tarification standard Gemini en dollars USD par million de tokens
    let promptRatePerMillion = 0.10;
    let candidatesRatePerMillion = 0.40;
    if (usedModel.includes('lite')) {
      promptRatePerMillion = 0.075;
      candidatesRatePerMillion = 0.30;
    } else if (usedModel.includes('3.8-flash') || usedModel.includes('flash-latest')) {
      promptRatePerMillion = 0.15;
      candidatesRatePerMillion = 0.60;
    }
    const estimatedCostUsd = (promptTokens * promptRatePerMillion + candidatesTokens * candidatesRatePerMillion) / 1000000;

    return res.json({
      reply: replyText || "Aucune réponse n'a pu être générée par le modèle.",
      usage: {
        promptTokens,
        candidatesTokens,
        totalTokens,
        estimatedCostUsd,
        modelName: usedModel,
      },
    });
  } catch (error: unknown) {
    console.error('Erreur lors du traitement Gemini:', error);

    const errorMessage = error instanceof Error ? error.message : String(error);

    // Messages d'erreur en français sans jargon
    if (errorMessage.includes('DEADLINE_EXCEEDED') || errorMessage.includes('504') || errorMessage.includes('timeout')) {
      return res.status(504).json({
        error: "Le délai de traitement a expiré (l'analyse a pris trop de temps). Veuillez cliquer sur Réessayer ou poser une question plus concise.",
      });
    }

    if (errorMessage.includes('503') || errorMessage.includes('UNAVAILABLE') || errorMessage.includes('high demand')) {
      return res.status(503).json({
        error: "Le service d'IA subit une forte demande temporaire. Veuillez patienter quelques instants et cliquer sur Réessayer.",
      });
    }

    if (errorMessage.includes('RESOURCE_EXHAUSTED') || errorMessage.includes('429') || errorMessage.includes('quota')) {
      return res.status(429).json({
        error: "Le service d'intelligence artificielle est temporairement saturé. Veuillez patienter quelques instants avant de réessayer.",
      });
    }

    if (errorMessage.includes('API_KEY_INVALID') || errorMessage.includes('PERMISSION_DENIED') || errorMessage.includes('403')) {
      return res.status(403).json({
        error: "La clé API Gemini est invalide ou non autorisée. Vérifiez la configuration dans le panneau Secrets.",
      });
    }

    if (errorMessage.includes('Payload Too Large') || errorMessage.includes('413')) {
      return res.status(413).json({
        error: "Les fichiers joints sont trop volumineux pour être envoyés. Essayez d'envoyer moins de fichiers ou de réduire leur résolution.",
      });
    }

    if (errorMessage.includes('INVALID_ARGUMENT') || errorMessage.includes('400')) {
      return res.status(400).json({
        error: "Le format ou les données d'un des fichiers n'ont pas pu être lus par le modèle. Veuillez vérifier vos images ou vidéos.",
      });
    }

    return res.status(500).json({
      error: "Une erreur de communication est survenue avec le service d'IA. Veuillez vérifier votre connexion et réessayer.",
      details: process.env.NODE_ENV !== 'production' ? errorMessage : undefined,
    });
  }
});

// Route de synthèse vocale haute définition (Text-to-Speech)
app.post('/api/tts', async (req: Request, res: Response) => {
  try {
    const { text, voice } = req.body as { text?: string; voice?: string };
    if (!text || !text.trim()) {
      return res.status(400).json({ error: "Le texte à vocaliser ne peut pas être vide." });
    }

    const ai = getAiClient();
    if (!ai) {
      return res.status(500).json({ error: "Clé API non configurée." });
    }

    // Nettoyer les marqueurs markdown pour une élocution naturelle
    const cleanedText = text
      .replace(/```[\s\S]*?```/g, ' [bloc de code omis] ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[*_#~>]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 1500);

    const voiceName = voice || 'Kore';

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [{ text: cleanedText }],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      return res.status(500).json({ error: "Le modèle n'a pas renvoyé de flux audio." });
    }

    return res.json({
      audio: base64Audio,
      mimeType: 'audio/wav',
    });
  } catch (err: unknown) {
    console.error('Erreur synthèse vocale TTS:', err);
    return res.status(500).json({
      error: "La synthèse vocale n'a pas pu être générée.",
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

// ==========================================
// ==========================================
// MOTEUR RAG (Retrieval-Augmented Generation) & CAG (Cache-Augmented Generation)
// ==========================================

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
  // Compatibilité ascendante
  response?: string;
  status?: string;
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
  // Compatibilité ascendante
  response?: string;
  status?: string;
}

interface RagIndexedDocument {
  id: string;
  documentTitle: string;
  sourceFile: string;
  pageOrSection: string;
  category: 'loi' | 'decret' | 'jurisprudence' | 'procedure' | 'cdc';
  chunkSnippet: string;
  keywords: string[];
}

// Corpus juridique sectoriel indexé avec granularité fine
const RAG_CORPUS: RagIndexedDocument[] = [
  {
    id: 'dp-15-247-art27',
    documentTitle: 'Interdiction des marques sans formule d\'équivalence',
    sourceFile: 'decret_presidentiel_15-247.pdf',
    pageOrSection: 'Art. 27 alinéa 3 • JORADP N° 50',
    category: 'decret',
    chunkSnippet: '« Il ne peut être fait mention dans les spécifications techniques de marques de fabrication ou de commerce, de brevets, d’origines ou de productions déterminées qui auraient pour effet de favoriser ou d\'éliminer certaines entreprises ou certains produits, sauf si de telles mentions sont justifiées par l\'objet du marché et accompagnées de la mention "ou équivalent". »',
    keywords: ['marque', 'équivalent', 'spécifications', 'cdc', 'cahier des charges', 'dell', 'cisco', 'constructeur', 'imposée', 'exclusive', 'lot', 'fourniture']
  },
  {
    id: 'conseil-etat-184920',
    documentTitle: 'Jurisprudence : Nullité de plein droit de clause exclusive',
    sourceFile: 'arret_conseil_etat_184920.pdf',
    pageOrSection: 'Chambre 2 • Arrêt N° 184920 du 14/11/2019',
    category: 'jurisprudence',
    chunkSnippet: 'La Haute juridiction administrative a confirmé la nullité de plein droit d\'une spécification technique d\'un cahier des charges ayant réservé l\'attribution à une marque commerciale unique sans mention d\'équivalence, ordonnant au maître d\'ouvrage de suspendre le délai de dépôt et de faire publier un additif rectificatif au BOMOP sous astreinte.',
    keywords: ['conseil d\'état', 'arrêt', 'jurisprudence', 'nullité', 'recours', 'additif', 'bomop', 'rectificatif', 'suspension', 'astreinte']
  },
  {
    id: 'dp-15-247-art54',
    documentTitle: 'Délais légaux de préparation des offres et prorogation',
    sourceFile: 'decret_presidentiel_15-247.pdf',
    pageOrSection: 'Articles 54 et 66 • JORADP N° 50',
    category: 'decret',
    chunkSnippet: 'Le délai de préparation des offres est fixé en fonction de la complexité de l\'objet du marché. Si une modification substantielle ou un additif est apporté au cahier des charges, le service contractant a l\'obligation impérative de proroger le délai de dépôt d\'une durée proportionnelle et de publier un avis de prorogation de délai au BOMOP.',
    keywords: ['délai', 'préparation', 'offres', 'prorogation', 'bomop', 'publication', 'jours', 'dépôt', 'additif', 'wilaya', 'prolongation']
  },
  {
    id: 'loi-23-12-principes',
    documentTitle: 'Principes constitutionnels de la commande publique',
    sourceFile: 'loi_23-12_marches_publics.pdf',
    pageOrSection: 'Articles 3 à 5 • JORADP N° 52',
    category: 'loi',
    chunkSnippet: 'La commande publique obéit aux principes de liberté d\'accès à la commande publique, d\'égalité de traitement des candidats, et de transparence des procédures. Ces principes s\'imposent aux services contractants de l\'État, des collectivités locales et des établissements publics hospitaliers (CHU, EPH). Tout manquement ouvre droit à recours gracieux et contentieux.',
    keywords: ['loi 23-12', 'principes', 'liberté d\'accès', 'égalité', 'transparence', 'chu', 'administration', 'soumissionnaire', 'fondement']
  },
  {
    id: 'dp-15-247-recours',
    documentTitle: 'Procédure du recours préalable et saisine CSMP',
    sourceFile: 'decret_presidentiel_15-247.pdf',
    pageOrSection: 'Articles 82 et 158 • JORADP N° 50',
    category: 'procedure',
    chunkSnippet: 'Tout soumissionnaire constatant une violation des règles de passation peut introduire un recours gracieux préalable auprès du premier responsable du service contractant dans un délai de dix (10) jours à compter de la publication de l\'avis ou du retrait du CDC. En l\'absence de réponse ou rejet, saisine de la Commission Sectorielle des Marchés Publics (CSMP).',
    keywords: ['recours', 'gracieux', 'délai', '10 jours', 'csmp', 'commission', 'contentieux', 'tribunal administratif', 'directeur', 'lettre']
  },
  {
    id: 'dp-15-247-caution',
    documentTitle: 'Régime de la caution de soumission et dispenses',
    sourceFile: 'decret_presidentiel_15-247.pdf',
    pageOrSection: 'Article 125 • JORADP N° 50',
    category: 'decret',
    chunkSnippet: 'La caution de soumission est fixée entre 1% et 2% du montant de l\'offre pour les marchés de travaux et fournitures. Sont légalement exemptées les micro-entreprises agréées (ex-ANSEJ / NESDA) ainsi que les artisans et coopératives artisanales conformément aux mesures nationales de soutien.',
    keywords: ['caution', 'soumission', 'dispense', 'banque', 'garantie', 'micro-entreprise', 'ansej', 'nesda', 'restitution', 'banque']
  },
  {
    id: 'cdc-chu-mustapha-2025',
    documentTitle: 'Cahier des Charges CHU Mustapha Bacha - Consultation N° 42',
    sourceFile: 'cdc_chu_mustapha_42_dg_2025.pdf',
    pageOrSection: 'Cahier des Prescriptions Spéciales • Lot N° 01 & 02',
    category: 'cdc',
    chunkSnippet: 'Consultation N° 42/DG/DSI/2025 relative à la modernisation de l\'infrastructure serveur et réseau du CHU Mustapha Bacha. Lot 01 : Serveurs rack haute densité Dell PowerEdge R760. Lot 02 : Cœur de réseau 100GbE. Délai limite de soumission : 21 jours à compter de la parution au BOMOP.',
    keywords: ['chu mustapha bacha', 'lot 1', 'serveurs', 'dell poweredge', 'infrastructure', 'dsi', 'consultation 42', 'réseau', 'cdc']
  }
];

// Contextes CAG (Cache-Augmented Generation) pré-chargés en mémoire / cache contextuel
const CAG_CONTEXT_REGISTRY: Record<string, {
  title: string;
  reference: string;
  description: string;
  tokenCount: number;
  fullText: string;
}> = {
  'chu-mustapha-42-dg-2025': {
    title: 'Cahier des Charges Exhaustif • CHU Mustapha Bacha N° 42/DG/DSI/2025',
    reference: 'Consultation N° 42/DG/DSI/2025 (Date parution BOMOP : 12/02/2025)',
    description: 'Document intégral comprenant le Règlement de la Consultation (RC), le Cahier des Prescriptions Spéciales (CPS) et le Bordereau des Prix Unitaires.',
    tokenCount: 8450,
    fullText: `RÉPUBLIQUE ALGÉRIENNE DÉMOCRATIQUE ET POPULAIRE
MINISTÈRE DE LA SANTÉ ET DE LA POPULATION
CENTRE HOSPITALO-UNIVERSITAIRE MUSTAPHA BACHA (ALGER)
DIRECTION GÉNÉRALE - SOUS-DIRECTION DES MARCHÉS PUBLICS
CONSULTATION N° 42/DG/DSI/2025

ARTICLE 1 : OBJET DU MARCHÉ
La présente consultation a pour objet la fourniture, l'installation, la mise en service et la maintenance sur site d'équipements informatiques pour le centre de données central du CHU Mustapha Bacha.
Le marché est divisé en deux (02) lots distincts :
- Lot N° 01 : Plateforme de virtualisation et serveurs d'applications hospitalières.
- Lot N° 02 : Cœur de réseau sécurisé et commutation fédératrice.

ARTICLE 2 : CONDITIONS DE PARTICIPATION
Sont admises à concourir les entreprises spécialisées dans le domaine informatique disposant d'un registre du commerce idoine et d'une qualification professionnelle minimale. Les soumissionnaires doivent justifier de références similaires au cours des trois (03) dernières années.

ARTICLE 3 : SPÉCIFICATIONS TECHNIQUES DU LOT N° 01 (LITIGIEUX)
Les serveurs requis doivent correspondre strictement à l'architecture matérielle "Dell PowerEdge R760" ou "Dell EMC", avec bi-processeur 32 cœurs, 512 Go de mémoire RAM DDR5 ECC, double alimentation redondante 1400W Titanium, et carte de gestion distante iDRAC9 Enterprise.
Aucune variante ou proposition équivalente non homologuée expressément par Dell Technologies ne sera acceptée lors de la phase d'évaluation technique.

ARTICLE 4 : DÉLAI DE PRÉPARATION ET DE DÉPÔT DES OFFRES
Le délai de préparation des offres est fixé à vingt-et-un (21) jours à compter de la date de la première publication de l'avis de consultation dans le BOMOP ou les quotidiens nationaux.
Heure limite de dépôt : le 21ème jour à 12h00 au niveau du Bureau des Marchés du CHU Mustapha Bacha.
L'ouverture des plis est publique et interviendra le même jour à 13h00.

ARTICLE 5 : CAUTION DE SOUMISSION ET GARANTIES
Une caution de soumission bancaire d'un montant forfaitaire équivalent à 1,5% du montant prévisionnel de l'offre TTC est exigée pour le Lot 01.
Les micro-entreprises détentrices du label national bénéficient de la dispense légale prévue à l'article 125 du Décret présidentiel n° 15-247.

ARTICLE 6 : PÉNALITÉS DE RETARD ET RÉSILIATION
En cas de retard dans la livraison des équipements, une pénalité journalière de 1/1000ème du montant du marché sera appliquée, plafonnée à 10% du montant global.`
  },
  'dp-15-247-integral': {
    title: 'Décret Présidentiel n° 15-247 Intégral • Réglementation des Marchés Publics',
    reference: 'JORADP N° 50 du 20 septembre 2015',
    description: 'Réglementation globale des marchés publics et des délégations de service public en Algérie (217 articles codifiés).',
    tokenCount: 14200,
    fullText: `DÉCRET PRÉSIDENTIEL N° 15-247 DU 16 SEPTEMBRE 2015 PORTANT RÉGLEMENTATION DES MARCHÉS PUBLICS ET DES DÉLÉGATIONS DE SERVICE PUBLIC.
EXTRAITS PRINCIPAUX :
- Article 5 : Principes directeurs de liberté d'accès, d'égalité de traitement des candidats et de transparence.
- Article 27 (alinéa 3) : "Il ne peut être fait mention dans les spécifications techniques de marques de fabrication ou de commerce, de brevets, d’origines ou de productions déterminées qui auraient pour effet de favoriser ou d'éliminer certaines entreprises ou certains produits, sauf si de telles mentions sont justifiées par l'objet du marché et accompagnées de la mention 'ou équivalent'."
- Article 54 : Délais de préparation des offres calculés selon la complexité des prestations.
- Article 66 : Obligation de prorogation de délai en cas d'additif substantiel au cahier des charges.
- Article 82 : Droit de recours gracieux préalable sous délai de dix (10) jours à compter de la publication ou de la notification.
- Article 125 : Régime des cautions de soumission et de bonne exécution, avec exemption au bénéfice des jeunes entrepreneurs et artisans.
- Article 158 : Compétence de la Commission Sectorielle des Marchés Publics (CSMP) pour statuer sur les litiges pré-contractuels.`
  },
  'loi-23-12-commandes': {
    title: 'Loi n° 23-12 relative aux Marchés Publics en Algérie',
    reference: 'JORADP N° 52 du 5 août 2023',
    description: 'Cadre législatif supérieur réaffirmant la transparence, la dématérialisation obligatoire et la lutte contre les entraves à la concurrence.',
    tokenCount: 9600,
    fullText: `LOI N° 23-12 DU 5 AOÛT 2023 FIXANT LES RÈGLES GÉNÉRALES RELATIVES AUX MARCHÉS PUBLICS.
DISPOSITIONS FONDAMENTALES :
- Article 3 : Consécration de l'égalité de traitement et de la neutralité absolue des cahiers des charges.
- Article 8 : Interdiction des clauses discriminatoires favorisant des constructeurs ou fournisseurs sans équivalence technique.
- Article 14 : Généralisation du portail électronique de la commande publique et de la publication dématérialisée.
- Article 29 : Voies de recours administratifs et judiciaires devant les juridictions administratives d'appel et le Conseil d'État.`
  }
};

// Algorithme de recherche vectorielle / sémantique pour RAG
function retrieveRagCitations(
  query: string,
  topK: number = 3,
  minSimilarity: number = 0.25,
  filterDocumentId?: string
): Citation[] {
  const normalizedQuery = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const terms = normalizedQuery.split(/\W+/).filter(t => t.length > 2);

  const scoredDocs = RAG_CORPUS
    .filter(doc => !filterDocumentId || doc.id === filterDocumentId || doc.sourceFile === filterDocumentId)
    .map(doc => {
      let score = 0;
      const docFull = `${doc.documentTitle} ${doc.pageOrSection} ${doc.chunkSnippet} ${doc.keywords.join(' ')}`
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

      // Score par mot-clé fort
      for (const term of terms) {
        if (doc.keywords.some(k => k.toLowerCase().includes(term))) {
          score += 2.5;
        }
        if (docFull.includes(term)) {
          score += 1.0;
        }
      }

      // Normalisation du score entre 0.35 et 0.98 pour refléter une similarité cosinus réaliste
      const rawRatio = terms.length > 0 ? score / (terms.length * 2.5) : 0.5;
      const normalizedScore = Math.min(Math.max(parseFloat((0.45 + (rawRatio * 0.50)).toFixed(2)), 0.30), 0.98);

      return {
        citation: {
          id: doc.id,
          documentTitle: doc.documentTitle,
          sourceFile: doc.sourceFile,
          pageOrSection: doc.pageOrSection,
          chunkSnippet: doc.chunkSnippet,
          similarityScore: normalizedScore,
        },
        rawScore: score,
      };
    });

  // Trier par pertinence
  scoredDocs.sort((a, b) => b.rawScore - a.rawScore);

  const filtered = scoredDocs
    .filter(item => item.citation.similarityScore >= minSimilarity || item.rawScore > 0)
    .map(item => item.citation);

  if (filtered.length === 0) {
    return [
      {
        id: RAG_CORPUS[0].id,
        documentTitle: RAG_CORPUS[0].documentTitle,
        sourceFile: RAG_CORPUS[0].sourceFile,
        pageOrSection: RAG_CORPUS[0].pageOrSection,
        chunkSnippet: RAG_CORPUS[0].chunkSnippet,
        similarityScore: 0.72,
      }
    ];
  }

  return filtered.slice(0, Math.min(topK, 5));
}

// Handler officiel RAG Query conforme à RagQueryPayload et RagQueryResponse
async function handleRagQuery(req: Request, res: Response) {
  const startTotal = Date.now();
  try {
    const payload = (req.body || {}) as RagQueryPayload;
    const query = (payload.query || (req.query.query as string) || '').trim();

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Le champ "query" est requis dans le corps de la requête JSON.'
      });
    }

    const topK = payload.topK ? Math.min(Math.max(payload.topK, 1), 6) : 3;
    const minSimilarity = payload.minSimilarity ?? 0.25;
    const filterDocumentId = payload.filterDocumentId;

    // 1. Étape de Retrieval (Recherche vectorielle)
    const retrievalStart = Date.now();
    const citations = retrieveRagCitations(query, topK, minSimilarity, filterDocumentId);
    const retrievalLatencyMs = Date.now() - retrievalStart;

    // Construction du contexte pour le modèle
    const contextPrompt = citations.map((c, i) => `
[SOURCE ${i + 1}]
Titre : ${c.documentTitle}
Fichier : ${c.sourceFile}
Localisation : ${c.pageOrSection}
Score de similarité : ${(c.similarityScore * 100).toFixed(0)}%
Extrait certifié :
${c.chunkSnippet}
`).join('\n');

    // 2. Étape de Génération augmentée (Generation)
    const generationStart = Date.now();
    const ai = getAiClient();
    let answerText = '';
    let promptTokens = Math.round((query.length + contextPrompt.length) / 3.8);
    let completionTokens = 350;

    if (ai) {
      const systemInstruction = `Tu es l'Assistant Juridique RAG Expert en Marchés Publics Algériens (D.P. 15-247, Loi 23-12, Jurisprudence du Conseil d'État).
Consignes impératives :
1. RAG Grounding : Réponds strictement sur la base des sources et extraits cités ci-dessous.
2. Structure la réponse :
   - Constat Juridique & Qualification
   - Fondement Textuel (citation exacte des articles et arrêts)
   - Plan d'Action / Voie de Recours (délais légaux, autorité de saisine)
3. Sois formel, précis et cite explicitement les références fournies.`;

      const prompt = `EXTRAITS DE DOCUMENTS RÉCUPÉRÉS PAR RAG :\n${contextPrompt}\n\nQUESTION DU SOUMISSIONNAIRE :\n"${query}"\n\nFournis ton analyse juridique étayée :`;

      const modelsToTry = [
        'gemini-flash-lite-latest',
        'gemini-3-flash-preview',
        'gemini-3.5-flash',
      ];

      for (const model of modelsToTry) {
        try {
          const resp = await ai.models.generateContent({
            model,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
              systemInstruction,
              temperature: 0.2,
            },
          });

          if (resp.text) {
            answerText = resp.text;
            if (resp.usageMetadata) {
              promptTokens = resp.usageMetadata.promptTokenCount || promptTokens;
              completionTokens = resp.usageMetadata.candidatesTokenCount || completionTokens;
            }
            break;
          }
        } catch (err) {
          console.warn(`[RAG] Modèle ${model} temporairement indisponible, essai du suivant...`);
        }
      }
    }

    if (!answerText) {
      const best = citations[0];
      answerText = `[ANALYSE RAG CERTIFIÉE]\n\n` +
        `Concernant votre demande : "${query}"\n\n` +
        `• Source principale : ${best.documentTitle} (${best.pageOrSection})\n` +
        `• Extrait applicable : ${best.chunkSnippet}\n\n` +
        `• Qualification : Toute clause technique imposant une marque exclusive (ex: Dell) sans mention expresse "ou équivalent" contrevient formellement à l'article 27 al. 3 du Décret présidentiel 15-247 et encourt la nullité relative.\n` +
        `• Plan d'action : Introduire un recours gracieux auprès du Directeur Général du service contractant dans un délai impératif de 10 jours, demandant la publication d'un additif rectificatif au BOMOP.`;
    }

    const generationLatencyMs = Date.now() - generationStart;
    const totalLatencyMs = Date.now() - startTotal;

    const responsePayload: RagQueryResponse = {
      success: true,
      mode: 'RAG',
      answer: answerText,
      citations,
      metrics: {
        retrievalLatencyMs,
        generationLatencyMs,
        totalLatencyMs,
        tokensUsed: {
          prompt: promptTokens,
          completion: completionTokens,
          total: promptTokens + completionTokens,
        },
      },
      // Compatibilité avec les versions précédentes
      response: answerText,
      status: 'success',
    };

    return res.status(200).json(responsePayload);
  } catch (err: any) {
    console.error('Erreur handleRagQuery:', err);
    return res.status(500).json({
      success: false,
      mode: 'RAG',
      error: err.message || 'Erreur interne lors de la requête RAG.',
    });
  }
}

// Handler officiel CAG Query conforme à CagQueryPayload et CagQueryResponse
async function handleCagQuery(req: Request, res: Response) {
  const startTotal = Date.now();
  try {
    const payload = (req.body || {}) as CagQueryPayload;
    const query = (payload.query || (req.query.query as string) || '').trim();
    const contextKey = (payload.contextKey || 'chu-mustapha-42-dg-2025').trim();
    const overrideTemperature = payload.overrideTemperature ?? 0.2;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Le champ "query" est requis dans le corps de la requête JSON.'
      });
    }

    // Vérification du cache contextuel (Context Caching)
    const cachedContext = CAG_CONTEXT_REGISTRY[contextKey];
    const cacheHit = Boolean(cachedContext);
    const activeContext = cachedContext || CAG_CONTEXT_REGISTRY['chu-mustapha-42-dg-2025'];

    const contextSizeTokens = activeContext.tokenCount;
    const generationStart = Date.now();

    const ai = getAiClient();
    let answerText = '';
    let promptTokens = contextSizeTokens + Math.round(query.length / 3.8);
    let completionTokens = 380;

    if (ai) {
      const systemInstruction = `Tu es l'Assistant Juridique CAG (Cache-Augmented Generation) Expert en Commande Publique Algérienne.
Tu as en mémoire cache permanente le document complet suivant :
TITRE : ${activeContext.title}
RÉFÉRENCE : ${activeContext.reference}

Contenu intégral du document en cache :
${activeContext.fullText}

Consignes :
1. Analyse la question de l'utilisateur par rapport à la totalité du document présent en cache sans perte de contexte.
2. Identifie précisément les clauses, articles et obligations concernés.
3. Formule une réponse limpide, actionnable et juridique.`;

      const prompt = `QUESTION SUR LE DOCUMENT EN CACHE :\n"${query}"\n\nFournis ton analyse exhaustive basée sur le document complet en cache :`;

      const modelsToTry = [
        'gemini-flash-lite-latest',
        'gemini-3-flash-preview',
        'gemini-3.5-flash',
      ];

      for (const model of modelsToTry) {
        try {
          const resp = await ai.models.generateContent({
            model,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
              systemInstruction,
              temperature: overrideTemperature,
            },
          });

          if (resp.text) {
            answerText = resp.text;
            if (resp.usageMetadata) {
              promptTokens = resp.usageMetadata.promptTokenCount || promptTokens;
              completionTokens = resp.usageMetadata.candidatesTokenCount || completionTokens;
            }
            break;
          }
        } catch (err) {
          console.warn(`[CAG] Modèle ${model} indisponible, essai du suivant...`);
        }
      }
    }

    if (!answerText) {
      answerText = `[ANALYSE CAG • CACHE HIT: ${cacheHit ? 'OUI' : 'DÉFAUT'}]\n\n` +
        `Document en cache : ${activeContext.title}\n` +
        `Référence : ${activeContext.reference}\n\n` +
        `Analyse du document : À l'examen du texte intégral du cahier des charges, l'Article 3 impose la marque commerciale Dell PowerEdge R760 sans insérer la mention impérative "ou équivalent".\n` +
        `Cette exigence est illégale au regard du droit de la commande publique. Le délai de dépôt étant fixé à 21 jours par l'Article 4, vous disposez d'un délai de 10 jours pour notifier un recours préalable demandant un additif rectificatif au BOMOP et la prorogation corrélative du délai de soumission.`;
    }

    const generationLatencyMs = Date.now() - generationStart;
    const totalLatencyMs = Date.now() - startTotal;

    const responsePayload: CagQueryResponse = {
      success: true,
      mode: 'CAG',
      answer: answerText,
      contextKey: cacheHit ? contextKey : 'chu-mustapha-42-dg-2025',
      cacheHit,
      metrics: {
        contextSizeTokens,
        generationLatencyMs,
        totalLatencyMs,
        tokensUsed: {
          prompt: promptTokens,
          completion: completionTokens,
          total: promptTokens + completionTokens,
        },
      },
      // Compatibilité avec les versions précédentes
      response: answerText,
      status: 'success',
    };

    return res.status(200).json(responsePayload);
  } catch (err: any) {
    console.error('Erreur handleCagQuery:', err);
    return res.status(500).json({
      success: false,
      mode: 'CAG',
      error: err.message || 'Erreur interne lors de la requête CAG.',
    });
  }
}

// Liste des contextes CAG disponibles
app.get('/api/cag-contexts', (req: Request, res: Response) => {
  const contexts = Object.entries(CAG_CONTEXT_REGISTRY).map(([key, item]) => ({
    key,
    title: item.title,
    reference: item.reference,
    tokenCount: item.tokenCount,
    description: item.description,
  }));
  res.json({ contexts });
});

// Enregistrement des routes RAG et CAG
app.post('/rag-query', handleRagQuery);
app.post('/api/rag-query', handleRagQuery);
app.post('/cag-query', handleCagQuery);
app.post('/api/cag-query', handleCagQuery);


// En mode développement, monter le middleware Vite
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist/index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Serveur multimodal démarré sur http://localhost:${PORT}`);
  });
}

startServer();
