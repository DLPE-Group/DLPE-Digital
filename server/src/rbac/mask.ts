// Lifted verbatim from app/src/admin_rbac.jsx `maskValue`.
// Phase 2 wires this into response filtering; Phase 1 only lifts it.

export function maskValue(fieldId: string, val: string): string {
  if (fieldId === 'bank_account') return '•••• •••• •••• ' + val.slice(-4);
  if (fieldId === 'sales_rep' || fieldId === 'account_mgr') {
    return val.split(/\s+/).map((s) => s[0]).join('.').toUpperCase() + '.';
  }
  if (/value|fee|cost|amount|margin|balance|limit/.test(fieldId)) return '€XXX,XXX';
  return val.replace(/[A-Za-z0-9]/g, 'X');
}
