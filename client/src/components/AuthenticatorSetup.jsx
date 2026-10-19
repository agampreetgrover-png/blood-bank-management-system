import CodeStep from './CodeStep';
import CopyButton from './CopyButton';

// Links an authenticator app: scan the QR (or type the key), then enter the first code to prove it works.
//   setup           - { secret, qr } from the server; qr is a data: image URL
//   onVerify(code)  - async; should throw on failure
//   onBack()        - optional; go back to the previous step (backLabel names it)
function AuthenticatorSetup({ setup, onVerify, submitLabel = 'Verify', onBack, backLabel = 'Back' }) {
  // "JBSWY3DPEHPK3PXP" -> "JBSW Y3DP EHPK 3PXP", easier to type by hand
  const groupedKey = setup.secret.match(/.{1,4}/g)?.join(' ') || setup.secret;

  return (
    <>
      <ol className="auth-steps">
        <li>Install <strong>Google Authenticator</strong> or <strong>Microsoft Authenticator</strong> on your phone.</li>
        <li>In the app, tap <strong>+</strong> and scan this QR code.</li>
        <li>Enter the 6-digit code the app shows.</li>
      </ol>

      <div className="qr-box">
        <img src={setup.qr} alt="QR code to add your Blood Bank account to an authenticator app" width="180" height="180" />
      </div>

      <div className="setup-key">
        <span className="setup-key-label">Can't scan? Enter this key</span>
        <div className="setup-key-row">
          <code>{groupedKey}</code>
          <CopyButton text={setup.secret} />
        </div>
      </div>

      <CodeStep intro={null} allowBackup={false} submitLabel={submitLabel} onVerify={onVerify} />

      {onBack && (
        <div className="auth-actions">
          <button type="button" className="link-button" onClick={onBack}>{backLabel}</button>
        </div>
      )}
    </>
  );
}

export default AuthenticatorSetup;
