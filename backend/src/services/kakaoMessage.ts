import prisma from '../prisma'

// 토큰 갱신
async function refreshAccessToken(userId: number): Promise<string | null> {
  const token = await prisma.kakaoToken.findUnique({ where: { userId } })
  if (!token) return null

  // 아직 유효하면 그대로 반환
  if (token.expiresAt > new Date()) {
    return token.accessToken
  }

  // refresh_token으로 갱신
  const kakaoKey = process.env.KAKAO_REST_API_KEY!
  const res = await fetch('https://kauth.kakao.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: kakaoKey,
      refresh_token: token.refreshToken,
    }),
  })

  const data = await res.json()

  if (data.error) {
    console.error('[kakao] 토큰 갱신 실패:', data)
    return null
  }

  const expiresAt = new Date(Date.now() + data.expires_in * 1000)

  await prisma.kakaoToken.update({
    where: { userId },
    data: {
      accessToken: data.access_token,
      // refresh_token은 갱신 응답에 포함될 때만 업데이트
      ...(data.refresh_token ? { refreshToken: data.refresh_token } : {}),
      expiresAt,
    },
  })

  return data.access_token
}

// 나에게 보내기
export async function sendKakaoMessage(userId: number, text: string, buttonUrl: string): Promise<boolean> {
  const accessToken = await refreshAccessToken(userId)
  if (!accessToken) {
    console.warn(`[kakao] userId=${userId} 토큰 없음, 메시지 발송 스킵`)
    return false
  }

  const templateObject = JSON.stringify({
    object_type: 'text',
    text,
    link: {
      web_url: buttonUrl,
      mobile_web_url: buttonUrl,
    },
    button_title: '주식 보러 가기',
  })

  const res = await fetch('https://kapi.kakao.com/v2/api/talk/memo/default/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
    },
    body: new URLSearchParams({ template_object: templateObject }),
  })

  const data = await res.json()

  if (data.result_code === 0) {
    console.log(`[kakao] userId=${userId} 메시지 발송 성공`)
    return true
  } else {
    console.error(`[kakao] userId=${userId} 메시지 발송 실패:`, data)
    return false
  }
}
