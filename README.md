# tossinvest-mcp

[English](README.en.md)

[토스증권 Open API](https://developers.tossinvest.com)를 위한
[Model Context Protocol (MCP)](https://modelcontextprotocol.io) 서버입니다.
시세·계좌 조회와 함께, 사용자 확인을 거친 주식·조건주문 기능을 제공합니다.

## Claude Code에서 사용하기

이 패키지가 npm에 배포된 뒤에는 저장소를 clone할 필요가 없습니다. Claude Code를
사용할 프로젝트의 `.mcp.json`에 아래 내용을 추가하세요.

```json
{
  "mcpServers": {
    "toss": {
      "command": "npx",
      "args": ["-y", "@soehd0889/tossinvest-mcp"],
      "env": {
        "TOSS_CLIENT_ID": "토스_클라이언트_ID",
        "TOSS_CLIENT_SECRET": "토스_클라이언트_시크릿"
      }
    }
  }
}
```

토스증권 Open API 개발자 콘솔에서 `TOSS_CLIENT_ID`와
`TOSS_CLIENT_SECRET`을 발급받아 입력한 뒤 Claude Code를 재시작하세요.
자격 증명은 Git에 커밋하거나 프롬프트에 공유하면 안 됩니다.

> `npx`는 첫 실행 때 패키지를 내려받고 이후에는 캐시를 사용합니다.
> Node.js 18 이상이 필요합니다.

## 제공 도구

| 도구 | 설명 |
| --- | --- |
| `toss_get_price` | 한국·미국 주식의 현재가 조회 |
| `toss_resolve_symbol` | 회사 이름을 티커 또는 국내 종목 코드로 변환 |
| `toss_get_holdings` | 보유 종목과 손익 조회 |
| `toss_get_buying_power` | 원화 또는 달러 주문 가능 금액 조회 |
| `toss_get_exchange_rate` | 환율 조회 (기본: USD → KRW) |
| `toss_get_candles` | 1분봉 또는 일봉 OHLCV 조회 |
| `toss_get_orderbook` / `toss_get_recent_trades` | 실시간 호가와 최근 체결 조회 |
| `toss_get_market_calendar` | 한국·미국 장 운영 시간 및 휴장일 조회 |
| `toss_get_stock_warnings` | 투자 유의사항·거래 경고 조회 |
| `toss_get_stock_investor_trading` / `toss_get_short_selling` | 국내 종목 투자자 수급·공매도 동향 조회 |
| `toss_get_rankings` | 거래대금·거래량·상승·하락 종목 랭킹 조회 |
| `toss_get_market_indicator_prices` / `toss_get_market_indicator_candles` | 지수·시장 지표의 현재가와 캔들 조회 |
| `toss_get_market_investor_trading` | 코스피·코스닥 투자자별 매매대금 조회 |
| `toss_prepare_order` | 주식 주문을 검증·미리보기만 함 (실주문 없음) |
| `toss_prepare_conditional_order` | SINGLE·OCO·OTO 조건주문을 검증·미리보기 |
| `toss_submit_prepared_order` | 사용자 확인을 거친 일회용 주문을 제출 |

## 주문 안전 절차

주문은 항상 2단계로 진행됩니다. `toss_prepare_order` 또는
`toss_prepare_conditional_order`는 주문을 실행하지 않고 미리보기만 만듭니다.
AI는 내용을 사용자에게 보여주고 명시적인 확인을 받은 후에만
`toss_submit_prepared_order`를 호출해야 합니다. 확인 토큰은 정확히 그 주문에만
연결되며 60초 후 만료되고, 한 번 사용하거나 서버를 재시작하면 무효화됩니다.
이는 착오주문 위험을 낮추는 장치이며 사용자의 최종 검토를 대체하지 않습니다.

## 로컬 개발

```bash
git clone https://github.com/Jeric1223/tossinvest-mcp.git
cd tossinvest-mcp
npm install
npm test
```

로컬에서 실행할 때는 `.env.example`을 복사해 자격 증명을 입력합니다.

```bash
cp .env.example .env
```

## 참고 사항

- 처음 실행하면 KOSPI, KOSDAQ, NASDAQ, NYSE, AMEX의 종목 마스터를
  다운로드하며, 이후에는 캐시를 사용하고 하루에 한 번 백그라운드 갱신합니다.
- API의 숫자 필드는 문자열로 오며, 등락률은 소수 형식입니다.
  예: `-0.3799`는 -37.99%입니다.
- API 제한은 시세 초당 15회, 자산 초당 5회, 계좌 초당 1회입니다.

## 면책 사항

이 프로젝트는 토스증권과 무관한 비공식 도구이며 투자 조언을 제공하지 않습니다.
사용에 따른 책임은 사용자에게 있습니다.

## 라이선스

[MIT](LICENSE)
