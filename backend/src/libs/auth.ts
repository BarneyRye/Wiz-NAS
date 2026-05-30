import jwt from 'jsonwebtoken'
import { randomUUID } from 'node:crypto'
import type { User, Role, TokenPayload } from '@packages/types'
import { getUserByUsername, getUserById, insertUser, updateUserPassword, updateUserName, revokeToken, getRevokedToken } from '@db/queries'
import { AuthError, ValidationError, AdminChangeError } from './errors'

function requireSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET not set in .env');
    return secret;
}

const JWT_SECRET = requireSecret();

const TOKEN_TTL_SECONDS = (Number(process.env.TOKEN_TTL_SECONDS) || 7) * 24 * 60 * 60;

export async function createUserFn(username: string, password: string, role: Role = 'viewer'): Promise<User> {
    if (getUserByUsername.get(username)) throw new ValidationError('Username already taken');
    const password_hash = await Bun.password.hash(password);
    const user = insertUser.get(username, password_hash, role);
    if (!user) throw new Error('Failed to create user');
    return user;
}

export async function authenticateFn(username: string, password: string): Promise<{ user: User; token: string }> {
    const user = getUserByUsername.get(username);
    if (!user) throw new AuthError('Invalid credentials');
    if (user.blocked) throw new AuthError('User is blocked');
    const valid = await Bun.password.verify(password, user.password_hash);
    if (!valid) throw new AuthError('Invalid credentials');
    return { user, token: signToken(user) };
}

export function signToken(user: User): string {
    const payload: TokenPayload = {
        sub: user.id,
        username: user.username,
        role: user.role,
        jti: randomUUID(),
    };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_TTL_SECONDS });
}

export function verifyTokenFn(token: string): TokenPayload {
    const payload = jwt.verify(token, JWT_SECRET) as unknown as TokenPayload;
    if (getRevokedToken.get(payload.jti)) throw new AuthError('Token revoked');
    return payload;
}

export function logoutFn(token: string): void {
    const decoded = jwt.decode(token) as (TokenPayload & { exp?: number }) | null;
    if (decoded?.jti && decoded.exp) revokeToken.run(decoded.jti, decoded.exp);
}

export async function changePasswordFn(id: number, oldPassword: string, newPassword: string): Promise<void> {
    const user = getUserById.get(id);
    if (!user) throw new AuthError('User not found');
    if (user.username === 'admin') throw new AdminChangeError("Can't change password of username: admin");
    const valid = await Bun.password.verify(oldPassword, user.password_hash);
    if (!valid) throw new AuthError('Invalid credentials');
    const hash = await Bun.password.hash(newPassword);
    updateUserPassword.run(hash, id);
}

export function changeUsernameFn(id: number, newUsername: string): { user: User; token: string } {
    const user = getUserById.get(id);
    if (!user) throw new AuthError('User not found');
    if (user.username === 'admin') throw new AdminChangeError("Can't change username of username: admin");
    const existing = getUserByUsername.get(newUsername);
    if (existing && existing.id !== id) throw new ValidationError('Username already taken');
    updateUserName.run(newUsername, id);
    const updated: User = { ...user, username: newUsername };
    return { user: updated, token: signToken(updated) };
}
