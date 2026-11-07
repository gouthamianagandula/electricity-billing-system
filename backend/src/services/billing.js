// tariffs: [{slab_from, slab_to, rate_per_unit}] ordered by slab_from
function calculateBill(units, tariffs, fixedCharge) {
  let energy = 0;
  for (const t of tariffs) {
    const lower = t.slab_from === 0 ? 0 : t.slab_from - 1;
    const upper = t.slab_to === null ? Infinity : t.slab_to;
    const inSlab = Math.max(0, Math.min(units, upper) - lower);
    energy += inSlab * Number(t.rate_per_unit);
  }
  energy = Math.round(energy * 100) / 100;
  const fixed = Number(fixedCharge);
  return { energy, fixed, total: Math.round((energy + fixed) * 100) / 100 };
}

module.exports = { calculateBill };