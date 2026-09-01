# enterprise-agent-monorepo (한국어 안내)

> **AI 에이전트 자율 코딩 및 MOS 초고밀도 인프라에 최적화된 엔터프라이즈 모노레포 골든 템플릿.**  
> **React 19 (TypeScript + Vite 8 + Tailwind v4 + shadcn/ui)** 프론트엔드와 **Rust (Axum 0.8 + Tokio + SQLx SQLite WAL / PostgreSQL)** 백엔드의 완벽한 결합.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Rust: Axum 0.8](https://img.shields.io/badge/Rust-Axum_0.8-orange.svg)](https://github.com/tokio-rs/axum)
[![React: 19.x](https://img.shields.io/badge/React-19.x-61dafb.svg)](https://react.dev)
[![TypeScript: Strict](https://img.shields.io/badge/TypeScript-Strict_5.9+-3178c6.svg)](https://www.typescriptlang.org/)
[![pnpm: v10](https://img.shields.io/badge/pnpm-v10.33-F69220.svg)](https://pnpm.io)

---

## ⚡ 왜 이 아키텍처인가?

본 모노레포는 **AI가 전체 코드의 80% 이상을 작성하는 에이전트 네이티브 환경**과 **MOS(MicroVM / Firecracker) 초고밀도 배포 환경**을 위해 정밀 설계되었습니다.

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

## 🌐 엔트로피패러독스 연구소 (`eplab`) 생태계 도구 연동

본 모노레포는 엔트로피패러독스 연구소의 **초고성능 개발 도구군과 네이티브로 결합**되어 있습니다:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    엔트로피패러독스 Lab 생태계 도구 연동                │
├─────────────────────────────────────────────────────────────────────────┤
│ 1. doc-engine (zig-doc-engine)                                          │
│    • 1.2ms 초고속 오프라인 FTS5 문서 검색 엔진.                         │
│    • AI 에이전트가 코드 작성 전 락파일 기반 정확한 API/보일러플레이트 참조. │
│    • 명령어: `doc-engine search "enterprise react table zod"`           │
├─────────────────────────────────────────────────────────────────────────┤
│ 2. MOS (MicroVM Orchestration System)                                   │
│    • 초고밀도 Firecracker MicroVM 오케스트레이션 시스템.                │
│    • apps/api 백엔드를 1ms 기동, 4MB 유휴 메모리로 초고속 Scale-to-Zero 배포.│
│    • 명령어: `mos deploy --name my-app --exec ./target/release/api`     │
├─────────────────────────────────────────────────────────────────────────┤
│ 3. WebReflex (web-reflex)                                               │
│    • 40ms 리플레이 브라우저 액션 캐시 기반 UI 자동화 QA 도구.           │
│    • React 19 프론트엔드 비주얼 회귀 테스트 무결점 자동화.              │
├─────────────────────────────────────────────────────────────────────────┤
│ 4. zenv & zlog                                                          │
│    • 제로 메모리 할당 컴파일 타임 환경설정 및 구조화 로거.              │
│    • Rust/Zig 기반 마이크로서비스용 초경량 사이드카 텔레메트리.         │
└─────────────────────────────────────────────────────────────────────────┘
```

### `doc-engine`을 활용한 AI 환각 방지 프로토콜
```bash
# 1. 검증된 엔터프라이즈 React 및 Axum 템플릿 검색
doc-engine search "enterprise react table form zod" --lib react
doc-engine search "Router State" --lib axum --ver 0.8

# 2. 컴파일러 0-에러 보일러플레이트 인출
doc-engine get curated:enterprise-react-stack
doc-engine get curated:axum-0.8
```

---

## 🚀 빠른 시작 가이드

```bash
# 1. 의존성 설치
pnpm install

# 2. 백엔드(:8080)와 프론트엔드(:3000) 동시 개발 실행
make dev
# 또는: ./scripts/dev.sh
```

* **프론트엔드 접속**: `http://localhost:3000`
* **Axum 백엔드 헬스체크**: `http://localhost:8080/api/health`
* **Swagger OpenAPI 문서**: `http://localhost:8080/swagger-ui`

---

## 🛠️ 주요 명령어

```bash
make codegen    # OpenAPI 3.1 스펙 추출 및 TypeScript 타입 동기화
make test       # Rust 인메모리 통합 테스트 + TypeScript strict 타입 검사
make check      # 빠른 문법 및 타입 정적 분석
make build      # Rust 릴리즈 바이너리 + React 클라이언트 프로덕션 빌드
make clean      # 빌드 산출물 및 임시 DB 삭제
```

---

## 📖 SSOT 스펙 문서 목록 (`docs/`)

* **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**: 전체 시스템 구조, 서비스 경계, 포트 매핑
* **[docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md)**: SQLite WAL 모드 설정 및 PostgreSQL 마이그레이션 호환 규격
* **[docs/API_CONTRACT.md](docs/API_CONTRACT.md)**: REST API 엔드포인트 명세 및 통합 에러 모델
* **[docs/VIBE_CODING_RULES.md](docs/VIBE_CODING_RULES.md)**: AI 코드 생성 금기 사항 및 2-Step doc-engine 프로토콜
* **[docs/AGENT_GUIDE.md](docs/AGENT_GUIDE.md)**: AI 코딩 에이전트를 위한 작업 규약

---

## 🛡️ 라이선스
[MIT License](LICENSE). Copyright (c) 2026 EntropyParadox Lab.
