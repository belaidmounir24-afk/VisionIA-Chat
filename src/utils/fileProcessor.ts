import { AttachedFile, FileCategory, VideoFrame } from '../types';

export const MAX_FILES_PER_MESSAGE = 10;
export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 Mo
export const MAX_IMAGE_DIMENSION = 1600; // 1600 px max
export const VIDEO_FRAME_INTERVAL_SEC = 2; // Une image toutes les 2 secondes
export const MAX_VIDEO_FRAMES = 12; // Maximum 12 images par vidéo

const ALLOWED_IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];
const ALLOWED_VIDEO_EXTS = ['.mp4', '.mov', '.webm'];

const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_VIDEO_MIMES = ['video/mp4', 'video/quicktime', 'video/webm'];

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export function formatDuration(seconds: number): string {
  const rounded = Math.round(seconds);
  const mins = Math.floor(rounded / 60);
  const secs = rounded % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function getFileCategory(file: File): FileCategory | null {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();

  const isImage =
    ALLOWED_IMAGE_MIMES.includes(type) ||
    ALLOWED_IMAGE_EXTS.some((ext) => name.endsWith(ext));
  if (isImage) return 'image';

  const isVideo =
    ALLOWED_VIDEO_MIMES.includes(type) ||
    ALLOWED_VIDEO_EXTS.some((ext) => name.endsWith(ext));
  if (isVideo) return 'video';

  return null;
}

export function validateIncomingFiles(
  incomingFiles: File[],
  existingCount: number
): { validFiles: File[]; errors: string[] } {
  const validFiles: File[] = [];
  const errors: string[] = [];

  const availableSlots = MAX_FILES_PER_MESSAGE - existingCount;

  if (availableSlots <= 0) {
    errors.push(
      `Limite atteinte : vous avez déjà atteint le maximum de ${MAX_FILES_PER_MESSAGE} fichiers autorisés par message.`
    );
    return { validFiles, errors };
  }

  for (let i = 0; i < incomingFiles.length; i++) {
    const file = incomingFiles[i];

    if (validFiles.length >= availableSlots) {
      errors.push(
        `Seuls les ${availableSlots} premiers fichiers ont été ajoutés. La limite est de ${MAX_FILES_PER_MESSAGE} fichiers par message.`
      );
      break;
    }

    const category = getFileCategory(file);

    if (!category) {
      errors.push(
        `Le fichier « ${file.name} » a un format non pris en charge. Seules les images (JPG, PNG, WEBP) et vidéos (MP4, MOV, WEBM) sont acceptées.`
      );
      continue;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      errors.push(
        `Le fichier « ${file.name} » pèse ${formatFileSize(
          file.size
        )} (limite maximale : 20 Mo). Veuillez choisir un fichier plus léger ou le compresser.`
      );
      continue;
    }

    validFiles.push(file);
  }

  return { validFiles, errors };
}

/**
 * Réduit une image à 1600 px maximum de côté tout en conservant le ratio d'aspect.
 */
export async function resizeImageToMax1600(
  file: File
): Promise<{ dataUrl: string; width: number; height: number; previewUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        // Calcul du redimensionnement à 1600px max
        if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
          if (width > height) {
            height = Math.round((height * MAX_IMAGE_DIMENSION) / width);
            width = MAX_IMAGE_DIMENSION;
          } else {
            width = Math.round((width * MAX_IMAGE_DIMENSION) / height);
            height = MAX_IMAGE_DIMENSION;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error("Impossible d'initialiser le contexte de dessin 2D."));
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Sortie JPEG à qualité optimale ou WebP si supporté
        const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const dataUrl = canvas.toDataURL(mimeType, 0.88);

        resolve({
          dataUrl,
          width,
          height,
          previewUrl: dataUrl,
        });
      };

      img.onerror = () => {
        reject(new Error(`Impossible de lire l'image « ${file.name} ». Le fichier est peut-être corrompu.`));
      };

      if (e.target?.result) {
        img.src = e.target.result as string;
      } else {
        reject(new Error("Échec de la lecture du fichier."));
      }
    };

    reader.onerror = () => {
      reject(new Error(`Erreur lors de la lecture du fichier « ${file.name} ».`));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Extrait une image toutes les 2 secondes (max 12 images) d'une vidéo côté client avec canvas.
 */
export async function extractVideoFrames(
  file: File,
  onProgress?: (percent: number) => void
): Promise<{
  duration: number;
  previewUrl: string;
  frames: VideoFrame[];
}> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
    };

    video.onerror = () => {
      cleanup();
      reject(
        new Error(
          `Impossible de décoder la vidéo « ${file.name} ». Vérifiez qu'il s'agit bien d'un fichier MP4, MOV ou WEBM lisible.`
        )
      );
    };

    video.onloadedmetadata = async () => {
      try {
        const duration = video.duration || 0;
        if (!duration || isNaN(duration)) {
          cleanup();
          return reject(
            new Error("La durée de la vidéo n'a pas pu être déterminée.")
          );
        }

        // Calcul des horodatages à capturer : 0s, 2s, 4s, etc. jusqu'à max 12 images
        const timestamps: number[] = [];
        for (
          let t = 0;
          t <= duration && timestamps.length < MAX_VIDEO_FRAMES;
          t += VIDEO_FRAME_INTERVAL_SEC
        ) {
          timestamps.push(t);
        }

        // Si la vidéo est très courte (moins de 2s) et qu'on a juste [0] ou rien
        if (timestamps.length === 0) {
          timestamps.push(0);
        }

        const frames: VideoFrame[] = [];
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          cleanup();
          return reject(new Error("Impossible de créer le contexte canvas."));
        }

        // Dimensionnement des trames (max 800px pour des trames vidéo nettes et légères pour l'IA)
        let vWidth = video.videoWidth || 640;
        let vHeight = video.videoHeight || 360;
        const maxVDim = 800;
        if (vWidth > maxVDim || vHeight > maxVDim) {
          if (vWidth > vHeight) {
            vHeight = Math.round((vHeight * maxVDim) / vWidth);
            vWidth = maxVDim;
          } else {
            vWidth = Math.round((vWidth * maxVDim) / vHeight);
            vHeight = maxVDim;
          }
        }

        canvas.width = vWidth;
        canvas.height = vHeight;

        for (let i = 0; i < timestamps.length; i++) {
          const targetTime = timestamps[i];

          // Chercher le moment précis
          await seekVideo(video, targetTime);

          ctx.drawImage(video, 0, 0, vWidth, vHeight);
          const frameDataUrl = canvas.toDataURL('image/jpeg', 0.75);

          frames.push({
            timestamp: targetTime,
            dataUrl: frameDataUrl,
            mimeType: 'image/jpeg',
          });

          if (onProgress) {
            const pct = Math.round(((i + 1) / timestamps.length) * 100);
            onProgress(pct);
          }
        }

        cleanup();

        const previewUrl = frames[0]?.dataUrl || '';
        resolve({
          duration,
          previewUrl,
          frames,
        });
      } catch (err) {
        cleanup();
        reject(err);
      }
    };
  });
}

function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      // Petite temporisation pour que le décodeur soit stable
      setTimeout(resolve, 30);
    };
    video.addEventListener('seeked', onSeeked);
    video.currentTime = Math.min(time, Math.max(0, video.duration - 0.1));
  });
}

/**
 * Traite un ensemble de fichiers et génère les objets AttachedFile complets
 */
export async function processAttachedFiles(
  files: File[],
  onOverallProgress?: (current: number, total: number, fileName: string) => void
): Promise<AttachedFile[]> {
  const processed: AttachedFile[] = [];

  for (let idx = 0; idx < files.length; idx++) {
    const file = files[idx];
    const category = getFileCategory(file) || 'image';
    const id = `file_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    if (onOverallProgress) {
      onOverallProgress(idx + 1, files.length, file.name);
    }

    if (category === 'image') {
      try {
        const { dataUrl, previewUrl } = await resizeImageToMax1600(file);
        processed.push({
          id,
          file,
          name: file.name,
          size: file.size,
          type: 'image',
          mimeType: file.type || 'image/jpeg',
          previewUrl,
          dataUrl,
          isProcessing: false,
        });
      } catch (err: unknown) {
        processed.push({
          id,
          file,
          name: file.name,
          size: file.size,
          type: 'image',
          mimeType: file.type,
          previewUrl: '',
          isProcessing: false,
          error: err instanceof Error ? err.message : "Erreur de traitement d'image",
        });
      }
    } else {
      try {
        const { duration, previewUrl, frames } = await extractVideoFrames(file);
        processed.push({
          id,
          file,
          name: file.name,
          size: file.size,
          type: 'video',
          mimeType: file.type || 'video/mp4',
          previewUrl,
          duration,
          frames,
          isProcessing: false,
        });
      } catch (err: unknown) {
        processed.push({
          id,
          file,
          name: file.name,
          size: file.size,
          type: 'video',
          mimeType: file.type,
          previewUrl: '',
          isProcessing: false,
          error: err instanceof Error ? err.message : 'Erreur de traitement vidéo',
        });
      }
    }
  }

  return processed;
}
