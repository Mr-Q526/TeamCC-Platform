import type { FastifyInstance } from 'fastify'
import { db } from '../db/index.js'
import { auditLog } from '../db/schema.js'
import { JWT_SECRET, requireActiveUserById } from '../services/auth.js'
import crypto from 'crypto'

type ClientAuditEventType =
  | 'boot'
  | 'login'
  | 'logout'
  | 'exit'
  | 'bash_command'
  | 'file_write'
  | 'command_execution_error'
  | 'permission_allow'
  | 'permission_ask'
  | 'permission_deny'
  | 'policy_violation'

type ClientAuditTargetType =
  | 'session'
  | 'command'
  | 'file'
  | 'tool'
  | 'policy'

type AuditSeverity = 'info' | 'warning' | 'critical'

/**
 * Verify JWT token and extract userId + username
 */
function verifyAuditToken(token: string): { userId: number; username: string } {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Invalid JWT format')

  const [header, payload, signature] = parts
  const message = header + '.' + payload

  const expectedSignature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(message)
    .digest('base64url')

  if (signature !== expectedSignature) throw new Error('Invalid token signature')

  const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'))
  const now = Math.floor(Date.now() / 1000)
  if (decoded.exp && decoded.exp < now) throw new Error('Token expired')

  return { userId: decoded.userId, username: decoded.username }
}

/**
 * Dangerous bash command patterns
 */
const DANGEROUS_PATTERNS = [
  /\bsudo\b/i,
  /\bchown\b/i,
  /\bchmod\b/i,
  /\brm\s+-rf/i,
  /\bssh\s+-i/i,
  /\bssh-keygen/i,
  /\bkill\s+-9/i,
  /\bdd\s+if=/i,
  /\bfdisk/i,
  /\bparted\b/i,
]

function isDangerousCommand(command: string): boolean {
  return DANGEROUS_PATTERNS.some((p) => p.test(command))
}

function severityRank(severity: AuditSeverity): number {
  return severity === 'critical' ? 3 : severity === 'warning' ? 2 : 1
}

function normalizeTargetType(
  eventType: ClientAuditEventType,
  targetType?: ClientAuditTargetType,
): ClientAuditTargetType {
  if (targetType) return targetType

  switch (eventType) {
    case 'boot':
    case 'login':
    case 'logout':
    case 'exit':
      return 'session'
    case 'bash_command':
    case 'command_execution_error':
      return 'command'
    case 'file_write':
      return 'file'
    case 'permission_allow':
    case 'permission_ask':
    case 'permission_deny':
      return 'tool'
    case 'policy_violation':
      return 'policy'
  }
}

function inferSeverity(
  eventType: ClientAuditEventType,
  details: Record<string, unknown>,
  requestedSeverity?: AuditSeverity,
): AuditSeverity {
  let inferred: AuditSeverity = 'info'

  switch (eventType) {
    case 'boot':
    case 'login':
    case 'logout':
    case 'exit':
    case 'bash_command':
    case 'file_write':
    case 'permission_allow':
      inferred = 'info'
      break
    case 'command_execution_error':
    case 'permission_ask':
      inferred = 'warning'
      break
    case 'policy_violation':
      inferred = 'critical'
      break
    case 'permission_deny': {
      const toolName = String(details.toolName || details.tool || '')
      inferred = ['Edit', 'Write', 'Bash', 'WebFetch', 'WebSearch', 'NotebookEdit'].includes(toolName)
        ? 'critical'
        : 'warning'
      break
    }
  }

  if (!requestedSeverity) return inferred
  return severityRank(requestedSeverity) > severityRank(inferred) ? requestedSeverity : inferred
}

/**
 * Send alert to Feishu/DingTalk webhook
 */
async function sendSecurityAlert(
  userId: number,
  username: string,
  command: string,
  eventTime: string
): Promise<void> {
  const webhookUrl = process.env.FEISHU_WEBHOOK_URL || process.env.DINGTALK_WEBHOOK_URL
  if (!webhookUrl) {
    console.warn('[audit] No webhook URL configured for security alerts')
    return
  }

  const body = {
    msgtype: 'text',
    text: {
      content: `🚨 危险操作告警\n用户: ${username} (ID: ${userId})\n命令: ${command}\n时间: ${eventTime}`,
    },
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) console.error(`[audit] Webhook responded ${res.status}`)
  } catch (err) {
    console.error('[audit] Failed to send security alert:', err)
  }
}

export async function registerAuditRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/audit
   * Receive audit events from TeamCC client and write into the shared audit_log table.
   * Requires: Authorization: Bearer <accessToken>
   */
  fastify.post<{
    Body: {
      timestamp: string
      userId: number
      departmentId?: number
      eventType: ClientAuditEventType
      targetType?: ClientAuditTargetType
      details: Record<string, unknown>
      severity?: AuditSeverity
    }
  }>('/api/audit', async (request, reply) => {
    try {
      // ── 1. Auth ──────────────────────────────────────────────────────
      const authHeader = request.headers.authorization
      if (!authHeader?.startsWith('Bearer ')) {
        return reply.status(401).send({ error: 'Missing or invalid authorization header' })
      }
      const tokenData = verifyAuditToken(authHeader.slice(7))

      // ── 2. userId consistency check (防止仿冒上报) ────────────────────
      if (tokenData.userId !== request.body.userId) {
        return reply.status(401).send({ error: 'User ID mismatch' })
      }

      // ── 3. Verify user exists ─────────────────────────────────────────
      await requireActiveUserById(tokenData.userId)

      // ── 4. Persist into shared audit_log ─────────────────────────────
      const { timestamp, userId, eventType, targetType, details, severity } = request.body
      const resolvedSeverity = inferSeverity(eventType, details, severity)
      const auditDetails = {
        ...details,
        severity: resolvedSeverity,
      }
      await db.insert(auditLog).values({
        actorUserId: userId,
        action: eventType,
        targetType: normalizeTargetType(eventType, targetType),
        targetId: null,
        beforeJson: null,
        afterJson: JSON.stringify(auditDetails),
        createdAt: new Date(timestamp),
      })

      // ── 5. Security alerts ────────────────────────────────────────────
      // 危险命令检测
      if (eventType === 'bash_command' && details.command) {
        const cmd = String(details.command)
        if (isDangerousCommand(cmd)) {
          void sendSecurityAlert(userId, tokenData.username, cmd, timestamp)
        }
      }

      // 策略违反告警
      if (eventType === 'policy_violation' && resolvedSeverity === 'critical') {
        const policy = String(details.policy || 'unknown')
        const tool = String(details.tool || 'unknown')
        void sendSecurityAlert(userId, tokenData.username, `Policy violation: ${tool} - ${policy}`, timestamp)
      }

      if (eventType === 'permission_deny' && resolvedSeverity === 'critical') {
        const toolName = String(details.toolName || details.tool || 'unknown')
        const target = String(details.target || details.command || 'unknown')
        void sendSecurityAlert(userId, tokenData.username, `Permission denied: ${toolName} - ${target}`, timestamp)
      }

      return reply.status(202).send({ ok: true })
    } catch (err) {
      const msg = (err as Error).message
      console.error('[audit] POST /api/audit error:', msg)

      if (msg.includes('Invalid') || msg.includes('expired') || msg.includes('mismatch')) {
        return reply.status(401).send({ error: msg })
      }
      return reply.status(400).send({ error: msg })
    }
  })
}
