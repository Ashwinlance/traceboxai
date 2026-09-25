export interface AuditEntry {
  id: string;
  parcelId: string;
  actor: string;
  action: string;
  detail: string;
  at: string;
}

export function makeAudit(parcelId: string, actor: string, action: string, detail: string): AuditEntry {
  return { id: `${parcelId}-${Date.now()}-${actor}-${action}`, parcelId, actor, action, detail, at: new Date().toISOString() };
}
