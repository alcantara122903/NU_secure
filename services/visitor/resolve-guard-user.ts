/**
 * Resolve the logged-in guard's users.user_id for visit.guard_user_id.
 * App login uses custom `users` + authSession (not Supabase Auth / guard_user).
 */

import { authSessionService } from '../auth-session';
import { supabase } from '../database/supabase';

/**
 * Returns users.user_id for the current guard session, or null.
 */
export async function resolveLoggedInGuardUserId(): Promise<number | null> {
  const fromSession = authSessionService.getCurrentUserId();
  if (fromSession != null && Number.isFinite(fromSession)) {
    console.log(`✅ Guard user_id from session: ${fromSession}`);
    return fromSession;
  }

  // Fallback: look up public.users by session email (schema has users, not guard_user)
  const email =
    authSessionService.getSession()?.userProfile?.email?.trim() ||
    authSessionService.getSession()?.user?.email?.trim() ||
    null;

  if (!email) {
    console.warn('⚠️ No logged-in user in auth session — guard_user_id will be null');
    return null;
  }

  const { data: row, error } = await supabase
    .from('users')
    .select('user_id')
    .ilike('email', email)
    .maybeSingle();

  if (error) {
    console.warn('⚠️ users lookup failed:', error.message);
    return null;
  }

  if (row?.user_id != null) {
    console.log(`✅ Guard user_id from users table: ${row.user_id}`);
    return Number(row.user_id);
  }

  console.warn(`⚠️ No users row for email: ${email}`);
  return null;
}

/**
 * Optional default exit_status for a new visit (still on campus / not exited).
 * exit_status_id is normally set on exit; this only fills a sensible entry default if seeded.
 */
export async function resolveDefaultEntryExitStatusId(): Promise<number | null> {
  try {
    const { data: rows } = await supabase
      .from('exit_status')
      .select('exit_status_id, exit_status_name')
      .order('exit_status_id', { ascending: true });

    if (!rows?.length) return null;

    const preferred = rows.find((r) => {
      const name = String(r.exit_status_name ?? '').toLowerCase();
      return (
        name.includes('inside') ||
        name.includes('active') ||
        name.includes('on campus') ||
        name.includes('not exit') ||
        name.includes('pending') ||
        name.includes('open')
      );
    });

    return preferred?.exit_status_id ?? null;
  } catch {
    return null;
  }
}
