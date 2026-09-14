/** OG-style medals awarded at score milestones */
export function getMedal(score) {
  if (score >= 40) return { id: 'platinum', label: 'PLATINUM', color: '#e8f4ff' };
  if (score >= 30) return { id: 'gold', label: 'GOLD', color: '#f7dc16' };
  if (score >= 20) return { id: 'silver', label: 'SILVER', color: '#d0d0d0' };
  if (score >= 10) return { id: 'bronze', label: 'BRONZE', color: '#cd7f32' };
  return null;
}
