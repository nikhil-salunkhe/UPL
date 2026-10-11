import { useEffect } from 'react';
import './PhotoPreview.css';

// Instagram-style full-screen circle photo preview, shared by the Players,
// Owners, Sponsors and Matches pages so every list gets the same behaviour:
// tap the thumbnail -> big circle photo, close via ✕, tapping the backdrop
// or pressing Escape; the page behind cannot scroll while it is open.
const PhotoPreview = ({ src, alt = '', onClose, onError }) => {
  useEffect(() => {
    if (!src) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [src, onClose]);

  if (!src) return null;

  return (
    <div
      className="photo-preview-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${alt || 'Photo'} preview`}
    >
      <div
        className="photo-preview-circle-wrap"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="photo-preview-close"
          onClick={onClose}
          aria-label="Close photo preview"
        >
          ✕
        </button>
        <img
          className="photo-preview-circle"
          src={src}
          alt={alt}
          onError={onError}
        />
      </div>
    </div>
  );
};

export default PhotoPreview;
