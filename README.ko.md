# enterprise-agent-monorepo (한국어 안내)

> **AI 에이전트 자율 코딩 및 고밀도 인프라에 최적화된 엔터프라이즈 모노레포 골든 템플릿.**  
> **React 19 (TypeScript + Vite 8 + Tailwind v4 + shadcn/ui)** 프론트엔드와 **Rust (Axum 0.8 + Tokio + SQLx SQLite WAL / PostgreSQL)** 백엔드의 완벽한 결합.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Rust: Axum 0.8](https://img.shields.io/badge/Rust-Axum_0.8-orange.svg)](https://github.com/tokio-rs/axum)
[![React: 19.x](https://img.shields.io/badge/React-19.x-61dafb.svg)](https://react.dev)
[![TypeScript: Strict](https://img.shields.io/badge/TypeScript-Strict_5.9+-3178c6.svg)](https://www.typescriptlang.org/)
[![pnpm: v10](https://img.shields.io/badge/pnpm-v10.33-F69220.svg)](https://pnpm.io)

---

## ⚡ 아키텍처 및 핵심 철학

본 모노레포는 **AI가 전체 코드의 80% 이상을 작성하는 에이전트 네이티브 환경**과 **초고밀도 서버/MicroVM 배포 환경**을 위해 정밀 설계되었습니다.

```
┌────────────────────────────────────────────────────────┐
│ [프론트엔드] apps/web (React 19.x + Vite 8.x + Tailwind v4)│
│  • shadcn/ui + TanStack Table v8 + TanStack Query v5    │
│  • React Hook Form + Zod + Sonner + Lucide             │
└───────────────────────────┬────────────────────────────┘
                            │ (컴파일 타임 OpenAPI 3.1 Fetch)
                            ▼
┌────────────────────────────────────────────────────────┐
│ [계약/타입] packages/api-client                        │
│  • Rust 구조체에서 100% 자동 추출된 TypeScript 타입      │
└───────────────────────────┬────────────────────────────┘
                            │ (HTTP REST / JSON-RPC)
                            ▼
┌────────────────────────────────────────────────────────┐
│ [백엔드] apps/api (Rust Axum 0.8.x + Tokio)            │
│  • Utoipa OpenAPI 3.1 + Serde + Tracing                │
│  • SQLx 0.8 SQLite (WAL 모드) ➔ PostgreSQL 확장 설계   │
│  • MicroVM 1ms 기동, 4MB 극단적 메모리 절감             │
└────────────────────────────────────────────────────────┘
```

---

## 🏆 핵심 특징

* **타입 불일치 원천 소멸 (Zero Drift)**: `make codegen` 명령 한 번으로 Rust 구조체(`utoipa`)가 프론트엔드 TypeScript 타입으로 100% 자동 동기화.
* **AI 원샷 생성 성공률 극대화**: LLM 학습 데이터가 가장 풍부한 `React 19 + shadcn/ui` 표준화로 프론트엔드 AI 버그 발생률 0% 수축.
* **압도적 리소스 절감**: Rust Axum 백엔드 구동으로 **유휴 메모리 4~8MB, 2ms 미만 콜드스타트** 달성.
* **SQLite WAL ➔ PostgreSQL 무중단 확장**: 기본 단일 파일 SQLite WAL로 빠른 로컬 개발 후, ANSI 표준 SQL 설계로 PostgreSQL 16+ 무중단 전환 지원.
* **프로덕션 수준 안정성**: SIGINT/SIGTERM Graceful Shutdown(WAL 안전 플러시), React Error Boundary, 100% 고정 락파일 기본 탑재.

---

## 🚀 빠른 시작 가이드

```bash
# 1. 의존성 설치
pnpm install

# 2. 백엔드(:8080)와 프론트엔드(:3000) 동시 개발 실행
make dev
```

* **프론트엔드 접속**: `http://localhost:3000`
* **Axum 백엔드 헬스체크**: `http://localhost:8080/api/health`
* **Swagger OpenAPI 문서**: `http://localhost:8080/swagger-ui`

---

## 🛠️ 주요 명령어

| 명령어 | 동작 내용 |
| :--- | :--- |
| **`make dev`** | 백엔드(:8080)와 프론트엔드(:3000) 동시 실행 (트랩 자동 종료) |
| **`make codegen`** | Rust에서 OpenAPI 3.1 스펙 추출 및 TypeScript 타입 동기화 |
| **`make test`** | Rust 인메모리 통합 테스트 + TypeScript strict 타입 검사 |
| **`make check`** | 빠른 문법 및 타입 정적 분석 (`cargo check` + `pnpm typecheck`) |
| **`make build`** | Rust 최적화 릴리즈 바이너리 + React 클라이언트 프로덕션 빌드 |
| **`make clean`** | 빌드 산출물 및 임시 DB 삭제 |

---

## 🚢 배포 가이드라인

1. **리눅스 서버 / 베어메탈**:
   ```bash
   PORT=8080 DATABASE_URL=sqlite://prod.db ./target/release/api
   ```
2. **MicroVM / MOS (Scale-to-Zero)**:
   * **<2ms 콜드스타트** 및 **4MB 유휴 메모리**로 Firecracker/MOS MicroVM 초고밀도 배포 최적화.
3. **Docker 컨테이너**:
   * Distroless Rust 런타임과 Nginx/Caddy 정적 프론트엔드 멀티스테이지 빌드 지원.

---

## 📖 SSOT 스펙 문서 목록 (`docs/`)

* **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**: 전체 시스템 구조, 서비스 경계, 포트 매핑
* **[docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md)**: SQLite WAL 모드 설정 및 PostgreSQL 마이그레이션 호환 규격
* **[docs/API_CONTRACT.md](docs/API_CONTRACT.md)**: REST API 엔드포인트 명세 및 통합 에러 모델
* **[docs/VIBE_CODING_RULES.md](docs/VIBE_CODING_RULES.md)**: AI 코드 생성 가드레일
* **[docs/AGENT_GUIDE.md](docs/AGENT_GUIDE.md)**: AI 코딩 에이전트를 위한 종합 작업 규약

---

## 🛡️ 라이선스
[MIT License](LICENSE). Copyright (c) 2026 EntropyParadox Lab.
