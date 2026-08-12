# tossinvest-mcp

[English](README.md)

[토스증권 Open API](https://developers.tossinvest.com)를 위한 읽기 전용
[Model Context Protocol (MCP)](https://modelcontextprotocol.io) 서버입니다.
AI 어시스턴트가 시세와 계좌 정보를 조회할 수 있게 하되, 주문·정정·취소 기능은
구현하지 않습니다.

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
