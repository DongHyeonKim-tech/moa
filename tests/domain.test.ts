import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { shouldAnalyze } from '../services/analysisPolicy.ts';
import { referencedAttachmentIds } from '../services/attachmentRefs.ts';
import { MAX_DRAFT_CONTEXT_CHARS } from '../services/aiLimits.ts';
import { buildDraftPayload, buildMergePayload, buildRelatedPayload } from '../services/aiPayload.ts';
import { parseDraftResponse } from '../services/aiParse.ts';
import { legacyMemoFromUnknown } from '../services/legacyMemo.ts';
import {
  absoluteSelection,
  applyMarkdownAction,
  editorPieces,
  insertImageMarkdown,
  markdownFromPieces,
  markdownWithoutImage,
  parseMarkdown,
  replaceShownText,
  selectionInPiece,
  shownText,
  titleFromMarkdown,
  toggleTask,
} from '../services/markdown.ts';
import { contentChanged, draftFromMemo, nextMemoFromDraft } from '../services/memoRules.ts';
import { buildMergedMemo } from '../services/mergeMemo.ts';
import { findTagCandidates, isWorthSuggesting } from '../services/relatedNotes.ts';
import { imageStoragePath, assertAllowedImage, MAX_IMAGE_BYTES } from '../services/imagePath.ts';
import { memoFromNote, relationFromLink } from '../services/noteMapper.ts';
import { closedMemoIds, findRelation, linkedMemoIds, planLink } from '../services/relationRules.ts';
import { planTagChanges } from '../services/tagSync.ts';
import type { NoteRow } from '../types/database.ts';
import { MIGRATION_V1 } from '../repositories/schema.ts';
import { mergeAnalysisTags } from '../services/tagPolicy.ts';
import { contentFingerprint } from '../utils/fingerprint.ts';
import type { Memo, MemoTag } from '../types/memo.ts';

function memo(overrides: Partial<Memo> = {}): Memo {
  return {
    id: 'a',
    title: '부산',
    contentMarkdown: '해운대 숙소를 알아보고 맛집도 찾는다',
    aiSummary: '부산 숙소와 맛집',
    tags: [
      { name: '부산', source: 'USER' },
      { name: '여행', source: 'AI' },
    ],
    isFavorite: false,
    isPinned: false,
    isDeleted: false,
    deletedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    lastViewedAt: null,
    analyzedContentHash: null,
    aiAnalysisStatus: 'idle',
    ...overrides,
  };
}

describe('markdown', () => {
  it('renders the supported blocks', () => {
    const blocks = parseMarkdown('# 제목\n\n**굵게** 그리고 *기울임*\n\n- 하나\n- [ ] 할 일\n\n> 인용\n\n---\n\n[링크](https://example.com)\n\n![사진](attachment:img-1)');
    assert.deepEqual(
      blocks.map((block) => block.type),
      ['h1', 'paragraph', 'bullet', 'task', 'quote', 'hr', 'paragraph', 'image'],
    );
  });

  it('wraps a selection and toggles a task', () => {
    const bold = applyMarkdownAction('안녕', { start: 0, end: 2 }, 'bold');
    assert.equal(bold.text, '**안녕**');
    const heading = applyMarkdownAction('본문', { start: 0, end: 0 }, 'h1');
    assert.equal(heading.text, '# 본문');
    const image = insertImageMarkdown('메모', { start: 2, end: 2 }, 'pic-1');
    assert.match(image.text, /!\[사진\]\(attachment:pic-1\)/);
    assert.deepEqual(referencedAttachmentIds(image.text), ['pic-1']);
    const pieces = editorPieces('hello\n![사진](attachment:pic-1)\nworld');
    assert.deepEqual(
      pieces.map((piece) => (piece.kind === 'text' ? shownText(piece) : piece.id)),
      ['hello', 'pic-1', 'world'],
    );
    assert.equal(markdownFromPieces(pieces), 'hello\n![사진](attachment:pic-1)\nworld');
    assert.equal(replaceShownText(pieces, 2, '세상'), 'hello\n![사진](attachment:pic-1)\n세상');
    assert.equal(markdownWithoutImage('hello\n![사진](attachment:pic-1)\nworld', 'pic-1'), 'hello\n\nworld');
    assert.deepEqual(absoluteSelection(pieces, 0, { start: 5, end: 5 }), { start: 5, end: 5 });
    assert.equal(selectionInPiece(pieces, { start: 5, end: 5 })?.pieceIndex, 0);
    const inserted = insertImageMarkdown('hello', { start: 5, end: 5 }, 'pic-1');
    const insertedPieces = editorPieces(inserted.text);
    assert.equal(selectionInPiece(insertedPieces, inserted.selection)?.pieceIndex, 2);
    assert.equal(replaceShownText(insertedPieces, 2, '이어서'), 'hello\n![사진](attachment:pic-1)\n이어서');
    const blank = insertImageMarkdown('', { start: 0, end: 0 }, 'pic-1');
    assert.equal(selectionInPiece(editorPieces(blank.text), blank.selection)?.pieceIndex, 2);
    assert.equal(toggleTask('- [ ] 기차', 0), '- [x] 기차');
    assert.equal(titleFromMarkdown('# 부산 여행\n\n숙소'), '부산 여행');
  });
});

describe('analysis policy', () => {
  it('skips unchanged, short, and duplicate work', () => {
    const fingerprint = contentFingerprint('제목', '같은 내용');
    assert.equal(contentFingerprint('제목', '같은   내용'), fingerprint);
    assert.equal(
      shouldAnalyze({ consent: false, plainLength: 40, fingerprint, analyzedContentHash: null, inflightFingerprint: null }),
      'skip-consent',
    );
    assert.equal(
      shouldAnalyze({ consent: true, plainLength: 4, fingerprint, analyzedContentHash: null, inflightFingerprint: null }),
      'skip-short',
    );
    assert.equal(
      shouldAnalyze({ consent: true, plainLength: 40, fingerprint, analyzedContentHash: fingerprint, inflightFingerprint: null }),
      'skip-same',
    );
    assert.equal(
      shouldAnalyze({ consent: true, plainLength: 40, fingerprint, analyzedContentHash: null, inflightFingerprint: fingerprint }),
      'skip-inflight',
    );
    assert.equal(
      shouldAnalyze({ consent: true, plainLength: 40, fingerprint, analyzedContentHash: null, inflightFingerprint: null }),
      'run',
    );
  });
});

describe('tags and drafts', () => {
  it('keeps user tags when AI tags are refreshed', () => {
    const current: MemoTag[] = [
      { name: '부산', source: 'USER' },
      { name: '메모', source: 'AI' },
    ];
    const next = mergeAnalysisTags(current, ['부산', '메모', '숙소', '맛집', '기차', '해운대', '기타']);
    assert.deepEqual(next, [
      { name: '부산', source: 'USER' },
      { name: '숙소', source: 'AI' },
      { name: '맛집', source: 'AI' },
      { name: '기차', source: 'AI' },
      { name: '해운대', source: 'AI' },
    ]);
  });

  it('does not treat an unchanged draft as a new edit', () => {
    const current = memo();
    const draft = draftFromMemo(current);
    assert.equal(contentChanged(current, draft), false);
    assert.equal(nextMemoFromDraft(current, current.id, draft, '2026-02-01T00:00:00.000Z'), current);
  });

  it('imports the previous storage shape as user tags', () => {
    const imported = legacyMemoFromUnknown({
      id: 'old',
      title: '장보기',
      content: '우유',
      tags: ['집'],
      isFavorite: false,
      isPinned: true,
      isDeleted: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    assert.equal(imported?.contentMarkdown, '우유');
    assert.deepEqual(imported?.tags, [{ name: '집', source: 'USER' }]);
  });
});

describe('related notes and merge', () => {
  it('excludes itself and deleted notes, and avoids a weak single tag', () => {
    const current = memo({ id: 'self', tags: [{ name: '부산', source: 'AI' }], aiSummary: '부산 여행' });
    const weak = memo({ id: 'weak', title: '날씨', contentMarkdown: '맑음', aiSummary: '오늘 하늘', tags: [{ name: '부산', source: 'USER' }] });
    const strong = memo({
      id: 'strong',
      title: '숙소',
      aiSummary: '부산 숙소',
      tags: [
        { name: '부산', source: 'USER' },
        { name: '숙소', source: 'AI' },
      ],
    });
    const deleted = memo({ id: 'gone', isDeleted: true, tags: [{ name: '부산', source: 'USER' }, { name: '숙소', source: 'AI' }] });
    const candidates = findTagCandidates(current, [current, weak, strong, deleted]);
    assert.deepEqual(candidates.map((item) => item.memo.id), ['strong', 'weak']);
    assert.equal(candidates.some((item) => item.memo.id === 'self'), false);
    assert.equal(candidates.some((item) => item.memo.isDeleted), false);
    assert.equal(isWorthSuggesting(candidates[0]!), true);
    assert.equal(isWorthSuggesting(candidates[1]!), false);
  });

  it('stores one undirected link and refuses duplicates', () => {
    const first = planLink([], 'b', 'a', 'rel-1', '2026-01-01T00:00:00.000Z');
    assert.equal(first?.sourceMemoId, 'a');
    assert.equal(first?.targetMemoId, 'b');
    assert.equal(planLink(first ? [first] : [], 'a', 'b', 'rel-2', '2026-01-02T00:00:00.000Z'), null);
    assert.equal(planLink([], 'a', 'a', 'rel-3', '2026-01-02T00:00:00.000Z'), null);
    assert.equal(findRelation(first ? [first] : [], 'b', 'a')?.id, 'rel-1');
  });

  it('builds a new merged note without changing the request originals', () => {
    const originals = [memo({ id: 'one', contentMarkdown: '숙소' }), memo({ id: 'two', contentMarkdown: '맛집' })];
    const snapshot = structuredClone(originals);
    const merged = buildMergedMemo({
      id: 'merged',
      title: '부산 여행',
      contentMarkdown: '# 부산 여행',
      sourceIds: ['one', 'two', 'one'],
      now: '2026-03-01T00:00:00.000Z',
    });
    assert.deepEqual(originals, snapshot);
    assert.equal(merged.memo.id, 'merged');
    assert.deepEqual(
      merged.sources.map((source) => source.sourceMemoId),
      ['one', 'two'],
    );
    const related = buildRelatedPayload(originals[0]!, [originals[1]!]);
    assert.equal(JSON.stringify(related).includes('contentMarkdown'), false);
    const mergePayload = buildMergePayload(originals);
    assert.equal(mergePayload.ok, true);
    if (mergePayload.ok) {
      assert.equal(mergePayload.body.memos[0]?.contentMarkdown, '숙소');
    }
  });
});

describe('supabase mapping', () => {
  it('maps a note without sending a caller-chosen user id', () => {
    const note: NoteRow = {
      id: '11111111-1111-4111-8111-111111111111',
      user_id: '22222222-2222-4222-8222-222222222222',
      title: '부산',
      content: '숙소',
      ai_content: '정리 초안',
      ai_status: 'draft',
      is_archived: false,
      is_pinned: true,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-02T00:00:00.000Z',
      deleted_at: null,
    };
    const mapped = memoFromNote(note, [{ name: '여행', source: 'AI' }], {
      isFavorite: true,
      lastViewedAt: null,
      analyzedContentHash: null,
      aiAnalysisStatus: 'idle',
      aiSummary: '부산 여행',
    });
    assert.equal(mapped.contentMarkdown, '숙소');
    assert.equal(mapped.isPinned, true);
    assert.equal(mapped.isFavorite, true);
    assert.equal(mapped.aiDraft, '정리 초안');
    assert.equal(mapped.aiDraftStatus, 'draft');
    assert.equal('user_id' in mapped, false);
  });

  it('keeps a manual tag when an AI tag would overwrite it and removes dropped tags', () => {
    const changes = planTagChanges(
      [
        { tagId: 'user-tag', name: '부산', source: 'user' },
        { tagId: 'ai-tag', name: '날씨', source: 'ai' },
      ],
      [
        { name: '부산', source: 'AI' },
        { name: '숙소', source: 'AI' },
      ],
    );
    assert.deepEqual(changes, [
      { type: 'remove', tagId: 'ai-tag' },
      { type: 'upsert', name: '숙소', source: 'ai' },
    ]);
  });

  it('treats rejected links as closed and still allows accepting them again', () => {
    const rejected = relationFromLink({
      id: 'link-1',
      user_id: 'user',
      note_a: 'a',
      note_b: 'b',
      status: 'rejected',
      source: 'user',
      reason: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    });
    assert.deepEqual(linkedMemoIds('a', [rejected]), []);
    assert.deepEqual(closedMemoIds('a', [rejected]), ['b']);
    const again = planLink([rejected], 'b', 'a', 'link-2', '2026-01-02T00:00:00.000Z');
    assert.equal(again?.sourceMemoId, 'a');
    assert.equal(again?.targetMemoId, 'b');
  });

  it('builds a private image path under the user id and rejects oversized files', () => {
    const path = imageStoragePath('user-1', 'file-1', 'image/png');
    assert.equal(path, 'user-1/file-1.png');
    assert.equal(path.split('/')[0], 'user-1');
    assert.throws(() => assertAllowedImage('image/png', MAX_IMAGE_BYTES + 1), /10MB/);
    assert.throws(() => assertAllowedImage('image/svg+xml', 10), /jpeg/);
  });
});

describe('ai draft', () => {
  it('rejects an empty prompt and clips a long reference memo', () => {
    assert.equal(buildDraftPayload('   ').ok, false);
    const payload = buildDraftPayload('이어서 할 일을 써 줘', '가'.repeat(MAX_DRAFT_CONTEXT_CHARS + 40));
    assert.equal(payload.ok, true);
    if (payload.ok) {
      assert.equal(payload.body.prompt, '이어서 할 일을 써 줘');
      assert.ok((payload.body.context ?? '').length <= MAX_DRAFT_CONTEXT_CHARS);
      assert.match(payload.body.context ?? '', /이하 생략/);
    }
  });

  it('reads a drafted title and body', () => {
    assert.deepEqual(parseDraftResponse({ title: '장보기', markdown: '- 계란\n- 우유' }), {
      title: '장보기',
      markdown: '- 계란\n- 우유',
    });
    assert.equal(parseDraftResponse({ title: '빈 메모', markdown: '   ' }), null);
  });
});

describe('schema', () => {
  it('creates the memo, tag, relation, source, and attachment tables', () => {
    for (const table of ['memos', 'tags', 'memo_tags', 'memo_relations', 'memo_sources', 'attachments']) {
      assert.match(MIGRATION_V1, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
    }
  });
});
