import React, { useEffect } from 'react';
import { X, ZoomIn, Download } from 'lucide-react';

interface MediaLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  title: string;
  subtitle?: string;
}

export const MediaLightbox: React.FC<MediaLightboxProps> = ({
  isOpen,
  onClose,
  imageUrl,
  title,
  subtitle,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
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

  if (!isOpen || !imageUrl) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Aperçu du média"
    >
      <div
        className="relative max-w-4xl max-h-[90vh] flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Barre d'en-tête du modal */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-950/80 border-b border-slate-800 text-white">
          <div className="min-w-0 pr-4">
            <h3 className="font-semibold text-sm truncate">{title}</h3>
            {subtitle && <p className="text-xs text-slate-400 truncate">{subtitle}</p>}
          </div>

          <div className="flex items-center gap-2">
            <a
              href={imageUrl}
              download={title || 'media'}
              target="_blank"
              rel="noreferrer"
              className="w-11 h-11 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              title="Télécharger l'image"
              aria-label="Télécharger l'image"
            >
              <Download className="w-5 h-5" />
            </a>
            <button
              type="button"
              onClick={onClose}
              className="w-11 h-11 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              title="Fermer (Échap)"
              aria-label="Fermer l'aperçu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Contenu image */}
        <div className="relative flex-1 overflow-auto flex items-center justify-center p-2 bg-black/50">
          <img
            src={imageUrl}
            alt={title}
            className="max-h-[75vh] max-w-full object-contain rounded-lg shadow-md"
          />
        </div>
      </div>
    </div>
  );
};
