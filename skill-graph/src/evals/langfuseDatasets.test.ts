import { describe, expect, test } from 'bun:test'
import {
  buildRetrievalDatasetItem,
  createLangfuseDatasetItemFingerprint,
  isLangfuseDatasetItemEquivalent,
  mapLangfuseDatasetItemToRetrievalCase,
} from './langfuseDatasets.js'
import type { SkillRetrievalEvalCase } from './types.js'

const retrievalCase: SkillRetrievalEvalCase = {
  schemaVersion: '2026-04-12',
  caseType: 'retrieval',
  caseId: 'retrieval_frontend_homepage_brand_001',
  title: '品牌官网首页前端设计',
  dataset: 'retrieval-v1',
  tags: ['frontend', 'homepage'],
  query: {
    queryText: '品牌官网首页homepage前端设计',
    queryContext: 'marketing landing homepage hero',
    cwd: '/tmp/skill-eval',
    department: 'dept:frontend-platform',
    domainHints: ['frontend'],
    sceneHints: ['scene:homepage'],
    priorInjectedSkillIds: [],
    priorInvokedSkillIds: [],
    limit: 5,
  },
  expected: {
    mustHitSkillIds: ['frontend/website-homepage-design-pro'],
    acceptableSkillIds: ['frontend/website-homepage-design'],
    forbiddenSkillIds: ['tools/spreadsheet'],
  },
  modeOverrides: null,
}

describe('langfuse dataset item mapping', () => {
  test('builds retrieval dataset item with stable sync hash', () => {
    const item = buildRetrievalDatasetItem(retrievalCase)
    expect(item.input.queryText).toBe(retrievalCase.query.queryText)
    expect(item.expectedOutput.mustHitSkillIds).toEqual(
      retrievalCase.expected.mustHitSkillIds,
    )
    expect(item.metadata.caseId).toBe(retrievalCase.caseId)
    expect(typeof item.metadata.syncHash).toBe('string')
    expect(String(item.metadata.syncHash).length).toBe(64)
  })

  test('detects equivalent remote dataset item', () => {
    const local = buildRetrievalDatasetItem(retrievalCase)
    const remote = {
      id: 'item-1',
      datasetId: 'dataset-1',
      datasetName: 'skill-graph-retrieval-cases-v1',
      input: local.input,
      expectedOutput: local.expectedOutput,
      metadata: local.metadata,
    }

    expect(isLangfuseDatasetItemEquivalent(local, remote)).toBe(true)
  })

  test('fingerprint changes when expected output changes', () => {
    const local = buildRetrievalDatasetItem(retrievalCase)
    const baseline = createLangfuseDatasetItemFingerprint({
      input: local.input,
      expectedOutput: local.expectedOutput,
      metadata: {
        caseId: local.metadata.caseId,
        title: local.metadata.title,
        dataset: local.metadata.dataset,
        tags: local.metadata.tags,
        schemaVersion: local.metadata.schemaVersion,
        caseType: local.metadata.caseType,
        source: local.metadata.source,
      },
    })
    const changed = createLangfuseDatasetItemFingerprint({
      input: local.input,
      expectedOutput: {
        ...local.expectedOutput,
        mustHitSkillIds: ['frontend/website-homepage-design-basic'],
      },
      metadata: {
        caseId: local.metadata.caseId,
        title: local.metadata.title,
        dataset: local.metadata.dataset,
        tags: local.metadata.tags,
        schemaVersion: local.metadata.schemaVersion,
        caseType: local.metadata.caseType,
        source: local.metadata.source,
      },
    })

    expect(changed).not.toBe(baseline)
  })

  test('maps Langfuse dataset item back to retrieval case', () => {
    const remote = buildRetrievalDatasetItem(retrievalCase)
    const mapped = mapLangfuseDatasetItemToRetrievalCase({
      id: 'item-1',
      datasetId: 'dataset-1',
      datasetName: 'skill-graph-retrieval-cases-v1',
      input: remote.input,
      expectedOutput: remote.expectedOutput,
      metadata: remote.metadata,
    })
    expect(mapped.caseId).toBe(retrievalCase.caseId)
    expect(mapped.title).toBe(retrievalCase.title)
    expect(mapped.expected.mustHitSkillIds).toEqual(
      retrievalCase.expected.mustHitSkillIds,
    )
    expect(mapped.query.queryText).toBe(retrievalCase.query.queryText)
  })
})
