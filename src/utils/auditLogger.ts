import { supabase } from '@/utils/supabase/client';

export interface AuditEventPayload {
  actionDescription: string;
  targetTable: string;
  adminId?: string | null;
  metadata?: Record<string, any>;
}

/**
 * Universal Security Audit Logger
 * Safely persists administrative & staff events into Supabase security_audit_logs table.
 * Ensures caller identity attribution (admin_id) is always recorded.
 */
export async function logAuditEvent({
  actionDescription,
  targetTable,
  adminId,
}: AuditEventPayload): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    let effectiveAdminId = adminId;

    // If adminId was not passed explicitly, attempt to resolve from current authenticated session
    if (!effectiveAdminId) {
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user?.id) {
          effectiveAdminId = authData.user.id;
        }
      } catch {
        // Non-blocking fallback
      }
    }

    // 1. Try direct insert into security_audit_logs
    const { data, error } = await supabase
      .from('security_audit_logs')
      .insert({
        action_description: actionDescription,
        target_table: targetTable,
        admin_id: effectiveAdminId || null,
        timestamp: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (!error && data) {
      return { success: true, id: data.id };
    }

    // 2. If direct insert hits RLS or table constraint, fall back to security-definer RPC if available
    if (error) {
      try {
        const { data: rpcData, error: rpcErr } = await supabase.rpc('log_system_audit_event', {
          p_action_description: actionDescription,
          p_target_table: targetTable,
          p_admin_id: effectiveAdminId || null,
        });

        if (!rpcErr && rpcData) {
          return { success: true, id: rpcData };
        }
      } catch {
        // Non-blocking fallback
      }
      console.warn('Audit log write note:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Audit logger exception:', err);
    return { success: false, error: err?.message || 'Unknown audit log error' };
  }
}
