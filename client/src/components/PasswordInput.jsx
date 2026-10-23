import { useState } from 'react';
import { Eye, EyeSlash } from '@phosphor-icons/react';

// Password box with an eye button that shows or hides what was typed. Takes the same props as <input>.
function PasswordInput({ className = 'form-control', ...props }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="password-field">
      <input {...props} type={visible ? 'text' : 'password'} className={`${className} password-input`} />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setVisible(!visible)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        title={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <EyeSlash size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

export default PasswordInput;
