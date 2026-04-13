import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { LangfuseEvalClient } from './langfuse.js'

const originalEnv = {
  LANGFUSE_HOST: process.env.LANGFUSE_HOST,
  LANGFUSE_PUBLIC_KEY: process.env.LANGFUSE_PUBLIC_KEY,
  LANGFUSE_SECRET_KEY: process.env.LANGFUSE_SECRET_KEY,
}

describe('langfuse eval client', () => {
  beforeEach(() => {
    process.env.LANGFUSE_HOST = 'https://langfuse.example.com'
    process.env.LANGFUSE_PUBLIC_KEY = 'pk-test'
    process.env.LANGFUSE_SECRET_KEY = 'sk-test'
  })

  afterEach(() => {
    process.env.LANGFUSE_HOST = originalEnv.LANGFUSE_HOST
    process.env.LANGFUSE_PUBLIC_KEY = originalEnv.LANGFUSE_PUBLIC_KEY
    process.env.LANGFUSE_SECRET_KEY = originalEnv.LANGFUSE_SECRET_KEY
  })

  test('records trace and scores via fetch', async () => {
    const fetchMock = mock(async () =>
      new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }),
    )
    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchMock as typeof fetch

    try {
      const client = LangfuseEvalClient.fromEnv()
      expect(client).not.toBeNull()

      const result = await client!.recordTrace({
        metadata: {
          runId: 'run-1',
          mode: 'offline-retrieval',
          caseId: 'case-1',
          traceId: 'trace-1',
          taskId: 'task-1',
          retrievalRoundId: 'round-1',
          requestedMode: 'bm25_vector_graph',
          actualMode: 'bm25_vector_graph',
          skillId: 'frontend/website-homepage-design-pro',
          skillVersion: '0.1.0',
          sourceHash: 'sha256:test',
          registryVersion: 'sha256:registry',
          embeddingsGeneratedAt: '2026-04-12T00:00:00.000Z',
          retrievalFeaturesGeneratedAt: '2026-04-12T00:00:00.000Z',
        },
        input: { query: 'homepage' },
        output: { rank: 1 },
        spans: [
          {
            name: 'retrieval',
            startedAt: '2026-04-12T00:00:00.000Z',
            endedAt: '2026-04-12T00:00:01.000Z',
            metadata: { actualMode: 'bm25_vector_graph' },
          },
        ],
        scores: [
          { name: 'Recall@3（召回率）', value: 1 },
          { name: 'MRR（倒数排名均值）', value: 1 },
        ],
      })

      expect(result.observationCount).toBe(2)
      expect(result.scoreCount).toBe(2)
      expect(fetchMock).toHaveBeenCalledTimes(3)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
