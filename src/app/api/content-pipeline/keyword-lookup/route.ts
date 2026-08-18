import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// 네이버 검색광고 키워드도구. ~/dev/research-tools/research/keyword_research.py 와 같은 API를
// 쓰지만, 그 스크립트는 실행할 때마다 ~/brain/notes/ 에 결과 파일을 남기므로 여기서 호출하지 않고
// 서명 로직만 옮겨왔다. (스크립트는 터미널용으로 그대로 유지)
const BASE_URL = 'https://api.searchad.naver.com';
const API_PATH = '/keywordstool';

// 스위트스팟: 월간 총 검색량 30~3000 (keyword_research.py 와 동일 기준)
const SWEET_MIN = 30;
const SWEET_MAX = 3000;

interface KeywordRow {
  keyword: string;
  pc: number;
  mobile: number;
  total: number;
  comp: string;
  sweet: boolean;
}

function signature(timestamp: string, method: string, path: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(`${timestamp}.${method}.${path}`).digest('base64');
}

/** Naver returns "< 10" for low-volume keywords and comma-grouped numbers for the rest. */
function toInt(value: unknown): number {
  const parsed = parseInt(String(value ?? '').replace(/[,<\s]/g, ''), 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const keyword: string | undefined = body?.keyword;
    if (!keyword || !keyword.trim()) {
      return NextResponse.json({ error: '키워드를 입력해주세요' }, { status: 400 });
    }

    const apiKey = process.env.NAVER_AD_API_KEY;
    const secretKey = process.env.NAVER_AD_SECRET_KEY;
    const customerId = process.env.NAVER_AD_CUSTOMER_ID;
    if (!apiKey || !secretKey || !customerId) {
      return NextResponse.json(
        {
          error:
            '네이버 검색광고 키가 설정되지 않았습니다 (mission-control/.env.local 에 NAVER_AD_API_KEY / NAVER_AD_SECRET_KEY / NAVER_AD_CUSTOMER_ID 필요)',
        },
        { status: 503 }
      );
    }

    // API 요건: 힌트 키워드는 공백 제거
    const normalized = keyword.trim().replace(/\s+/g, '');
    const timestamp = String(Date.now());
    const url = `${BASE_URL}${API_PATH}?hintKeywords=${encodeURIComponent(normalized)}&showDetail=1`;

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Timestamp': timestamp,
        'X-API-KEY': apiKey,
        'X-Customer': customerId,
        'X-Signature': signature(timestamp, 'GET', API_PATH, secretKey),
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      console.error('Naver searchad keywordstool failed:', response.status, await response.text());
      return NextResponse.json(
        { error: `네이버 검색광고 API 오류 (${response.status})` },
        { status: 502 }
      );
    }

    const data = await response.json();
    const rows: KeywordRow[] = (data?.keywordList ?? [])
      .map((item: Record<string, unknown>) => {
        const pc = toInt(item.monthlyPcQcCnt);
        const mobile = toInt(item.monthlyMobileQcCnt);
        const total = pc + mobile;
        return {
          keyword: String(item.relKeyword ?? ''),
          pc,
          mobile,
          total,
          comp: String(item.compIdx ?? ''),
          sweet: total >= SWEET_MIN && total <= SWEET_MAX,
        };
      })
      .sort((a: KeywordRow, b: KeywordRow) => b.total - a.total);

    const exact = rows.find((row) => row.keyword.toUpperCase() === normalized.toUpperCase()) ?? null;

    return NextResponse.json({ keyword: normalized, exact, related: rows.slice(0, 10) });
  } catch (error) {
    console.error('Failed to look up keyword:', error);
    return NextResponse.json({ error: '키워드 조회에 실패했습니다' }, { status: 500 });
  }
}
