import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { writeJsonFile } from './io.js'
import { runReplayDiagnosis } from './replay.js'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })),
  )
})

describe('replay diagnosis', () => {
  test('classifies retrieval failures from run artifacts', async () => {
    const runDir = await mkdtemp(join(tmpdir(), 'replay-eval-'))
    tempDirs.push(runDir)

    await writeJsonFile(join(runDir, 'summary.json'), {
      mode: 'offline-retrieval',
    })
    await writeJsonFile(join(runDir, 'cases.json'), [
      {
        caseId: 'case-1',
        title: 'retrieval case',
        dataset: 'default',
        expected: {
          mustHitSkillIds: ['frontend/website-homepage-design-pro'],
          acceptableSkillIds: [],
          forbiddenSkillIds: [],
        },
        requestedModes: ['bm25_vector_graph'],
        modeResults: [
          {
            requestedMode: 'bm25_vector_graph',
            actualMode: 'bm25_vector_graph',
            degraded: false,
            degradationReason: null,
            traceId: 'trace-1',
            taskId: 'task-1',
            retrievalRoundId: 'round-1',
            firstExpectedRank: 3,
            firstAcceptableRank: null,
            forbiddenInTop3: [],
            recallAt1: 0,
            recallAt3: 1,
            recallAt5: 1,
            mrr: 0.333333,
            ndcgAt3: 0.5,
            ndcgAt5: 0.5,
            top1ExactHit: 0,
            top3AcceptableHit: 1,
            candidates: [],
          },
        ],
      },
    ])

    const replay = await runReplayDiagnosis(runDir)
    expect(replay.cases[0]?.failureCategory).toBe('R2')
  })
})
