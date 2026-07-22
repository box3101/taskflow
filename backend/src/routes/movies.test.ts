import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../prisma', () => ({
  default: {
    movie: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    movieBookmark: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}))

vi.mock('../services/tmdb', () => ({
  findTmdbMovie: vi.fn(),
}))

import prisma from '../prisma'
import { findTmdbMovie } from '../services/tmdb'
import { signToken } from '../middleware/auth'
import movieRouter from './movies'

const prismaMock = prisma as unknown as {
  movie: {
    findMany: ReturnType<typeof vi.fn>
    findUnique: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
  movieBookmark: {
    findMany: ReturnType<typeof vi.fn>
    upsert: ReturnType<typeof vi.fn>
    deleteMany: ReturnType<typeof vi.fn>
  }
}
const findTmdbMovieMock = findTmdbMovie as unknown as ReturnType<typeof vi.fn>

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use('/movies', movieRouter)
  return app
}

const token = signToken({ id: 1, email: 'user@test.com', role: 'member' })
const authHeader = { Authorization: `Bearer ${token}` }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /movies/bookmarks', () => {
  it('내 북마크 영화 전체 정보를 반환한다', async () => {
    prismaMock.movieBookmark.findMany.mockResolvedValue([
      { movieCd: 'A1', movie: { movieCd: 'A1', movieNm: '영화1', genreNm: '드라마' } },
      { movieCd: 'A2', movie: { movieCd: 'A2', movieNm: '영화2', genreNm: null } },
    ])

    const res = await request(buildApp()).get('/movies/bookmarks').set(authHeader)

    expect(res.status).toBe(200)
    expect(res.body.data.map((m: { movieCd: string }) => m.movieCd)).toEqual(['A1', 'A2'])
    expect(prismaMock.movieBookmark.findMany).toHaveBeenCalledWith({
      where: { userId: 1 },
      include: { movie: true },
      orderBy: { movie: { openDt: 'asc' } },
    })
  })

  it('성인 장르 영화는 제외한다', async () => {
    prismaMock.movieBookmark.findMany.mockResolvedValue([
      { movieCd: 'A1', movie: { movieCd: 'A1', movieNm: '영화1', genreNm: '성인물(에로)' } },
    ])

    const res = await request(buildApp()).get('/movies/bookmarks').set(authHeader)

    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])
  })
})

describe('POST /movies/:movieCd/bookmark', () => {
  it('영화가 있으면 userId_movieCd 기준으로 upsert한다', async () => {
    prismaMock.movie.findUnique.mockResolvedValue({ movieCd: 'A1' })
    prismaMock.movieBookmark.upsert.mockResolvedValue({})

    const res = await request(buildApp()).post('/movies/A1/bookmark').set(authHeader)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ data: { movieCd: 'A1' } })
    expect(prismaMock.movieBookmark.upsert).toHaveBeenCalledWith({
      where: { userId_movieCd: { userId: 1, movieCd: 'A1' } },
      create: { userId: 1, movieCd: 'A1' },
      update: {},
    })
  })

  it('영화가 없으면 404를 반환하고 upsert하지 않는다', async () => {
    prismaMock.movie.findUnique.mockResolvedValue(null)

    const res = await request(buildApp()).post('/movies/NOPE/bookmark').set(authHeader)

    expect(res.status).toBe(404)
    expect(prismaMock.movieBookmark.upsert).not.toHaveBeenCalled()
  })
})

describe('DELETE /movies/:movieCd/bookmark', () => {
  it('userId, movieCd 기준으로 deleteMany한다', async () => {
    prismaMock.movieBookmark.deleteMany.mockResolvedValue({ count: 1 })

    const res = await request(buildApp()).delete('/movies/A1/bookmark').set(authHeader)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ data: { movieCd: 'A1' } })
    expect(prismaMock.movieBookmark.deleteMany).toHaveBeenCalledWith({
      where: { userId: 1, movieCd: 'A1' },
    })
  })

  it('북마크가 없어도 성공한다', async () => {
    prismaMock.movieBookmark.deleteMany.mockResolvedValue({ count: 0 })

    const res = await request(buildApp()).delete('/movies/A1/bookmark').set(authHeader)

    expect(res.status).toBe(200)
  })
})

describe('GET /movies/:movieCd', () => {
  const baseMovie = {
    movieCd: 'A1',
    movieNm: '영화',
    movieNmEn: 'Movie',
    openDt: new Date('2026-07-01T00:00:00Z'),
    tmdbCheckedAt: null,
    tmdbId: null,
    overview: null,
    posterPath: null,
  }

  it('tmdbCheckedAt이 null이고 API 키가 있으면 TMDB를 호출해 저장한다', async () => {
    vi.stubEnv('TMDB_API_KEY', 'test-key')
    prismaMock.movie.findUnique.mockResolvedValue(baseMovie)
    findTmdbMovieMock.mockResolvedValue({ tmdbId: 42, overview: '내용', posterPath: '/p.jpg' })
    prismaMock.movie.update.mockResolvedValue({
      ...baseMovie,
      tmdbId: 42,
      overview: '내용',
      posterPath: '/p.jpg',
      tmdbCheckedAt: new Date(),
    })

    const res = await request(buildApp()).get('/movies/A1').set(authHeader)

    expect(res.status).toBe(200)
    expect(findTmdbMovieMock).toHaveBeenCalledWith(baseMovie)
    expect(prismaMock.movie.update).toHaveBeenCalledWith({
      where: { movieCd: 'A1' },
      data: {
        tmdbId: 42,
        overview: '내용',
        posterPath: '/p.jpg',
        tmdbCheckedAt: expect.any(Date),
      },
    })
    vi.unstubAllEnvs()
  })

  it('tmdbCheckedAt이 이미 있으면 TMDB를 호출하지 않는다', async () => {
    vi.stubEnv('TMDB_API_KEY', 'test-key')
    prismaMock.movie.findUnique.mockResolvedValue({ ...baseMovie, tmdbCheckedAt: new Date() })

    const res = await request(buildApp()).get('/movies/A1').set(authHeader)

    expect(res.status).toBe(200)
    expect(findTmdbMovieMock).not.toHaveBeenCalled()
    expect(prismaMock.movie.update).not.toHaveBeenCalled()
    vi.unstubAllEnvs()
  })

  it('TMDB_API_KEY가 없으면 TMDB를 호출하지 않는다', async () => {
    vi.stubEnv('TMDB_API_KEY', '')
    prismaMock.movie.findUnique.mockResolvedValue(baseMovie)

    const res = await request(buildApp()).get('/movies/A1').set(authHeader)

    expect(res.status).toBe(200)
    expect(findTmdbMovieMock).not.toHaveBeenCalled()
    vi.unstubAllEnvs()
  })

  it('TMDB 네트워크 실패 시 기존 영화를 200으로 반환하고 tmdbCheckedAt을 기록하지 않는다', async () => {
    vi.stubEnv('TMDB_API_KEY', 'test-key')
    prismaMock.movie.findUnique.mockResolvedValue(baseMovie)
    findTmdbMovieMock.mockRejectedValue(new Error('network down'))

    const res = await request(buildApp()).get('/movies/A1').set(authHeader)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ data: { ...baseMovie, openDt: baseMovie.openDt.toISOString() } })
    expect(prismaMock.movie.update).not.toHaveBeenCalled()
    vi.unstubAllEnvs()
  })

  it('정상 매칭 실패 시 tmdbCheckedAt을 기록한다', async () => {
    vi.stubEnv('TMDB_API_KEY', 'test-key')
    prismaMock.movie.findUnique.mockResolvedValue(baseMovie)
    findTmdbMovieMock.mockResolvedValue(null)
    prismaMock.movie.update.mockResolvedValue({ ...baseMovie, tmdbCheckedAt: new Date() })

    const res = await request(buildApp()).get('/movies/A1').set(authHeader)

    expect(res.status).toBe(200)
    expect(prismaMock.movie.update).toHaveBeenCalledWith({
      where: { movieCd: 'A1' },
      data: { tmdbCheckedAt: expect.any(Date) },
    })
    vi.unstubAllEnvs()
  })

  it('영화가 없으면 404를 반환한다', async () => {
    prismaMock.movie.findUnique.mockResolvedValue(null)

    const res = await request(buildApp()).get('/movies/NOPE').set(authHeader)

    expect(res.status).toBe(404)
  })
})

describe('GET /movies (월별 개봉작)', () => {
  it('성인 장르 영화를 응답에서 제외한다', async () => {
    prismaMock.movie.findMany.mockResolvedValue([
      { movieCd: 'A1', genreNm: '드라마' },
      { movieCd: 'A2', genreNm: '성인물(에로)' },
      { movieCd: 'A3', genreNm: null },
    ])

    const res = await request(buildApp()).get('/movies?year=2026&month=7').set(authHeader)

    expect(res.status).toBe(200)
    expect(res.body.data.map((m: { movieCd: string }) => m.movieCd)).toEqual(['A1', 'A3'])
  })
})

describe('GET /movies/now-showing', () => {
  it('성인 장르 영화를 응답에서 제외한다', async () => {
    prismaMock.movie.findMany.mockResolvedValue([
      { movieCd: 'A1', genreNm: '드라마' },
      { movieCd: 'A2', genreNm: '에로' },
    ])

    const res = await request(buildApp()).get('/movies/now-showing').set(authHeader)

    expect(res.status).toBe(200)
    expect(res.body.data.map((m: { movieCd: string }) => m.movieCd)).toEqual(['A1'])
  })
})
