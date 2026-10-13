import { X } from '@phosphor-icons/react';
import { useEffect } from 'react';

function ConfirmModal({
  isOpen,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'danger',
  onConfirm,
  onClose,
  loading = false
}) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !loading) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose, loading]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={loading ? undefined : onClose}>
      <div
        className="modal confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 id="confirm-modal-title">{title}</h3>
          {!loading && (
            <button
              type="button"
              className="modal-close"
              onClick={onClose}
              aria-label="Close modal"
            >
              <X size={16} />
            </button>
          )}
        </div>
        <div className="modal-body">
          <p>{message}</p>
        </div>
        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={loading}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`btn btn-${confirmVariant === 'danger' ? 'danger-fill' : 'primary'}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Working…' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;
