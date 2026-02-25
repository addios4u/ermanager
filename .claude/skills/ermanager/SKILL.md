---
name: ermanager
description: ERManager DB schema design and coding assistant. Designs new ERDs from natural language and generates .erm.json files, or reads existing .erm.json files to assist with SQL queries, ORM models, migrations, and API design. Use whenever working with database schemas in ERManager VS Code extension.
---

# ERManager 스킬

ERManager(VS Code 익스텐션)의 `.erm.json` 스키마 파일을 이해하고 두 가지 작업을 수행합니다:

1. **설계 모드** — 자연어 요구사항 → `.erm.json` 파일 생성
2. **컨텍스트 모드** — 기존 `.erm.json` 분석 → 코드 작성 지원

---

## .erm.json 파일 포맷

```json
{
  "database": "PostgreSQL",
  "tables": [
    {
      "id": 0,
      "physicalName": "users",
      "logicalName": "회원",
      "description": "",
      "columns": [
        {
          "id": 0,
          "wordId": 0,
          "physicalName": "idx",
          "logicalName": "고유번호",
          "type": "serial",
          "description": "",
          "isPrimaryKey": true,
          "isForeignKey": false,
          "isNotNull": true,
          "isUniqueKey": false,
          "defaultValue": "",
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
      "name": "회원 관련",
      "tableIds": [0, 1]
    }
  ]
}
```

**필드 설명:**
- `sourceTableId` — FK를 가진 테이블 (자식)
- `targetTableId` — 참조 대상 테이블 (부모)
- `parentCardinality` — `"1"` | `"0..1"`
- `childCardinality` — `"0..n"` | `"1..n"` | `"1"` | `"0..1"`
- `referencedColumn` — FK 컬럼이 참조하는 부모 컬럼의 `id`
- `relationId` — FK 컬럼이 속한 relation의 `id`
- `wordId` — 내부 참조용, 신규 생성 시 임의 정수 사용

---

## 모드 1: ERD 설계 (자연어 → .erm.json 생성)

### 트리거
- "쇼핑몰 DB 설계해줘"
- "블로그 시스템 ERD 만들어줘"
- "이 요구사항으로 DB 스키마 작성해줘"
- "ERD 파일 만들어줘"

### 프로세스

1. 요구사항 분석 — DB 종류, 특별 제약사항 확인 (필요시 질문)
2. 엔티티 및 관계 설계
3. `.erm.json` 형식으로 파일 작성 (Write 도구 사용)
4. 생성된 파일 경로 안내 — ERManager에서 바로 열기 가능

### 설계 규칙

- 모든 테이블에 PK 컬럼 필수 (`isPrimaryKey: true`, `isNotNull: true`)
- FK 컬럼 명명: `{참조테이블명}_{참조컬럼명}` (예: `user_idx`)
- FK 컬럼: `isForeignKey: true`, `referencedColumn`에 참조 컬럼 id, `relationId`에 해당 relation id
- `id` 값은 파일 전체에서 유일 (테이블·컬럼·관계·카테고리 모두 포함)
- 관련 테이블은 `categories`로 그룹핑
- 레이아웃(x, y, width, height)은 `.erm.json`에 없음 → ERManager가 자동 배치

### DB별 PK 타입

| DB | PK 타입 |
|----|---------|
| PostgreSQL | `serial` |
| MySQL | `int` (AUTO_INCREMENT) |
| SQLite | `integer` |

---

## 모드 2: ERD 컨텍스트 (기존 .erm.json → 코딩 지원)

### 트리거
- "이 스키마 기반으로 Prisma 모델 만들어줘"
- ".erm.json 읽어서 TypeORM 엔티티 생성해줘"
- "users 테이블과 orders JOIN 쿼리 작성해줘"
- "/ermanager" (스킬 직접 호출)

### 프로세스

1. 프로젝트 내 `*.erm.json` 탐색 (Glob: `**/*.erm.json`, node_modules 제외)
   - 여러 개 발견 시 사용자에게 선택 요청
   - 사용자가 경로 직접 지정한 경우 해당 파일 사용
2. 파일 읽기 및 스키마 분석
3. 스키마 요약 출력:
   - 테이블 목록, 컬럼 수, PK/FK 구조
   - 관계(relation) 목록 — 방향 및 cardinality
   - DB 종류
4. 요청에 맞는 코드 생성

### 지원 코드 생성

**SQL**
- CREATE TABLE DDL (FK 제약 포함/제외 선택)
- JOIN 쿼리, 서브쿼리, 집계 쿼리
- 인덱스, 제약 조건, 트리거

**ORM 모델**
- Prisma schema (`schema.prisma`)
- TypeORM Entity (`@Entity`, `@Column`, `@ManyToOne` 등)
- SQLAlchemy Model (`Base`, `Column`, `relationship`)
- Sequelize Model
- Django Model

**마이그레이션**
- SQL DDL (Flyway / Liquibase)
- Prisma migrate 파일
- Django `makemigrations` 구조

**API 설계**
- REST 엔드포인트 구조 (CRUD)
- GraphQL 스키마 및 Resolver 구조

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

---

## 출력 형식 (설계 완료 시)

```
ERD 설계 완료
=============

파일: ./schema.erm.json
DB: PostgreSQL

테이블 (5개):
- users (회원) — 8컬럼
- orders (주문) — 6컬럼
- order_items (주문 상품) — 5컬럼
- products (상품) — 7컬럼
- categories (카테고리) — 4컬럼

관계 (4개):
- orders.user_idx → users.idx (N:1)
- order_items.order_idx → orders.idx (N:1)
- order_items.product_idx → products.idx (N:1)
- products.category_idx → categories.idx (N:1)

ERManager(VS Code)에서 파일을 열면 바로 다이어그램으로 확인할 수 있습니다.
```
