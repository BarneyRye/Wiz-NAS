import { z } from 'zod'
import type { Role, TokenPayload } from '@packages/types'
import { verifyTokenFn } from './auth'
import { AuthError, ValidationError, FileExistsError, NotFoundError, AdminChangeError } from './errors'

export function json(data: unknown, status = 200): Response {
    return Response.json(data, { status });
}

export function requireAuth(req: Request): TokenPayload {
    const header = req.headers.get('authorization');
    if (!header?.startsWith('Bearer ')) throw new AuthError('Missing or invalid authorization header');
    try {
        return verifyTokenFn(header.slice(7));
    } catch {
        throw new AuthError('Invalid or expired token');
    }
}

export function requireRole(req: Request, ...roles: Role[]): TokenPayload {
    const auth = requireAuth(req);
    if (!roles.includes(auth.role)) throw new AuthError('Insufficient permissions');
    return auth;
}

function formatIssues(error: z.ZodError, fallback: string): string {
    return error.issues.map(i => `${i.path.join('.') || fallback}: ${i.message}`).join('; ');
}

export async function parseBody<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S>> {
    let raw: unknown;
    try {
        raw = await req.json();
    } catch {
        throw new ValidationError('Invalid JSON body');
    }
    const result = schema.safeParse(raw);
    if (!result.success) throw new ValidationError(formatIssues(result.error, 'body'));
    return result.data;
}

export function parseQuery<S extends z.ZodType>(req: Request, schema: S): z.infer<S> {
    const raw = Object.fromEntries(new URL(req.url).searchParams);
    const result = schema.safeParse(raw);
    if (!result.success) throw new ValidationError(formatIssues(result.error, 'query'));
    return result.data;
}

export function parseParams<S extends z.ZodType>(params: Record<string, string>, schema: S): z.infer<S> {
    const result = schema.safeParse(params);
    if (!result.success) throw new ValidationError(formatIssues(result.error, 'params'));
    return result.data;
}

export async function handle(fn: () => Response | Promise<Response>): Promise<Response> {
    try {
        return await fn();
    } catch (err) {
        if (err instanceof AuthError) return json({ error: err.message }, 401);
        if (err instanceof AdminChangeError) return json({ error: err.message }, 403);
        if (err instanceof NotFoundError) return json({ error: err.message }, 404);
        if (err instanceof ValidationError) return json({ error: err.message }, 400);
        if (err instanceof FileExistsError) return json({ error: err.message }, 409);
        return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500);
    }
}
