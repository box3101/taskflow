export function isAdultGenre(genre?: string | null): boolean {
  if (!genre) return false
  const normalized = genre.replace(/\s/g, '').toLowerCase()
  return normalized.includes('성인물') || normalized.includes('에로')
}

export function isLikelyRerelease(openDt: Date | null, productionYear: number | null): boolean {
  return !!openDt && productionYear != null
    && openDt.getUTCFullYear() - productionYear >= 2
}
