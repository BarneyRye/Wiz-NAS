import { z } from 'zod'
import { requireAuth, json, handle, parseBody, parseParams } from '@backend/src/libs/http'
import { AuthError } from '@backend/src/libs/errors'
import { documentRoute } from '@backend/src/libs/openapi'
import { getUsersFn, getUserByIdFn, updateUserRoleFn, setUserBlockedFn, deleteUserFn } from '@backend/src/libs/user'

const roleSchema = z.enum(['admin', 'user', 'viewer']);

const publicUser = z.object({ id: z.number(), username: z.string(), role: roleSchema, blocked: z.number() });
const successResponse = z.object({ success: z.boolean() });

const userParams = z.object({ id: z.coerce.number().int().positive() });
const roleBody = z.object({ role: roleSchema });
const blockedBody = z.object({ blocked: z.boolean() });

function requireAdmin(req: Request): void {
    const auth = requireAuth(req);
    if (auth.role !== 'admin') throw new AuthError('Admin only');
}

function getUsers(req: Request): Promise<Response> {
    return handle(async () => {
        requireAdmin(req);
        const users = getUsersFn();
        return json(users.map(u => ({ id: u.id, username: u.username, role: u.role, blocked: u.blocked })));
    });
}

function getUserById(req: Bun.BunRequest<'/api/user/:id'>): Promise<Response> {
    return handle(async () => {
        requireAdmin(req);
        const { id } = parseParams(req.params, userParams);
        const user = getUserByIdFn(id);
        if (!user) return json({ error: 'User not found' }, 404);
        return json({ id: user.id, username: user.username, role: user.role, blocked: user.blocked });
    });
}

function updateRole(req: Bun.BunRequest<'/api/user/:id/role'>): Promise<Response> {
    return handle(async () => {
        requireAdmin(req);
        const { id } = parseParams(req.params, userParams);
        const { role } = await parseBody(req, roleBody);
        updateUserRoleFn(id, role);
        return json({ success: true });
    });
}

function setBlocked(req: Bun.BunRequest<'/api/user/:id/blocked'>): Promise<Response> {
    return handle(async () => {
        requireAdmin(req);
        const { id } = parseParams(req.params, userParams);
        const { blocked } = await parseBody(req, blockedBody);
        setUserBlockedFn(id, blocked ? 1 : 0);
        return json({ success: true });
    });
}

function blockUser(req: Bun.BunRequest<'/api/user/:id/block'>): Promise<Response> {
    return handle(async () => {
        requireAdmin(req);
        const { id } = parseParams(req.params, userParams);
        setUserBlockedFn(id, 1);
        return json({ success: true });
    });
}

function unblockUser(req: Bun.BunRequest<'/api/user/:id/unblock'>): Promise<Response> {
    return handle(async () => {
        requireAdmin(req);
        const { id } = parseParams(req.params, userParams);
        setUserBlockedFn(id, 0);
        return json({ success: true });
    });
}

function deleteUser(req: Bun.BunRequest<'/api/user/:id'>): Promise<Response> {
    return handle(async () => {
        requireAdmin(req);
        const { id } = parseParams(req.params, userParams);
        deleteUserFn(id);
        return json({ success: true });
    });
}

documentRoute({ method: 'get', path: '/api/users', summary: 'List all users (admin only)', secured: true, response: z.array(publicUser) });
documentRoute({ method: 'get', path: '/api/user/{id}', summary: 'Get a user by id (admin only)', secured: true, params: userParams, response: publicUser });
documentRoute({ method: 'patch', path: '/api/user/{id}/role', summary: 'Change a user role (admin only)', secured: true, params: userParams, body: roleBody, response: successResponse });
documentRoute({ method: 'patch', path: '/api/user/{id}/blocked', summary: 'Block or unblock a user (admin only)', secured: true, params: userParams, body: blockedBody, response: successResponse });
documentRoute({ method: 'post', path: '/api/user/{id}/block', summary: 'Block a user (admin only)', secured: true, params: userParams, response: successResponse });
documentRoute({ method: 'post', path: '/api/user/{id}/unblock', summary: 'Unblock a user (admin only)', secured: true, params: userParams, response: successResponse });
documentRoute({ method: 'delete', path: '/api/user/{id}', summary: 'Delete a user (admin only)', secured: true, params: userParams, response: successResponse });

export const userRoutes = {
    '/api/users': { GET: getUsers },
    '/api/user/:id': { GET: getUserById, DELETE: deleteUser },
    '/api/user/:id/role': { PATCH: updateRole },
    '/api/user/:id/blocked': { PATCH: setBlocked },
    '/api/user/:id/block': { POST: blockUser },
    '/api/user/:id/unblock': { POST: unblockUser },
};
