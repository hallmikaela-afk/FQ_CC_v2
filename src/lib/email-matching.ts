/**
 * email-matching.ts
 * Smart project matching logic for incoming emails.
 * Priority: exact email → multi-signal → thread → untagged
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type MatchConfidence = 'exact' | 'high' | 'suggested' | 'thread' | null;

export interface MatchResult {
  projectId: string | null;
  confidence: MatchConfidence;
}

interface ProjectLike {
  id: string;
  type: string;
  name: string;
  client1_name: string | null;
  client2_name: string | null;
  client1_email: string | null;
  client2_email: string | null;
  venue_name: string | null;
  venue_location: string | null;
  location: string | null;
  event_date: string | null;
  photographer: string | null;
}

interface VendorLike {
  project_id: string;
  email: string | null;
}

// ─── Date normaliser helpers ──────────────────────────────────────────────────

const MONTHS: Record<string, number> = {
  january: 1, jan: 1,
  february: 2, feb: 2,
  march: 3, mar: 3,
  april: 4, apr: 4,
  may: 5,
  june: 6, jun: 6,
  july: 7, jul: 7,
  august: 8, aug: 8,
  september: 9, sep: 9, sept: 9,
  october: 10, oct: 10,
  november: 11, nov: 11,
  december: 12, dec: 12,
};

/** Extracts all (month, day) pairs found in text. */
function extractDateSignals(text: string): Array<{ month: number; day: number }> {
  const results: Array<{ month: number; day: number }> = [];
  const lower = text.toLowerCase();

  // "June 7", "June 7th", "June 7, 2026", "June 7th, 2026"
  const namedMonth = /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?/gi;
  let m: RegExpExecArray | null;
  while ((m = namedMonth.exec(lower)) !== null) {
    const month = MONTHS[m[1]];
    const day = parseInt(m[2], 10);
    if (month && day >= 1 && day <= 31) results.push({ month, day });
  }

  // Numeric: "6/7/26", "6/7/2026", "06/07/26"
  const numericDate = /\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/g;
  while ((m = numericDate.exec(text)) !== null) {
    const month = parseInt(m[1], 10);
    const day = parseInt(m[2], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) results.push({ month, day });
  }

  return results;
}

/** Returns true if any date in text matches the project's event_date (month + day). */
function dateMatchesEvent(text: string, eventDate: string | null): boolean {
  if (!eventDate) return false;
  // eventDate is "YYYY-MM-DD"
  const parts = eventDate.split('-');
  if (parts.length < 3) return false;
  const eventMonth = parseInt(parts[1], 10);
  const eventDay = parseInt(parts[2], 10);

  const signals = extractDateSignals(text);
  return signals.some(s => s.month === eventMonth && s.day === eventDay);
}

// ─── Token normaliser ─────────────────────────────────────────────────────────

/** Lower-cases and removes punctuation for fuzzy text comparison. */
function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function textContains(haystack: string, needle: string): boolean {
  if (!needle || !haystack) return false;
  return normalise(haystack).includes(normalise(needle));
}

// ─── Core matching ────────────────────────────────────────────────────────────

/**
 * Runs matching logic and returns the best project match.
 *
 * Priority order:
 * 1. Exact email match against project client emails
 * 2. Exact email match against vendor emails
 * 3. Conversation thread match (checked before calling this — caller should pass existingThreadProjectId)
 * 4. Multi-signal text match (2+ = 'high', 1 = 'suggested', venue-only = 'suggested')
 */
export async function matchEmailToProject(
  fromEmail: string,
  subject: string,
  body: string,
  conversationId: string,
  supabase: SupabaseClient,
): Promise<MatchResult> {
  const emailLower = (fromEmail ?? '').toLowerCase().trim();
  const searchText = `${subject ?? ''} ${body ?? ''}`;

  // ── 1. Load projects ──────────────────────────────────────────────────────
  const { data: projects } = await supabase
    .from('projects')
    .select(
      'id, type, name, client1_name, client2_name, client1_email, client2_email, venue_name, venue_location, location, event_date, photographer',
    )
    .in('status', ['active', 'completed']);

  if (!projects || projects.length === 0) return { projectId: null, confidence: null };

  // ── 2. Exact client email match ───────────────────────────────────────────
  for (const p of projects as ProjectLike[]) {
    if (
      (p.client1_email && p.client1_email.toLowerCase() === emailLower) ||
      (p.client2_email && p.client2_email.toLowerCase() === emailLower)
    ) {
      return { projectId: p.id, confidence: 'exact' };
    }
  }

  // ── 3. Exact vendor email match ───────────────────────────────────────────
  if (emailLower) {
    const { data: vendors } = await supabase
      .from('vendors')
      .select('project_id, email')
      .ilike('email', emailLower);

    if (vendors && vendors.length > 0) {
      const vendor = vendors[0] as VendorLike;
      return { projectId: vendor.project_id, confidence: 'exact' };
    }
  }

  // ── 4. Thread match ───────────────────────────────────────────────────────
  if (conversationId) {
    const { data: threadEmails } = await supabase
      .from('emails')
      .select('project_id, match_confidence')
      .eq('conversation_id', conversationId)
      .not('project_id', 'is', null)
      .limit(1);

    if (threadEmails && threadEmails.length > 0 && threadEmails[0].project_id) {
      return { projectId: threadEmails[0].project_id, confidence: 'thread' };
    }
  }

  // ── 5. Multi-signal text match ────────────────────────────────────────────
  let bestProject: ProjectLike | null = null;
  let bestScore = 0;
  let bestVenueOnly = false;

  for (const p of projects as ProjectLike[]) {
    let score = 0;
    let venueSignalOnly = false;
    const signals: string[] = [];

    // Photographer email match (for shoots)
    if (p.type === 'shoot' && p.photographer && emailLower === p.photographer.toLowerCase()) {
      score += 2;
      signals.push('photographer-email');
    }

    // Client names
    if (p.client1_name && textContains(searchText, p.client1_name)) {
      score += 1;
      signals.push('client1-name');
    }
    if (p.client2_name && textContains(searchText, p.client2_name)) {
      score += 1;
      signals.push('client2-name');
    }

    // Project name (for shoots)
    if (p.type === 'shoot' && textContains(searchText, p.name)) {
      score += 1;
      signals.push('project-name');
    }

    // Venue / location signals
    const venueScore =
      (p.venue_name && textContains(searchText, p.venue_name) ? 1 : 0) +
      (p.venue_location && textContains(searchText, p.venue_location) ? 1 : 0) +
      (p.location && textContains(searchText, p.location) ? 1 : 0);

    if (venueScore > 0) {
      signals.push('venue');
      // If venue is the ONLY signal so far, mark it — venue-only should never auto-tag
      if (score === 0) venueSignalOnly = true;
    }
    score += Math.min(venueScore, 1); // cap venue contribution at 1 to avoid over-weighting

    // Date signal
    if (dateMatchesEvent(searchText, p.event_date)) {
      score += 1;
      signals.push('date');
      venueSignalOnly = false; // date breaks venue-only restriction
    }

    if (score > bestScore) {
      bestScore = score;
      bestProject = p;
      bestVenueOnly = venueSignalOnly && signals.length === 1 && signals[0] === 'venue';
    }
  }

  if (!bestProject || bestScore === 0) return { projectId: null, confidence: null };

  // Venue-only → suggested (never auto-tag)
  if (bestVenueOnly) {
    return { projectId: bestProject.id, confidence: 'suggested' };
  }

  // 2+ signals → high (auto-tag), 1 signal → suggested
  if (bestScore >= 2) {
    return { projectId: bestProject.id, confidence: 'high' };
  }

  return { projectId: bestProject.id, confidence: 'suggested' };
}
