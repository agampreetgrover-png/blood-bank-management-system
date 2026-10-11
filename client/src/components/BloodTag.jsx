// One blood group's stock: group and units, no colour coding.
function BloodTag({ group, units, selected, onClick }) {
  const className = `bt${selected ? ' bt-selected' : ''}`;

  const body = (
    <>
      <span className="bt-group">{group}</span>
      <span className="bt-units">
        {units === 0 ? 'None' : units}
      </span>
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick} aria-pressed={!!selected}>
        {body}
      </button>
    );
  }
  return <div className={className}>{body}</div>;
}

export default BloodTag;
