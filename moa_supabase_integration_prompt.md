# moa 앱 Supabase 연동 구현 프롬프트

당신은 기존 React Native + Expo + TypeScript 기반 **moa 메모 앱**을 수정하는 개발 에이전트다. 먼저 현재 프로젝트의 구조, 라우팅, 상태관리, 메모 편집/AI 기능 구현 상태를 분석하고 기존 UI/UX를 최대한 유지하면서 아래 **이미 생성된 Supabase DB 스키마**에 연결하라. 새로운 DB 테이블/컬럼/RPC가 이미 존재한다고 가정하지 말고 아래 명세만 사용하라. DB 마이그레이션은 요청 없이 실행하지 말고, 필요하면 별도 SQL 변경안으로 제안하라.

## 목표 및 우선순위
1. Expo 앱에서 Supabase Auth 세션을 초기화/복구하고 로그인 후 메모 CRUD를 동작시킨다.
2. 메모 자동 저장, 검색, 고정, 보관, 소프트 삭제, Markdown 콘텐츠를 지원한다.
3. 태그 및 메모-태그 연결, 연관 메모 후보 조회와 연결 승인/거절을 구현한다.
4. AI 정리 초안 저장/미리보기/적용을 구현하고 기존 AI 호출 코드가 있다면 재사용한다.
5. 비공개 Storage 이미지 업로드/표시/삭제 및 첨부 메타데이터를 연동한다.
6. TypeScript 타입, 로딩/오류/빈 상태, 중복 요청 방지, 기본 테스트를 보완한다.

## 연결/보안
- `@supabase/supabase-js`를 사용하고 Expo 환경에 맞는 세션 스토리지를 적용한다(설치 패키지와 최신 프로젝트 구성을 확인).
- 환경 변수: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (프로젝트가 publishable key를 사용한다면 변수명을 일관되게 조정). `service_role`/secret key는 절대 클라이언트에 포함하지 않는다.
- `auth.signInAnonymously()`를 초기 개인 테스트용 로그인 방식으로 사용할 수 있으나 Supabase Dashboard에서 Anonymous Sign-ins를 켜야 한다. 익명 로그인 사용자는 `authenticated` DB 역할로 RLS가 적용된다. 익명 계정은 앱 재설치/스토리지 삭제 시 복구가 어려우므로 주의한다.
- `user_id`는 기본값 `auth.uid()`를 사용한다. 삽입 시 임의의 사용자 ID를 보내지 않는다. 모든 테이블에 RLS가 활성화되어 있다. 인증 완료 전에 DB 작업을 시작하지 않는다.
- AI API 키를 앱에 하드코딩하지 않는다. Expo의 `EXPO_PUBLIC_` 변수는 공개된 값으로 간주한다. 개인 로컬 테스트에서 기존 AI 호출을 임시로 재사용하더라도 배포용 보안 설계와 구분한다.

## DB 테이블 (public schema)

### `notes`
- `id uuid PK default gen_random_uuid()`
- `user_id uuid NOT NULL default auth.uid()`
- `title text NOT NULL default ''` (최대 300자)
- `content text NOT NULL default ''` — Markdown 원문/현재 확정 본문
- `ai_content text NULL` — AI가 작성한 승인 전 초안
- `ai_status text NOT NULL default 'none'` — `none | draft | applied`
- `is_archived boolean NOT NULL default false`
- `is_pinned boolean NOT NULL default false`
- `created_at timestamptz`, `updated_at timestamptz` — 자동 설정, 수정 시 `updated_at` 트리거 갱신
- `deleted_at timestamptz NULL` — NULL이면 활성 메모; 소프트 삭제 시 현재 시각으로 설정

### `tags`
- `id uuid PK`, `user_id uuid default auth.uid()`, `name text NOT NULL` (trim 기준 1~60자), `created_at timestamptz`
- `(user_id, name)` UNIQUE. 중복 태그 생성에 주의하고 충돌 시 기존 태그 조회/재사용. 태그명 표준화(공백/대소문자/해시기호)는 앱에서 일관되게 처리한다.

### `note_tags`
- `note_id uuid`, `tag_id uuid`, `user_id uuid default auth.uid()`, `source text` (`user | ai`), `created_at timestamptz`
- `(note_id, tag_id)` 복합 PK. 한 메모에 같은 태그를 AI/사용자가 동시에 별도 행으로 저장할 수 없다. 수동 태그를 우선하고 AI 추천이 사용자 태그를 덮어쓰지 않도록 한다.
- 메모 및 태그의 소유권을 검증하는 DB 트리거가 있다.

### `note_links`
- `id uuid PK`, `user_id uuid default auth.uid()`, `note_a uuid`, `note_b uuid`
- `status text` (`suggested | accepted | rejected`), `source text` (`ai | user`), `reason text NULL`, `created_at`, `updated_at`
- `note_a < note_b` 체크 제약, `(user_id, note_a, note_b)` UNIQUE. 직접 insert할 때 순서 주의. **가능하면 아래 RPC 사용**.
- 링크를 표시할 때는 현재 메모가 `note_a` 또는 `note_b`인 행 모두 조회한다. `accepted`는 연결된 메모, `suggested`는 제안, `rejected`는 거절 상태다.

### `note_attachments`
- `id uuid PK`, `user_id uuid default auth.uid()`, `note_id uuid`, `storage_path text`, `file_name text NULL`, `mime_type text NULL`, `created_at timestamptz`
- `(user_id, storage_path)` UNIQUE. 이미지 파일 자체는 Storage에 있고 이 테이블은 메타데이터다.
- note 삭제에 따른 DB cascade가 Storage 오브젝트를 자동 삭제하지 않으므로 정리 절차를 분리해야 한다.

## RPC 함수 (Supabase `supabase.rpc`)

### 1. `moa_search_notes(p_query text, p_limit integer default 30)`
- 반환: `notes` 행 배열. 사용자 본인의 `deleted_at IS NULL` 메모만 검색.
- 제목 또는 본문 `ILIKE` 부분 일치, `is_pinned DESC`, `updated_at DESC` 순서.
- `p_limit`은 1~100으로 제한. 검색어가 비면 활성 메모 목록처럼 동작한다.
```ts
const { data, error } = await supabase.rpc('moa_search_notes', { p_query: query, p_limit: 30 });
```

### 2. `moa_related_notes(p_note_id uuid, p_limit integer default 10)`
- 반환 행: `{ note_id: string; title: string; shared_tag_count: number; shared_tags: string[] }`.
- **공유 태그 수 기반 후보 검색**이며 의미 유사도나 AI 판정 결과가 아니다. 앱에서 필요하면 AI로 후보를 재검증하고 사용자가 최종 승인하도록 한다.
- 후보가 0개인 것은 정상이다. `p_limit`은 1~50으로 제한.
```ts
const { data, error } = await supabase.rpc('moa_related_notes', { p_note_id: noteId, p_limit: 10 });
```

### 3. `moa_upsert_note_link(p_note_1 uuid, p_note_2 uuid, p_status text default 'suggested', p_source text default 'ai', p_reason text default null)`
- 반환: `uuid` (링크 ID).
- 내부적으로 두 메모 ID를 정렬하고 중복 링크는 갱신한다.
- `p_status`: `suggested | accepted | rejected`; `p_source`: `ai | user`.
- 승인 시 `accepted`, 거절 시 `rejected`. 기존 연결 상태를 덮어쓰므로 자동 추천 작업이 사용자의 거절/승인을 무심코 다시 `suggested`로 바꾸지 않도록 앱에서 기존 상태 확인.
```ts
const { data: linkId, error } = await supabase.rpc('moa_upsert_note_link', {
  p_note_1: noteId, p_note_2: relatedId,
  p_status: 'accepted', p_source: 'user', p_reason: null,
});
```

### 4. `moa_apply_ai_draft(p_note_id uuid)`
- 반환: `boolean`. `ai_status='draft'`이고 `ai_content`가 존재할 때만 적용 성공.
- 성공 시 `content=ai_content`, `ai_content=null`, `ai_status='applied'`로 변경.
- **원본 버전 이력을 별도 보관하지 않는다.** AI 적용 전 미리보기와 확인 UI가 필수이며, 영구적인 이전 버전 복구가 필요하면 별도 테이블 마이그레이션을 제안하라.
```ts
const { data: applied, error } = await supabase.rpc('moa_apply_ai_draft', { p_note_id: noteId });
if (!error && applied) { /* 최신 notes 행 다시 조회 */ }
```

## 대표 CRUD 패턴
```ts
// 활성 메모 목록
const { data: notes, error } = await supabase.from('notes')
  .select('*').is('deleted_at', null)
  .order('is_pinned', { ascending: false })
  .order('updated_at', { ascending: false });

// 메모 생성
const { data: note, error: createError } = await supabase.from('notes')
  .insert({ title: '', content: '' }).select().single();

// 자동 저장: debounce, 직전 저장 요청의 순서 역전 방지
const { error: saveError } = await supabase.from('notes')
  .update({ title, content }).eq('id', noteId).is('deleted_at', null);

// AI 초안 저장 (적용은 RPC로)
const { error: draftError } = await supabase.from('notes')
  .update({ ai_content: generatedMarkdown, ai_status: 'draft' }).eq('id', noteId);

// 소프트 삭제
const { error: deleteError } = await supabase.from('notes')
  .update({ deleted_at: new Date().toISOString() }).eq('id', noteId);

// 태그 연결
const { error: tagError } = await supabase.from('note_tags')
  .upsert({ note_id: noteId, tag_id: tagId, source: 'user' }, { onConflict: 'note_id,tag_id' });

// 현재 메모와 관련된 링크 양방향 조회
const { data: links, error: linksError } = await supabase.from('note_links')
  .select('*').or(`note_a.eq.${noteId},note_b.eq.${noteId}`);
```

## 이미지 Storage
- 비공개 버킷 ID: `moa-images`, 허용 MIME: `image/jpeg`, `image/png`, `image/webp`, `image/gif`, 최대 파일 크기 10 MiB.
- **경로 형식 필수**: `${user.id}/${crypto.randomUUID()}.${ext}` 또는 동일한 충돌 방지 파일명. 첫 번째 폴더는 인증 사용자 UUID여야 한다.
- Expo/React Native 환경에 맞는 `ArrayBuffer` 업로드 방식을 사용하고 Blob/FormData 호환성을 확인한다. 업로드 성공 후 `note_attachments`에 메타데이터를 기록한다.
- 비공개 버킷이므로 공개 URL을 영구 링크로 사용하지 않는다. `createSignedUrl(path, expirySeconds)`로 단기 URL을 발급해 렌더링하고 만료 시 갱신한다.
- Markdown 본문에 이미지를 넣는 방식은 **영구 공개 URL이 아닌 앱 내부의 안정적인 storage path 참조**로 설계하고 렌더링 시 signed URL로 해석한다. 기존 Markdown 렌더러에 맞게 구현한다.
- 삭제 시 Storage 오브젝트와 `note_attachments` 메타데이터를 함께 정리하되 부분 실패를 처리한다. 소프트 삭제 시 이미지를 즉시 삭제할지, 복구를 위해 보관할지 정책을 일관되게 선택한다(기본: 소프트 삭제 시 보관).

## 앱 로직과 UX
- 기존 화면과 컴포넌트를 먼저 살펴보고 API/Repository 계층을 분리한다. 예: `lib/supabase.ts`, `services/notes.ts`, `services/tags.ts`, `services/links.ts`, `services/attachments.ts`, `types/database.ts`. 실제 파일 경로는 프로젝트 구조에 맞춘다.
- 목록/상세/편집/검색/태그/연관 메모/이미지 첨부 화면을 연결한다. 빈 상태와 에러/재시도 UI를 포함한다.
- 메모 자동 저장은 debounce(예: 500~1000ms), 화면 이탈 시 저장 처리, 중복 요청 및 경쟁 상태를 고려한다. 네트워크 실패 시 입력 내용을 잃지 않도록 처리한다.
- AI 정리는 현재 메모 내용을 바탕으로 초안을 만들되 원문에 없는 사실을 지어내지 않도록 하고, 사용자 승인 전에 본문을 바꾸지 않는다. 기존 AI 기능이 없다면 명확한 서비스 인터페이스/TODO를 만들고 임의의 AI API나 키를 가정하지 않는다.
- AI 태그 추천은 메모 저장마다 무조건 API를 호출하지 말고 사용자 액션/의미 있는 변경 등 적절한 조건으로 제한한다. 기존 수동 태그를 보존한다.
- 후보 연결 추천은 `moa_related_notes`를 활용하고 `rejected`/`accepted` 상태를 존중한다. 태그 일치만으로 연결을 자동 승인하지 않는다.
- 메모의 소프트 삭제 후에도 `note_tags`, `note_links` 등은 DB에 남을 수 있으므로 관련 화면에서는 활성 메모만 표시한다.
- 전체 앱에서 Supabase 에러를 처리하고 사용자에게 재시도 가능한 메시지를 제공한다.

## 구현 및 검증 지침
1. 프로젝트를 먼저 조사해 기존 구현/미구현 기능을 간단히 정리한다.
2. 필요한 패키지만 설치하고 환경 변수 예시 파일(`.env.example`)을 추가한다. 실제 키 값은 넣지 않는다.
3. 위 스키마와 일치하는 TypeScript 타입을 작성한다. 가능하면 Supabase 타입 생성 명령을 안내하되 실제 DB 연결 정보가 없으면 타입을 수동으로 정확히 선언한다.
4. 스키마에 없는 `profiles`, `note_versions`, `ai_jobs`, `embeddings` 등의 테이블을 **있는 것처럼 참조하지 않는다**.
5. 각 기능을 실제 Supabase CRUD/RPC/Storage 호출에 연결한다. 모의 데이터는 테스트에만 사용한다.
6. 인증, RLS에 의한 타 사용자 접근 거부, 메모 CRUD, 자동 저장, 태그 중복, 후보 검색, 링크 승인/거절, AI 초안 적용, 이미지 업로드/표시, 오류 처리를 검증한다.
7. 타입체크/린트/테스트를 실행할 수 있으면 실행하고 결과를 보고한다.
8. 완료 시 변경 파일, 환경 변수 설정법, Supabase Dashboard에서 필요한 설정, 테스트 절차, 남은 제약을 한국어로 요약한다.

**중요**: Supabase 스키마는 이미 SQL Editor에서 적용했다고 가정한다. 클라이언트 코드에 SQL을 실행하는 기능이나 관리자 권한을 넣지 마라. 기능 구현에 DB 변경이 반드시 필요하다면 먼저 현재 스키마로 가능한 범위까지 구현하고 별도 마이그레이션 SQL을 제안하라.
