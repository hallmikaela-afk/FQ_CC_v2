# FQ Microsoft Graph Skill

Read this before making ANY changes that touch 
Microsoft Graph API, Outlook, or email sending.

---

## The Golden Rule

Never write a raw `fetch()` call to Graph API.
Always use the `graphFetch` wrapper in 
`src/lib/microsoft-graph.ts`.
```typescript
// CORRECT
import { graphFetch } from '@/lib/microsoft-graph';
const data = await graphFetch('/me/messages', {}, userId);

// WRONG — never do this
const res = await fetch('https://graph.microsoft.com/v1.0/me/messages', {
  headers: { Authorization: `Bearer ${token}` }
});
```

---

## graphFetch Wrapper

Location: `src/lib/microsoft-graph.ts`

What it does automatically:
- Gets a valid token via `getValidToken()`
- Refreshes token if within 5 minutes of expiry
- On 401: forces a token refresh and retries once
- Handles 204/202 empty responses correctly
- Throws typed errors: `NOT_CONNECTED`, `GRAPH_ERROR_${status}`

Signature:
```typescript
graphFetch(path: string, options?: RequestInit, userId?: string)
```

Always pass the full path starting with `/`:
```typescript
await graphFetch('/me/messages', {}, 'default');
await graphFetch('/me/mailFolders/inbox/childFolders', {}, 'default');
```

---

## Token Management

Tokens are stored in Supabase `microsoft_tokens` table.
- `user_id` = 'default' (single user for now)
- `access_token` — expires every ~60 minutes
- `refresh_token` — valid for 90 days
- `expires_at` — ISO timestamp

`getValidToken()` handles refresh automatically.
`forceTokenRefresh()` is called on 401 responses.

Never read tokens directly from Supabase in a 
feature route — always go through `getValidToken()`.

---

## Error Handling

Always catch these specific errors:
```typescript
try {
  const data = await graphFetch('/me/messages', {});
} catch (err) {
  if (err instanceof Error) {
    if (err.message === 'NOT_CONNECTED') {
      // User needs to reconnect Outlook
      return NextResponse.json({ error: 'NOT_CONNECTED' }, { status: 401 });
    }
    if (err.message.includes('GRAPH_ERROR_429')) {
      // Rate limited — back off and retry
    }
    if (err.message.includes('GRAPH_ERROR_5')) {
      // Microsoft server error — temporary
    }
  }
}
```

---

## Moving Emails Between Folders
```typescript
import { moveMessage } from '@/lib/microsoft-graph';
await moveMessage(messageId, destinationFolderId, userId);
```

The destination must be a folder ID (not a name).
Folder IDs are stored in `mail_folders.folder_id` 
and `projects.outlook_folder_id` in Supabase.

---

## Sending Email
```typescript
import { graphFetch } from '@/lib/microsoft-graph';

// Send new email
await graphFetch('/me/sendMail', {
  method: 'POST',
  body: JSON.stringify({
    message: {
      subject: 'Subject here',
      body: { contentType: 'HTML', content: htmlBody },
      toRecipients: [{ emailAddress: { address: 'to@email.com' } }]
    }
  })
});

// Reply to existing email — use sendReply helper
import { sendReply } from '@/lib/microsoft-graph';
await sendReply(messageId, replyBodyHtml, userId, cc, bcc);
```

Always send HTML emails with the Optima font stack.
Always append the signature from `src/lib/emailSignature.ts`.

---

## Creating Outlook Folders
```typescript
import { createChildFolder } from '@/lib/microsoft-graph';

// Create subfolder under inbox
const folder = await createChildFolder('inbox', 'Julia & Frank', userId);
// Returns GraphFolder with folder.id — store in projects.outlook_folder_id
```

Naming convention for client folders: `{n} - {project name}`
where n is the next available number.

---

## Fetching Folders
```typescript
import { fetchAllFolders, fetchChildFolders } from '@/lib/microsoft-graph';

// All top-level + one level of children
const folders = await fetchAllFolders(userId);

// Children of a specific folder
const children = await fetchChildFolders(parentFolderId, userId);
```

---

## Rate Limits

Microsoft Graph allows ~4 requests/second.
Folder fetches run in parallel batches of 5 (`FOLDER_BATCH`).
Email upserts run in parallel batches of 10 (`SYNC_BATCH`).
Do not increase these limits.

---

## API Timeout

Email sync routes use `maxDuration = 300` on Vercel Pro.
All other Graph routes use `maxDuration = 60`.
Always set `export const dynamic = 'force-dynamic'` 
on any route that calls Graph API.

---

## The userId Convention

All functions default to `userId = 'default'`.
This is intentional — single user app.
When Phase 13 (team access) is built, replace 
'default' with the Supabase auth user ID.
