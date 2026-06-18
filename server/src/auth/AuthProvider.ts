// Thin seam so a managed provider could later be slotted in behind the same
// interface. Phase 1 ships only JwtAuthProvider.

export interface AuthUser {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  roleId: string;
  scopeType: string;
  scopeNodeId: string | null;
  platformAdmin: boolean;
  secondaryScopes: {
    roleId: string | null;
    scopeType: string;
    scopeNodeId: string | null;
  }[];
}

export interface LoginResult {
  token: string;
  refreshToken?: string;
  user: AuthUser;
}

export interface AuthProvider {
  login(email: string, password: string): Promise<LoginResult>;
  verify(token: string): Promise<AuthUser>;
  getUser(id: string): Promise<AuthUser>;
  refresh?(refreshToken: string): Promise<{ token: string; refreshToken?: string }>;
  logout?(refreshToken: string): Promise<void>;
}
