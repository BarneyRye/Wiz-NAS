import { z } from 'zod'
import { requireRole, json, handle, parseParams } from '@backend/src/libs/http'
import { documentRoute } from '@backend/src/libs/openapi'
import { rescanDriveFn, rescanAllDrivesFn, refreshDriveBytesFn, refreshAllBytesFn } from '@backend/src/libs/scan'

const driveResponse = z.object({
    id: z.number(),
    name: z.string(),
    path: z.string(),
    total_bytes: z.number().nullable(),
    used_bytes: z.number().nullable()
});

const driveParams = z.object({ id: z.coerce.number().int().positive() });

function byteScanAll(req: Request): Promise<Response> {
    return handle(async () => {
        requireRole(req, 'admin');
        const drives = await refreshAllBytesFn();
        return json(drives);
    });
}

function byteScanDrive(req: Bun.BunRequest<'/api/scan/bytes/:id'>): Promise<Response> {
    return handle(async () => {
        requireRole(req, 'admin');
        const { id } = parseParams(req.params, driveParams);
        const drive = await refreshDriveBytesFn(id);
        return json(drive);
    });
}

function driveScanAll(req: Request): Promise<Response> {
    return handle(async () => {
        requireRole(req, 'admin');
        const drives = await rescanAllDrivesFn();
        return json(drives);
    });
}

function driveScanDrive(req: Bun.BunRequest<'/api/scan/drive/:id'>): Promise<Response> {
    return handle(async () => {
        requireRole(req, 'admin');
        const { id } = parseParams(req.params, driveParams);
        const drive = await rescanDriveFn(id);
        return json(drive);
    });
}

documentRoute({ method: 'post', path: '/api/scan/bytes', summary: 'Byte scan all drives, refresh usage only (admin only)', secured: true, response: z.array(driveResponse) });
documentRoute({ method: 'post', path: '/api/scan/bytes/{id}', summary: 'Byte scan a single drive, refresh usage only (admin only)', secured: true, params: driveParams, response: driveResponse });
documentRoute({ method: 'post', path: '/api/scan/drive', summary: 'Drive scan all drives, reconcile files and usage (admin only)', secured: true, response: z.array(driveResponse) });
documentRoute({ method: 'post', path: '/api/scan/drive/{id}', summary: 'Drive scan a single drive, reconcile files and usage (admin only)', secured: true, params: driveParams, response: driveResponse });

export const scanRoutes = {
    '/api/scan/bytes': { POST: byteScanAll },
    '/api/scan/bytes/:id': { POST: byteScanDrive },
    '/api/scan/drive': { POST: driveScanAll },
    '/api/scan/drive/:id': { POST: driveScanDrive },
};
