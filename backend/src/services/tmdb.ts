export type TmdbLookupMovie = {
  movieNm: string
  movieNmEn: string | null
  openDt: Date | null
}

export type TmdbMetadata = {
  tmdbId: number
  overview: string | null
  posterPath: string | null
}

type TmdbCandidate = {
  id: number
  title: string | null
  original_title: string | null
  release_date: string | null
  overview?: string | null
  poster_path?: string | null
}

type TmdbSearchResponse = {
  results?: TmdbCandidate[]
  success?: boolean
  status_message?: string
}

function normalizeTitle(title: string | null | undefined): string {
  return title?.trim().toLowerCase() ?? ''
}

function matchesTitle(candidate: TmdbCandidate, movie: TmdbLookupMovie): number {
  const koreanTitle = normalizeTitle(movie.movieNm)
  const englishTitle = normalizeTitle(movie.movieNmEn)
  const candidateTitle = normalizeTitle(candidate.title)
  const originalTitle = normalizeTitle(candidate.original_title)

  return Number(candidateTitle === koreanTitle)
    + Number(englishTitle !== '' && originalTitle === englishTitle)
}

function matchesReleaseYear(candidate: TmdbCandidate, movie: TmdbLookupMovie): boolean {
  return movie.openDt != null
    && candidate.release_date?.slice(0, 4) === String(movie.openDt.getUTCFullYear())
}

export function selectTmdbCandidate(
  candidates: TmdbCandidate[],
  movie: TmdbLookupMovie,
): TmdbCandidate | null {
  const rankedCandidates = candidates
    .map(candidate => {
      const titleScore = matchesTitle(candidate, movie)
      return {
        candidate,
        titleScore,
        score: titleScore * 2 + Number(matchesReleaseYear(candidate, movie)),
      }
    })
    .filter(({ titleScore }) => titleScore > 0)

  const bestScore = Math.max(...rankedCandidates.map(({ score }) => score))
  if (!Number.isFinite(bestScore)) return null

  const bestCandidates = rankedCandidates.filter(({ score }) => score === bestScore)
  return bestCandidates.length === 1 ? bestCandidates[0].candidate : null
}

export async function findTmdbMovie(movie: TmdbLookupMovie): Promise<TmdbMetadata | null> {
  const apiKey = process.env.TMDB_API_KEY
  if (!apiKey) throw new Error('TMDB_API_KEY is not configured')

  const query = movie.movieNm.trim()
  const searchParams = new URLSearchParams({
    api_key: apiKey,
    query,
    language: 'ko-KR',
    include_adult: 'false',
  })
  if (movie.openDt) searchParams.set('year', String(movie.openDt.getUTCFullYear()))

  const response = await fetch(`https://api.themoviedb.org/3/search/movie?${searchParams}`)
  if (!response.ok) throw new Error(`TMDB search failed: ${response.status}`)

  const payload = await response.json() as TmdbSearchResponse
  if (payload.success === false || !Array.isArray(payload.results)) {
    throw new Error(`TMDB search failed: ${payload.status_message ?? 'invalid response'}`)
  }

  const candidate = selectTmdbCandidate(payload.results, movie)
  if (!candidate) return null

  return {
    tmdbId: candidate.id,
    overview: candidate.overview ?? null,
    posterPath: candidate.poster_path ?? null,
  }
}
