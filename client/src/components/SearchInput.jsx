import { MagnifyingGlass, X } from '@phosphor-icons/react';

function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  maxWidth = 280,
  onClear,
  className = ''
}) {
  const handleClear = () => {
    if (onClear) {
      onClear();
    } else if (onChange) {
      onChange({ target: { value: '' } });
    }
  };

  return (
    <div className={`search-box-wrapper ${className}`} style={{ maxWidth }}>
      <span className="search-icon" aria-hidden="true">
        <MagnifyingGlass size={15} />
      </span>
      <input
        type="text"
        className="form-control search-input"
        placeholder={placeholder}
        aria-label={placeholder}
        value={value}
        onChange={onChange}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && value) {
            handleClear();
          }
        }}
      />
      {value ? (
        <button
          type="button"
          className="search-clear-btn"
          onClick={handleClear}
          aria-label="Clear search"
          title="Clear search"
        >
          <X size={13} />
        </button>
      ) : null}
    </div>
  );
}

export default SearchInput;
