---
name: ermanager
description: ERManager DB schema design and coding assistant. Designs new ERDs from natural language and generates .erm.json files, or reads existing .erm.json files to assist with SQL queries, ORM models, migrations, and API design. Use whenever working with database schemas in ERManager VS Code extension.
---

# ERManager 스킬

ERManager(VS Code 익스텐션)의 `.erm.json` 스키마 파일을 이해하고 두 가지 작업을 수행합니다:

1. **설계 모드** — 자연어 요구사항 → `.erm.json` 파일 생성
2. **컨텍스트 모드** — 기존 `.erm.json` 분석 → 코드 작성 지원

---

## .erm.json 파일 포맷 (정확한 스펙)

### 최상위 구조

```json
{
  "database": "PostgreSQL",
  "tables": [...],
  "relations": [...],
  "categories": [...]
}
```

- `database`: DB 종류 문자열. `"PostgreSQL"` | `"MySQL"` | `"SQLite"` | `""` (미지정)
- 레이아웃 정보(x, y, width, height)는 이 파일에 없음 → 별도 `.erm.layout.json`에 저장됨

---

### `tables` 배열

```json
{
  "id": 0,
  "physicalName": "member",
  "logicalName": "회원",
  "description": "서비스 회원 정보",
  "columns": [...]
}
```

- `id`: 테이블 식별자 (테이블들 사이에서 유일한 정수)
- `physicalName`: 실제 테이블명 (영문, snake_case)
- `logicalName`: 논리명 (한글 또는 영문 설명)
- `description`: 테이블 설명. 여러 줄 가능 (`\n` 사용)

---

### `columns` 배열 (각 테이블 내부)

```json
{
  "id": 10,
  "wordId": 34,
  "physicalName": "idx",
  "logicalName": "고유번호",
  "type": "serial",
  "description": "고유번호",
  "isPrimaryKey": true,
  "isForeignKey": false,
  "isNotNull": true,
  "isUniqueKey": false,
  "referencedColumn": null,
  "relationId": null
}
```

**중요: `id` 유일성 규칙**
- 컬럼 `id`는 **파일 전체의 모든 컬럼**에서 유일해야 함
- `referencedColumn`이 다른 테이블 컬럼의 `id`를 직접 참조하기 때문
- 테이블 id, relation id, category id는 각자 독립적 (컬럼 id와 같은 숫자 사용 가능)
- 신규 파일 생성 시: 컬럼 id를 100, 101, 102... 같이 큰 숫자로 시작하면 충돌 방지 용이

**필드 설명:**
- `wordId`: ERManager 내부 단어사전 참조용. 신규 생성 시 `0` 사용
- `type`: DB 타입 문자열. ERManager 관례상 `varchar(n)` 형식 그대로 사용 (n을 숫자로 바꾸지 않음)
- `description`: 컬럼 설명. 여러 줄 가능 (`\n`, `\r\n` 포함 가능). 예: `"타입\n- IN: 입금\n- OUT: 출금"`
- `isPrimaryKey`: PK 여부
- `isForeignKey`: FK 여부. `true`이면 `referencedColumn`, `relationId` 반드시 설정
- `isNotNull`: NOT NULL 제약
- `isUniqueKey`: UNIQUE 제약
- `referencedColumn`: FK일 때 참조하는 **부모 테이블 컬럼의 id** (null이면 일반 컬럼)
- `relationId`: FK일 때 속한 relation의 id (null이면 일반 컬럼)

---

### `relations` 배열

```json
{
  "id": 0,
  "sourceTableId": 1,
  "targetTableId": 0,
  "parentCardinality": "1",
  "childCardinality": "0..n"
}
```

- `id`: relation 식별자 (relation들 사이에서 유일한 정수)
- `sourceTableId`: FK 컬럼을 **가진** 테이블의 id (자식)
- `targetTableId`: FK가 **참조하는** 테이블의 id (부모)
- `parentCardinality`: `"1"` | `"0..1"`
- `childCardinality`: `"0..n"` | `"1..n"` | `"1"` | `"0..1"`

---

### `categories` 배열

```json
{
  "id": 0,
  "name": "회원 관련",
  "tableIds": [0, 1, 2]
}
```

- `id`: category 식별자 (category들 사이에서 유일한 정수)
- `tableIds`: 이 카테고리에 속한 테이블 id 목록 (빈 배열 허용)

---

## 완전한 예시 (두 테이블 + FK 관계)

`member` ← `log_cash` (N:1) 관계:

```json
{
  "database": "PostgreSQL",
  "tables": [
    {
      "id": 0,
      "physicalName": "member",
      "logicalName": "회원",
      "description": "서비스 회원 정보",
      "columns": [
        {
          "id": 100,
          "wordId": 0,
          "physicalName": "idx",
          "logicalName": "고유번호",
          "type": "serial",
          "description": "고유번호",
          "isPrimaryKey": true,
          "isForeignKey": false,
          "isNotNull": true,
          "isUniqueKey": false,
          "referencedColumn": null,
          "relationId": null
        },
        {
          "id": 101,
          "wordId": 0,
          "physicalName": "email",
          "logicalName": "이메일",
          "type": "varchar(n)",
          "description": "로그인 이메일",
          "isPrimaryKey": false,
          "isForeignKey": false,
          "isNotNull": true,
          "isUniqueKey": true,
          "referencedColumn": null,
          "relationId": null
        }
      ]
    },
    {
      "id": 1,
      "physicalName": "log_cash",
      "logicalName": "현금 로그",
      "description": "회원 현금 변동 이력",
      "columns": [
        {
          "id": 200,
          "wordId": 0,
          "physicalName": "idx",
          "logicalName": "고유번호",
          "type": "serial",
          "description": "고유번호",
          "isPrimaryKey": true,
          "isForeignKey": false,
          "isNotNull": true,
          "isUniqueKey": false,
          "referencedColumn": null,
          "relationId": null
        },
        {
          "id": 201,
          "wordId": 0,
          "physicalName": "member_idx",
          "logicalName": "회원 고유번호",
          "type": "integer",
          "description": "회원 고유번호",
          "isPrimaryKey": false,
          "isForeignKey": true,
          "isNotNull": true,
          "isUniqueKey": false,
          "referencedColumn": 100,
          "relationId": 0
        },
        {
          "id": 202,
          "wordId": 0,
          "physicalName": "type",
          "logicalName": "타입",
          "type": "varchar(n)",
          "description": "변동 타입\n- IN: 입금\n- OUT: 출금",
          "isPrimaryKey": false,
          "isForeignKey": false,
          "isNotNull": false,
          "isUniqueKey": false,
          "referencedColumn": null,
          "relationId": null
        },
        {
          "id": 203,
          "wordId": 0,
          "physicalName": "amount",
          "logicalName": "변동 금액",
          "type": "integer",
          "description": "변동 금액",
          "isPrimaryKey": false,
          "isForeignKey": false,
          "isNotNull": false,
          "isUniqueKey": false,
          "referencedColumn": null,
          "relationId": null
        }
      ]
    }
  ],
  "relations": [
    {
      "id": 0,
      "sourceTableId": 1,
      "targetTableId": 0,
      "parentCardinality": "1",
      "childCardinality": "0..n"
    }
  ],
  "categories": [
    {
      "id": 0,
      "name": "회원",
      "tableIds": [0, 1]
    }
  ]
}
```

**위 예시에서 FK 연결 구조:**
- `log_cash.member_idx` (컬럼 id:201) → `member.idx` (컬럼 id:100) 참조
- 컬럼 201: `referencedColumn: 100`, `relationId: 0`
- relation 0: `sourceTableId: 1` (log_cash), `targetTableId: 0` (member)

---

## 모드 1: ERD 설계 (자연어 → .erm.json 생성)

### 트리거
- "쇼핑몰 DB 설계해줘"
- "블로그 시스템 ERD 만들어줘"
- "이 요구사항으로 DB 스키마 작성해줘"

### 프로세스

1. 요구사항 분석 — DB 종류, 특별 제약사항 확인 (필요시 질문)
2. 엔티티 및 관계 설계
3. `.erm.json` 형식으로 파일 작성 (Write 도구 사용, 확장자 반드시 `.erm.json`)
4. 생성된 파일 경로 안내 — ERManager(VS Code)에서 파일 열면 즉시 다이어그램 시각화

### 설계 규칙

- 모든 테이블에 PK 컬럼 필수 (`isPrimaryKey: true`, `isNotNull: true`)
- FK 컬럼 명명: `{참조테이블명}_{참조컬럼명}` (예: `member_idx`)
- **컬럼 id 충돌 방지**: 테이블별로 100단위 시작 권장 (테이블0: 100~, 테이블1: 200~, ...)
- FK 설정 3종 세트: `isForeignKey: true` + `referencedColumn: {부모컬럼id}` + `relationId: {relation id}`
- relation의 `sourceTableId` = FK를 가진 테이블(자식), `targetTableId` = 참조되는 테이블(부모)
- 관련 테이블은 `categories`로 그룹핑
- `varchar(n)` 형식 그대로 사용 (n을 숫자로 바꾸지 않음)

### DB별 PK 타입

| DB | PK 타입 |
|----|---------|
| PostgreSQL | `serial` |
| MySQL | `int` |
| SQLite | `integer` |

---

## 모드 2: ERD 컨텍스트 (기존 .erm.json → 코딩 지원)

### 트리거
- "이 스키마 기반으로 Prisma 모델 만들어줘"
- ".erm.json 읽어서 TypeORM 엔티티 생성해줘"
- "users 테이블과 orders JOIN 쿼리 작성해줘"
- `/ermanager` (스킬 직접 호출)

### 프로세스

1. 프로젝트 내 `*.erm.json` 탐색 (`**/*.erm.json`, `.erm.layout.json` 제외, node_modules 제외)
2. 파일 읽기 및 스키마 분석
3. 스키마 요약 출력:
   - 테이블 목록 + 주요 컬럼 (PK, FK, NotNull)
   - 관계 목록 — 방향, cardinality
   - DB 종류
4. 요청에 맞는 코드 생성

### 지원 코드 생성

**SQL**: CREATE TABLE DDL, JOIN/집계 쿼리, 인덱스, 제약조건

**ORM**: Prisma schema, TypeORM Entity, SQLAlchemy, Sequelize, Django Model

**마이그레이션**: Flyway/Liquibase SQL, Prisma migrate, Django makemigrations

**API**: REST CRUD 엔드포인트, GraphQL 스키마

---

## 컬럼 타입 참고

| 논리 타입 | PostgreSQL | MySQL | SQLite |
|-----------|-----------|-------|--------|
| 자동증가 PK | `serial` | `int` | `integer` |
| 문자열 | `varchar(n)` | `varchar(n)` | `text` |
| 긴 텍스트 | `text` | `text` | `text` |
| 정수 | `integer` | `int` | `integer` |
| 실수 | `numeric(p,s)` | `decimal(p,s)` | `real` |
| 불리언 | `boolean` | `tinyint(1)` | `integer` |
| 날짜시간 | `timestamp` | `datetime` | `text` |
| JSON | `jsonb` | `json` | `text` |
