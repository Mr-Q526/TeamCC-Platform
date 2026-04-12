import type { FastifyInstance } from 'fastify'
import { db } from '../db/index.js'
import { auditLog, users } from '../db/schema.js'
import { eq, desc, sql, and } from 'drizzle-orm'
import { JWT_SECRET } from '../services/auth.js'
import crypto from 'crypto'

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
      eventType: 'boot' | 'login' | 'logout' | 'bash_command' | 'file_write' | 'command_execution_error' | 'tool_access' | 'policy_violation'
      details: Record<string, unknown>
      severity?: 'info' | 'warning' | 'critical'
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
      const user = await db.select().from(users).where(eq(users.id, tokenData.userId)).limit(1).then((r) => r[0])
      if (!user) return reply.status(401).send({ error: 'User not found' })

      // ── 4. Persist into shared audit_log ─────────────────────────────
      const { timestamp, userId, eventType, details, severity } = request.body
      const auditDetails = {
        ...details,
        severity: severity || 'info',
      }
      await db.insert(auditLog).values({
        actorUserId: userId,
        action: eventType,
        targetType: 'cli_event',
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
      if (eventType === 'policy_violation' && severity === 'critical') {
        const policy = String(details.policy || 'unknown')
        const tool = String(details.tool || 'unknown')
        void sendSecurityAlert(userId, tokenData.username, `Policy violation: ${tool} - ${policy}`, timestamp)
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
