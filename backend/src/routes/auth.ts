import { z } from 'zod'
import type { User } from '@packages/types'
import { authenticateFn, createUserFn, logoutFn, changePasswordFn, changeUsernameFn } from '@backend/src/libs/auth'
import { requireAuth, json, handle, parseBody } from '@backend/src/libs/http'
import { AuthError } from '@backend/src/libs/errors'
import { documentRoute } from '@backend/src/libs/openapi'

const roleSchema = z.enum(['admin', 'user', 'viewer']);

const loginBody = z.object({ username: z.string().min(1), password: z.string().min(1) });
const registerBody = z.object({ username: z.string().min(1), password: z.string().min(1), role: roleSchema.optional() });
const passwordBody = z.object({ oldPassword: z.string().min(1), newPassword: z.string().min(1) });
const usernameBody = z.object({ username: z.string().min(1) });

const publicUser = z.object({ id: z.number(), username: z.string(), role: roleSchema });
const authResponse = z.object({ token: z.string(), user: publicUser });
const userResponse = z.object({ user: publicUser });
const successResponse = z.object({ success: z.boolean() });

function toPublicUser(user: User) {
    return { id: user.id, username: user.username, role: user.role };
}

function login(req: Request): Promise<Response> {
    return handle(async () => {
        const { username, password } = await parseBody(req, loginBody);
        const { user, token } = await authenticateFn(username, password);
        return json({ token, user: toPublicUser(user) });
    });
}

function logout(req: Request): Promise<Response> {
    return handle(() => {
        requireAuth(req);
        logoutFn(req.headers.get('authorization')!.slice(7));
        return json({ success: true });
    });
}

function register(req: Request): Promise<Response> {
    return handle(async () => {
        const auth = requireAuth(req);
        if (auth.role !== 'admin') throw new AuthError('Admin only');
        const { username, password, role } = await parseBody(req, registerBody);
        const user = await createUserFn(username, password, role);
        return json({ user: toPublicUser(user) }, 201);
    });
}

function changePassword(req: Request): Promise<Response> {
    return handle(async () => {
        const auth = requireAuth(req);
        const { oldPassword, newPassword } = await parseBody(req, passwordBody);
        await changePasswordFn(auth.sub, oldPassword, newPassword);
        return json({ success: true });
    });
}

function changeUsername(req: Request): Promise<Response> {
    return handle(async () => {
        const auth = requireAuth(req);
        const { username } = await parseBody(req, usernameBody);
        const { user, token } = changeUsernameFn(auth.sub, username);
        logoutFn(req.headers.get('authorization')!.slice(7));
        return json({ token, user: toPublicUser(user) });
    });
}

documentRoute({ method: 'post', path: '/api/auth/login', summary: 'Authenticate and receive a token', body: loginBody, response: authResponse });
documentRoute({ method: 'post', path: '/api/auth/logout', summary: 'Revoke the current token', secured: true, response: successResponse });
documentRoute({ method: 'post', path: '/api/auth/register', summary: 'Create a user (admin only)', secured: true, body: registerBody, response: userResponse, status: 201 });
documentRoute({ method: 'post', path: '/api/auth/password', summary: 'Change the current user password', secured: true, body: passwordBody, response: successResponse });
documentRoute({ method: 'post', path: '/api/auth/username', summary: 'Change username and receive a new token', secured: true, body: usernameBody, response: authResponse });

export const authRoutes = {
    '/api/auth/login': { POST: login },
    '/api/auth/logout': { POST: logout },
    '/api/auth/register': { POST: register },
    '/api/auth/password': { POST: changePassword },
    '/api/auth/username': { POST: changeUsername },
};
