import { z } from 'zod'
import { requireAuth, requireRole, json, handle, parseBody, parseParams } from '@backend/src/libs/http'
import { documentRoute } from '@backend/src/libs/openapi'
import { getDrivesFn, getDriveByIdFn, renameDriveFn } from '@backend/src/libs/drives'

const driveResponse = z.object({
    id: z.number(),
    name: z.string(),
    path: z.string(),
    total_bytes: z.number(),
    used_bytes: z.number()
});

const driveParams = z.object({ id: z.coerce.number().int().positive() });
const renameBody = z.object({ name: z.string().min(1) });

function getDrives(req: Request): Promise<Response> {
    return handle(async () => {
        requireAuth(req);
        const drives = getDrivesFn();
        if (drives.length > 0) return json(drives);
        return json({error: 'No drives found'}, 404);
    });
}

function getDriveById(req: Bun.BunRequest<'/api/drive/:id'>): Promise<Response> {
    return handle(async () => {
        requireAuth(req);
        const { id } = parseParams(req.params, driveParams);
        const drive = getDriveByIdFn(id);
        if (!drive) return json({ error: 'Drive not found' }, 404);
        return json(drive);
    });
}

function renameDrive(req: Bun.BunRequest<'/api/drive/:id'>): Promise<Response> {
    return handle(async () => {
        requireRole(req, 'admin');
        const { id } = parseParams(req.params, driveParams);
        const { name } = await parseBody(req, renameBody);
        const drive = renameDriveFn(id, name);
        if (!drive) return json({ error: 'Drive not found' }, 404);
        return json(drive);
    });
}

documentRoute({ method: 'get', path: '/api/drive', summary: 'Get all drives', secured: true, response: z.array(driveResponse) });
documentRoute({ method: 'get', path: '/api/drive/{id}', summary: 'Get a drive by id', secured: true, params: driveParams, response: driveResponse });
documentRoute({ method: 'put', path: '/api/drive/{id}', summary: 'Rename a drive', secured: true, params: driveParams, body: renameBody, response: driveResponse });

export const driveRoutes = {
    '/api/drive': { GET: getDrives },
    '/api/drive/:id': { GET: getDriveById, PUT: renameDrive },
};