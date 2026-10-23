import { useId, useState } from 'react';
import CopyButton from './CopyButton';

// Shows a fresh set of one-time backup codes. They are never shown again, so Continue stays
// disabled until the person ticks that they've saved them.
function BackupCodes({ codes, onContinue, continueLabel = 'Continue' }) {
  const [saved, setSaved] = useState(false);
  const checkboxId = useId();
  const text = codes.join('\n');

  const handleDownload = () => {
    const file = new Blob([`Blood Bank backup codes\nEach code works once.\n\n${text}\n`], { type: 'text/plain' });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'blood-bank-backup-codes.txt';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <p className="auth-note">
        Use a backup code to log in or reset your password if you lose your phone.
      </p>
      <div className="alert alert-warning" role="note">
        Each code works once. Save them somewhere safe — you won't see them again.
      </div>

      <ul className="backup-codes" aria-label="Backup codes">
        {codes.map((code) => <li key={code}>{code}</li>)}
      </ul>

      <div className="backup-codes-actions">
        <CopyButton text={text} label="Copy all" />
        <button type="button" className="btn btn-sm" onClick={handleDownload}>Download .txt</button>
      </div>

      <div className="form-group">
        <label className="checkbox-label" htmlFor={checkboxId}>
          <input id={checkboxId} type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
          <span>I've saved my backup codes</span>
        </label>
      </div>

      <button type="button" className="btn btn-primary btn-submit admin-login-submit" disabled={!saved} onClick={onContinue}>
        {continueLabel}
      </button>
    </>
  );
}

export default BackupCodes;
