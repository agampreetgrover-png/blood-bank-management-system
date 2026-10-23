import { useEffect, useState } from 'react';

// Copies text to the clipboard and says so on the button for a couple of seconds
function CopyButton({ text, label = 'Copy', className = 'btn btn-sm' }) {
  const [status, setStatus] = useState(''); // '', 'copied' or 'failed'

  useEffect(() => {
    if (!status) return undefined;
    const timer = setTimeout(() => setStatus(''), 2000);
    return () => clearTimeout(timer);
  }, [status]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus('copied');
    } catch {
      setStatus('failed');
    }
  };

  return (
    <button type="button" className={className} onClick={handleCopy}>
      <span aria-live="polite">
        {status === 'copied' ? 'Copied' : status === 'failed' ? 'Copy failed - select it instead' : label}
      </span>
    </button>
  );
}

export default CopyButton;
