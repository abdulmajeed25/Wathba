# Wathba — the Agent Contract (OPS Part 4)

This document is for whoever builds the first AI operator. **No LLM ships in
this batch** — what ships is the contract that makes an agent possible and
safe. Everything below is enforced **server-side**; nothing relies on a
prompt behaving.

## What an agent is

A first-class principal (`AgentAccount`) with a **role** from the same RBAC
matrix as human teammates (`OpsRole`), created and managed only through
governed operations (`agents.create`, `agents.set-active`,
`agents.token.rotate` — SENSITIVE tier, permission `agents.manage`, OWNER by
default). Least privilege is structural:

- An agent **can never hold OWNER** — refused as a precondition on creation.
- No role — not even one holding `money.execute` — lets an agent execute
  money. The registry refuses `actorType=AGENT` + `riskTier=MONEY` **before
  permissions are consulted**.

## Authentication

- Opaque service token, shown **once** at create/rotate (`wagent_…`); only
  its SHA-256 is stored. TTL 24h; rotate from «الوكلاء» in the ops center.
- Send it as the `x-agent-token` header against `/v1/ops/operations/*`.
  That surface is the **only** one that accepts agent tokens: ops auth,
  proposal decisioning, the audit browser and every other admin surface are
  human-session-only.
- **Kill switch:** `AGENTS_ENABLED=false` (or `0`) refuses every agent token
  instantly, at the guard, before any lookup.
- Per-agent rate limit: `AGENT_RATE_LIMIT_PER_MIN` (default 60).

## The capability manifest

`GET /v1/ops/operations` returns every operation: `key`, `titleAr`,
`descriptionAr`, `inputSchema` (JSON Schema), `riskTier`, `permission`,
`reversible`, `compensatingKey`, `requiresReason`. This doubles as a tool
manifest for an MCP-style server — one tool per operation, schema included.

## What an agent may do, by tier

| Tier | dryRun | execute | propose |
|---|---|---|---|
| CONTENT | ✅ | ✅ **only after a fresh matching dryRun** | — |
| STANDARD | ✅ | ✅ **only after a fresh matching dryRun** | — |
| SENSITIVE | ✅ | ❌ refused, always | ✅ a human executes from the queue |
| MONEY | ✅ | ❌ refused, always, role-ignored | ✅ into the four-eyes queue |

- **No blind writes:** an agent `execute` requires a preceding **successful**
  `dry-run` whose canonical `inputHash` matches, within 15 minutes. The
  ledger is the `AgentDryRun` table — durable, not in-memory.
- **Propose:** `POST /v1/ops/operations/:key/propose` (SENSITIVE/MONEY only,
  written reason ≥ 10 chars, permission still required). The dryRun snapshot
  is attached to the proposal; a human with `money.approve` (money) or the
  operation's own permission (sensitive) executes it — **an agent can never
  be the second pair of eyes**, and self-approval is refused for everyone.

## Audit

Every agent call lands on the hash-chained, append-only audit log with
`actorType=AGENT` and `agentId` — same chain, same immutability, same
browser («سجل التدقيق», filter الفاعل → وكيل) as human actions.

## Building the operator (later)

1. Create the agent in «الوكلاء» with the narrowest role that works
   (CONTENT_EDITOR or REVIEWER to start). Store the token in a secret
   manager; schedule rotation.
2. Generate one tool per manifest entry; validate inputs against
   `inputSchema` client-side, but expect the server to re-validate.
3. Teach the loop the tier protocol: always dryRun → show/log the preview →
   execute (CONTENT/STANDARD) or propose (SENSITIVE/MONEY).
4. Treat `403` bodies as protocol, not errors: they carry the Arabic reason
   (missing dryRun, tier refusal, rate limit, kill switch).
5. Before connecting anything: review this file, enable TOTP for every human
   approver, and decide `AGENT_RATE_LIMIT_PER_MIN` + `AGENTS_ENABLED`
   posture for production.
