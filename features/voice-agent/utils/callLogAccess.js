function parseCapabilities(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);
  }
  return [];
}

function getUserPermissionKeys(user) {
  // Some APIs call these "capabilities", others return tenant feature keys
  // in "tenantFeatures" (or similar). We merge them so access logic works
  // regardless of which shape the caller provides.
  const merged = [
    ...parseCapabilities(user?.capabilities),
    ...parseCapabilities(user?.tenantFeatures),
    ...parseCapabilities(user?.tenant_features),
    ...parseCapabilities(user?.tenantFeatureKeys),
  ];

  return Array.from(new Set(merged.filter(Boolean)));
}

function canViewAllCallLogs(user) {
  const keys = getUserPermissionKeys(user);

  // Explicit "view all" permissions always win.
  if (keys.includes('viewAll') || keys.includes('leads_view_all')) return true;

  // If the user is assigned-only, do NOT treat owner/admin as view-all.
  // This matches: "even if owner, if leads_view_assigned then only show initiated_by_user_id".
  if (keys.includes('leads_view_assigned')) return false;

  const role = String(user?.role || '').toLowerCase();
  return role === 'admin' || role === 'owner';
}

function shouldRestrictToInitiator(user) {
  if (!user?.id) return false;
  const keys = getUserPermissionKeys(user);

  // If user can view all, never restrict.
  if (keys.includes('viewAll') || keys.includes('leads_view_all')) return false;

  // Restrict whenever the user is assigned-only, regardless of role.
  return keys.includes('leads_view_assigned');
}

module.exports = {
  parseCapabilities,
  getUserPermissionKeys,
  canViewAllCallLogs,
  shouldRestrictToInitiator,
};
