import jwt from 'jsonwebtoken';
import argon2 from 'argon2';
import { randomBytes, createHash } from 'node:crypto';
import { prisma } from '../prisma.js';
import { env } from '../env.js';
import type { AuthProvider, AuthUser, LoginResult } from './AuthProvider.js';
import { DEMO_TENANT_ID } from '../domain/tenancy.js';

const ACCESS_TTL = '15m';
const REFRESH_TTL_DAYS = 30;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

async function toAuthUser(userId: string): Promise<AuthUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { secondary: true },
  });
  if (!user) throw new Error('User not found');
  if (user.status === 'disabled') throw new Error('User is disabled');
  return {
    id: user.id,
    tenantId: user.tenantId,
    email: user.email,
    name: user.name,
    roleId: user.roleId,
    scopeType: user.scopeType,
    scopeNodeId: user.scopeNodeId,
    secondaryScopes: user.secondary.map((s) => ({
      roleId: s.roleId,
      scopeType: s.scopeType,
      scopeNodeId: s.scopeNodeId,
    })),
  };
}

function signAccess(user: AuthUser): string {
  return jwt.sign(
    { sub: user.id, email: user.email, roleId: user.roleId },
    env.JWT_SECRET,
    { expiresIn: ACCESS_TTL },
  );
}

async function issueRefresh(userId: string): Promise<string> {
  const raw = randomBytes(48).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
  const session = await prisma.session.create({
    data: { userId, refreshTokenHash: hashToken(raw), expiresAt, tenantId: DEMO_TENANT_ID },
  });
  // Embed the session id so we can find + rotate the row on refresh.
  return `${session.id}.${raw}`;
}

export class JwtAuthProvider implements AuthProvider {
  async login(email: string, password: string): Promise<LoginResult> {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error('Invalid credentials');
    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) throw new Error('Invalid credentials');
    const authUser = await toAuthUser(user.id);
    const token = signAccess(authUser);
    const refreshToken = await issueRefresh(user.id);
    return { token, refreshToken, user: authUser };
  }

  async verify(token: string): Promise<AuthUser> {
    const payload = jwt.verify(token, env.JWT_SECRET) as { sub: string };
    return toAuthUser(payload.sub);
  }

  async getUser(id: string): Promise<AuthUser> {
    return toAuthUser(id);
  }

  async refresh(refreshToken: string): Promise<{ token: string; refreshToken: string }> {
    const [sessionId, raw] = refreshToken.split('.');
    if (!sessionId || !raw) throw new Error('Invalid refresh token');
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (
      !session ||
      session.revoked ||
      session.expiresAt < new Date() ||
      session.refreshTokenHash !== hashToken(raw)
    ) {
      throw new Error('Invalid refresh token');
    }
    // Rotate: revoke the old session, issue a fresh one.
    await prisma.session.update({ where: { id: session.id }, data: { revoked: true } });
    const authUser = await toAuthUser(session.userId);
    const token = signAccess(authUser);
    const newRefresh = await issueRefresh(session.userId);
    return { token, refreshToken: newRefresh };
  }

  async logout(refreshToken: string): Promise<void> {
    const [sessionId] = refreshToken.split('.');
    if (!sessionId) return;
    await prisma.session
      .update({ where: { id: sessionId }, data: { revoked: true } })
      .catch(() => undefined);
  }
}

export const authProvider: AuthProvider = new JwtAuthProvider();
