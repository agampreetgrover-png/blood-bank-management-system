// Label shown for a blood group's stock level
function stockStatus(units) {
  if (units === 0) return 'Critical';
  if (units <= 2) return 'Low Stock';
  return 'Available';
}

module.exports = { stockStatus };
