export function canManageMembers(roles: readonly string[]): boolean {
  return roles.some((role) => ['TENANT_ADMIN', 'SECRETARY', 'TREASURER'].includes(role));
}

export function canManageAllMemberFields(roles: readonly string[]): boolean {
  return roles.includes('TENANT_ADMIN') || roles.includes('SECRETARY');
}
