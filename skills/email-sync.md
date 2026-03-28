# FQ Email Sync Skill

Read this before making ANY changes to inbox, 
email sync, or email matching features.

---

## The Sync Pipeline

Every email goes through this exact pipeline:

1. Fetch from Microsoft Graph API (via `graphFetch`)
2. Run receipt detection (`detectReceipt`)
3. Run project matching (`matchEmailToProject`)
4. Upsert to Supabase `emails` table
5. If project matched + outlook_folder_id exists → move in Outlook

Never skip steps. Never bypass `upsertBatch`.

---

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/microsoft-graph.ts` | All Graph API calls — use `graphFetch` wrapper always |
| `src/lib/email-matching.ts` | Smart project matching — do not modify without reading fully |
| `src/lib/email-sync-helpers.ts` | `upsertBatch`, `buildSyncContext`, `detectReceipt` |
| `src/app/api/emails/route.ts` | Main GET/PATCH/DELETE endpoint |
| `src/app/api/emails/initial-sync/route.ts` | 90-day history load with SSE progress |
| `src/app/api/emails/load-more/route.ts` | Pagination beyond 90 days |

---

## The PreloadedMatchData Pattern

Always use preloaded context when processing 
multiple emails in bulk. Never query Supabase 
inside a per-email loop.
```typescript
