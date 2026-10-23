// One blood group's stock: group and units, no colour coding.
function BloodTag({ group, units }) {
  return (
    <div className="bt">
      <span className="bt-group">{group}</span>
      <span className="bt-units">
        {units === 0 ? 'None' : units}
      </span>
    </div>
  );
}

export default BloodTag;
