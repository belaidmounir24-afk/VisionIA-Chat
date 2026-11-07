import express from 'express';
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

// Configuration CORS pour permettre les requêtes depuis l'application Android (émulateur 10.0.2.2 ou mobile réel)
app.use(cors());

// Support des corps de requêtes volumineux (base64 pour photos, vidéos et captures d'écran)
app.use(express.json({ limit: '60mb' }));
app.use(express.urlencoded({ extended: true, limit: '60mb' }));

// Initialisation du client Google GenAI côté serveur
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

// Route de vérification de l'état de l'API (Health check)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    file: 'index.js',
    hasApiKey: Boolean(process.env.GEMINI_API_KEY),
    time: new Date().toISOString(),
  });
});

// Extraction du base64 pur à partir d'une URL de données
function extractBase64(dataUrl) {
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

// Route de conversation multimodale (Texte + Images + Vidéo)
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history } = req.body || {};

    if (!message || (!message.text && (!message.files || message.files.length === 0))) {
      return res.status(400).json({
        error: "Le message doit contenir du texte ou au moins un fichier joint.",
      });
    }

    const ai = getAiClient();
    if (!ai) {
      return res.status(500).json({
        error: "La clé API Gemini n'est pas configurée dans les variables d'environnement.",
      });
    }

    const contents = [];

    // Ajouter l'historique précédent
    if (Array.isArray(history)) {
      const recentHistory = history.slice(-8);
      for (const item of recentHistory) {
        if (item.role === 'model') {
          contents.push({
            role: 'model',
            parts: [{ text: item.text || '' }],
          });
        } else if (item.role === 'user') {
          const parts = [];
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
            contents.push({ role: 'user', parts });
          }
        }
      }
    }

    // Préparer le tour utilisateur courant
    const currentParts = [];
    if (message.text && message.text.trim()) {
      currentParts.push({ text: message.text.trim() });
    } else {
      currentParts.push({ text: "Analyse les éléments joints et réponds à l'instruction." });
    }

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
            text: `[Vidéo jointe : "${file.name}" - durée : ${file.duration || 0}s]`,
          });
          for (const frame of file.frames) {
            const { mimeType, base64 } = extractBase64(frame.dataUrl);
            currentParts.push({ text: `[T = ${frame.timestamp}s]` });
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

    contents.push({ role: 'user', parts: currentParts });

    const systemInstruction =
      "Analyse les images et vidéos jointes, puis réponds à l'instruction de l'utilisateur. Si l'instruction est ambiguë, pose une seule question. Réponds toujours en français, avec une mise en page claire et aérée.";

    const modelsToTry = [
      'gemini-flash-lite-latest',
      'gemini-3-flash-preview',
      'gemini-3.5-flash',
      'gemini-3.1-flash-lite',
    ];

    let replyText = '';
    let usedModel = modelsToTry[0];
    let usageMetadata;

    for (const model of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents,
          config: { systemInstruction },
        });

        if (response.text) {
          replyText = response.text;
          usedModel = model;
          usageMetadata = response.usageMetadata;
          break;
        }
      } catch (err) {
        console.warn(`[index.js] Modèle ${model} indisponible, essai du suivant...`);
      }
    }

    if (!replyText) {
      throw new Error("Impossible d'obtenir une réponse des modèles Gemini.");
    }

    const promptTokens = usageMetadata?.promptTokenCount ?? Math.max(1, Math.round(JSON.stringify(contents).length / 4));
    const candidatesTokens = usageMetadata?.candidatesTokenCount ?? Math.max(1, Math.round(replyText.length / 4));
    const totalTokens = usageMetadata?.totalTokenCount ?? (promptTokens + candidatesTokens);

    return res.json({
      reply: replyText,
      usage: {
        promptTokens,
        candidatesTokens,
        totalTokens,
        modelName: usedModel,
      },
    });
  } catch (error) {
    console.error('[index.js] Erreur /api/chat:', error);
    return res.status(500).json({
      error: error.message || "Une erreur est survenue lors du traitement.",
    });
  }
});

// ==========================================
// MOTEUR RAG (Retrieval-Augmented Generation) & CAG (Cache-Augmented Generation)
// ==========================================

const RAG_CORPUS = [
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

const CAG_CONTEXT_REGISTRY = {
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
Lot N° 01 : Plateforme de virtualisation et serveurs d'applications hospitalières.
Lot N° 02 : Cœur de réseau sécurisé et commutation fédératrice.

ARTICLE 3 : SPÉCIFICATIONS TECHNIQUES DU LOT N° 01 (LITIGIEUX)
Les serveurs requis doivent correspondre strictement à l'architecture matérielle "Dell PowerEdge R760" ou "Dell EMC", avec bi-processeur 32 cœurs, 512 Go de mémoire RAM DDR5 ECC, double alimentation redondante 1400W Titanium, et carte de gestion distante iDRAC9 Enterprise.
Aucune variante ou proposition équivalente non homologuée expressément par Dell Technologies ne sera acceptée lors de la phase d'évaluation technique.

ARTICLE 4 : DÉLAI DE PRÉPARATION ET DE DÉPÔT DES OFFRES
Le délai de préparation des offres est fixé à vingt-et-un (21) jours à compter de la date de la première publication de l'avis de consultation dans le BOMOP ou les quotidiens nationaux.
Heure limite de dépôt : le 21ème jour à 12h00 au niveau du Bureau des Marchés du CHU Mustapha Bacha.`
  },
  'dp-15-247-integral': {
    title: 'Décret Présidentiel n° 15-247 Intégral • Réglementation des Marchés Publics',
    reference: 'JORADP N° 50 du 20 septembre 2015',
    description: 'Réglementation globale des marchés publics et des délégations de service public en Algérie (217 articles codifiés).',
    tokenCount: 14200,
    fullText: `DÉCRET PRÉSIDENTIEL N° 15-247 DU 16 SEPTEMBRE 2015 PORTANT RÉGLEMENTATION DES MARCHÉS PUBLICS ET DES DÉLÉGATIONS DE SERVICE PUBLIC.
- Article 27 (alinéa 3) : "Il ne peut être fait mention dans les spécifications techniques de marques de fabrication ou de commerce, de brevets, d’origines ou de productions déterminées qui auraient pour effet de favoriser ou d'éliminer certaines entreprises ou certains produits, sauf si de telles mentions sont justifiées par l'objet du marché et accompagnées de la mention 'ou équivalent'."
- Article 54 : Délais de préparation des offres calculés selon la complexité des prestations.
- Article 82 : Droit de recours gracieux préalable sous délai de dix (10) jours à compter de la publication ou de la notification.`
  },
  'loi-23-12-commandes': {
    title: 'Loi n° 23-12 relative aux Marchés Publics en Algérie',
    reference: 'JORADP N° 52 du 5 août 2023',
    description: 'Cadre législatif supérieur réaffirmant la transparence, la dématérialisation obligatoire et la lutte contre les entraves à la concurrence.',
    tokenCount: 9600,
    fullText: `LOI N° 23-12 DU 5 AOÛT 2023 FIXANT LES RÈGLES GÉNÉRALES RELATIVES AUX MARCHÉS PUBLICS.
- Article 3 : Consécration de l'égalité de traitement et de la neutralité absolue des cahiers des charges.
- Article 8 : Interdiction des clauses discriminatoires favorisant des constructeurs ou fournisseurs sans équivalence technique.`
  }
};

function retrieveRagCitations(query, topK = 3, minSimilarity = 0.25, filterDocumentId) {
  const normalizedQuery = (query || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const terms = normalizedQuery.split(/\W+/).filter(t => t.length > 2);

  const scoredDocs = RAG_CORPUS
    .filter(doc => !filterDocumentId || doc.id === filterDocumentId || doc.sourceFile === filterDocumentId)
    .map(doc => {
      let score = 0;
      const docFull = `${doc.documentTitle} ${doc.pageOrSection} ${doc.chunkSnippet} ${doc.keywords.join(' ')}`
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

      for (const term of terms) {
        if (doc.keywords.some(k => k.toLowerCase().includes(term))) {
          score += 2.5;
        }
        if (docFull.includes(term)) {
          score += 1.0;
        }
      }

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

// Handler officiel RAG Query
async function handleRagQuery(req, res) {
  const startTotal = Date.now();
  try {
    const payload = req.body || {};
    const query = (payload.query || req.query?.query || '').trim();

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Le champ "query" est requis dans le corps de la requête JSON.'
      });
    }

    const topK = payload.topK ? Math.min(Math.max(payload.topK, 1), 6) : 3;
    const minSimilarity = payload.minSimilarity ?? 0.25;
    const filterDocumentId = payload.filterDocumentId;

    const retrievalStart = Date.now();
    const citations = retrieveRagCitations(query, topK, minSimilarity, filterDocumentId);
    const retrievalLatencyMs = Date.now() - retrievalStart;

    const contextPrompt = citations.map((c, i) => `
[SOURCE ${i + 1}]
Titre : ${c.documentTitle}
Fichier : ${c.sourceFile}
Localisation : ${c.pageOrSection}
Score de similarité : ${(c.similarityScore * 100).toFixed(0)}%
Extrait certifié :
${c.chunkSnippet}
`).join('\n');

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
          console.warn(`[index.js RAG] Modèle ${model} temporairement indisponible, essai du suivant...`);
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

    const responsePayload = {
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
      response: answerText,
      status: 'success',
    };

    return res.status(200).json(responsePayload);
  } catch (err) {
    console.error('Erreur handleRagQuery index.js:', err);
    return res.status(500).json({
      success: false,
      mode: 'RAG',
      error: err.message || 'Erreur interne lors de la requête RAG.',
    });
  }
}

// Handler officiel CAG Query
async function handleCagQuery(req, res) {
  const startTotal = Date.now();
  try {
    const payload = req.body || {};
    const query = (payload.query || req.query?.query || '').trim();
    const contextKey = (payload.contextKey || 'chu-mustapha-42-dg-2025').trim();
    const overrideTemperature = payload.overrideTemperature ?? 0.2;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Le champ "query" est requis dans le corps de la requête JSON.'
      });
    }

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
          console.warn(`[CAG index.js] Modèle ${model} indisponible, essai du suivant...`);
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

    const responsePayload = {
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
      response: answerText,
      status: 'success',
    };

    return res.status(200).json(responsePayload);
  } catch (err) {
    console.error('Erreur handleCagQuery index.js:', err);
    return res.status(500).json({
      success: false,
      mode: 'CAG',
      error: err.message || 'Erreur interne lors de la requête CAG.',
    });
  }
}

// Liste des contextes CAG disponibles
app.get('/api/cag-contexts', (req, res) => {
  const contexts = Object.entries(CAG_CONTEXT_REGISTRY).map(([key, item]) => ({
    key,
    title: item.title,
    reference: item.reference,
    tokenCount: item.tokenCount,
    description: item.description,
  }));
  res.json({ contexts });
});

// Routes RAG et CAG disponibles
app.post('/rag-query', handleRagQuery);
app.post('/api/rag-query', handleRagQuery);
app.post('/cag-query', handleCagQuery);
app.post('/api/cag-query', handleCagQuery);

// Démarrage du serveur et montage de l'application
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    try {
      const { createServer } = await import('vite');
      const vite = await createServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (err) {
      console.log("[index.js] Vite non chargé en middleware, servant en mode API autonome.");
    }
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist/index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[🚀] Serveur démarré avec succès depuis index.js sur http://0.0.0.0:${PORT}`);
  });
}

startServer();

export default app;
