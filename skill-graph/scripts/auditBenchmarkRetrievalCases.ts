import { mkdir } from 'fs/promises'
import { dirname, join, resolve } from 'path'
import {
  auditBenchmarkCases,
  BENCHMARK_DIFFICULTY_TARGETS,
  BENCHMARK_DOMAIN_TARGETS,
  BENCHMARK_LANGUAGE_TARGETS,
  BENCHMARK_REVIEW_SAMPLE_SIZE,
  buildBenchmarkReviewSample,
} from '../src/evals/benchmarkAudit.js'
import { listEvalCases, loadEvalCase, writeJsonFile } from '../src/evals/io.js'
import { getBenchmarkCasesDir, getEvalRoot } from '../src/evals/retrievalDatasets.js'
import { readGeneratedSkillRegistry } from '../src/registry/registry.js'
import type { SkillRetrievalEvalCase } from '../src/evals/types.js'

type CliOptions = {
  casesDir: string
  summaryPath: string
  reviewSamplePath: string
  skipQuota: boolean
}

const PROJECT_ROOT = resolve(process.cwd())

function parseArgs(argv: string[]): CliOptions {
  const evalRoot = getEvalRoot(PROJECT_ROOT)
  const options: CliOptions = {
    casesDir: getBenchmarkCasesDir(PROJECT_ROOT),
    summaryPath: join(evalRoot, 'reports', 'retrieval-benchmark-v1-audit-summary.json'),
    reviewSamplePath: join(evalRoot, 'reports', 'retrieval-benchmark-v1-review-sample.json'),
    skipQuota: false,
  }

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]
    const next = argv[index + 1]
    if (arg === '--cases-dir' && next) {
      options.casesDir = resolve(next)
      index += 1
    } else if (arg === '--summary-path' && next) {
      options.summaryPath = resolve(next)
      index += 1
    } else if (arg === '--review-sample-path' && next) {
      options.reviewSamplePath = resolve(next)
      index += 1
    } else if (arg === '--skip-quota') {
      options.skipQuota = true
    }
  }

  return options
}

function assertCounts(
  actual: Record<string, number>,
  expected: Record<string, number>,
  label: string,
): string[] {
  const issues: string[] = []
  for (const [key, count] of Object.entries(expected)) {
    const actualCount = actual[key] ?? 0
    if (actualCount !== count) {
      issues.push(`${label} ${key} expected ${count}, got ${actualCount}`)
    }
  }
  return issues
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  const registry = await readGeneratedSkillRegistry(join(PROJECT_ROOT, 'skills-flat'))
  if (!registry) {
    throw new Error('Missing skill registry at skills-flat/skill-registry.json')
  }

  const files = await listEvalCases(options.casesDir)
  const loaded = await Promise.all(files.map(loadEvalCase))
  const cases = loaded.filter(
    (item): item is SkillRetrievalEvalCase => item.caseType === 'retrieval',
  )

  const summary = auditBenchmarkCases({
    cases,
    registryById: new Map(registry.skills.map(skill => [skill.skillId, skill] as const)),
  })

  const quotaIssues = options.skipQuota
    ? []
    : [
        ...assertCounts(summary.byDomain, BENCHMARK_DOMAIN_TARGETS, 'domain'),
        ...assertCounts(summary.byDifficulty, BENCHMARK_DIFFICULTY_TARGETS, 'difficulty'),
        ...assertCounts(summary.byLanguage, BENCHMARK_LANGUAGE_TARGETS, 'language'),
      ]

  const auditSummary = {
    ...summary,
    quotaIssues,
  }

  const reviewSample = buildBenchmarkReviewSample(cases, BENCHMARK_REVIEW_SAMPLE_SIZE).map(
    item => ({
      caseId: item.caseId,
      title: item.title,
      dataset: item.dataset,
      tags: item.tags,
      queryText: item.query.queryText,
      expected: item.expected,
    }),
  )

  await mkdir(dirname(options.summaryPath), { recursive: true })
  await writeJsonFile(options.summaryPath, auditSummary)
  await writeJsonFile(options.reviewSamplePath, {
    sampleSize: reviewSample.length,
    sample: reviewSample,
  })

  console.log(
    JSON.stringify(
      {
        caseCount: summary.caseCount,
        issueCount: summary.issueCount,
        quotaIssueCount: quotaIssues.length,
        summaryPath: options.summaryPath,
        reviewSamplePath: options.reviewSamplePath,
      },
      null,
      2,
    ),
  )

  if (summary.issueCount > 0 || quotaIssues.length > 0) {
    throw new Error('Benchmark audit failed')
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
