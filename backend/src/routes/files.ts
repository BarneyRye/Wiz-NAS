import { z } from 'zod'
import type { File as FileRecord } from '@packages/types'
import { getMimeType } from '@packages/types'
import { requireAuth, requireRole, json, handle, parseBody, parseQuery, parseParams } from '@backend/src/libs/http'
import { documentRoute } from '@backend/src/libs/openapi'
import { getFileByIdFn, resolveFilePathFn, insertFileFn, getPathItems, deleteFileFn, deleteFolderFn, renameFileFn, moveFileFn, renameFolderFn, moveFolderFn, makeFolderFn, downloadFolderFn } from '@backend/src/libs/files'
import { ValidationError } from '../libs/errors';

const fileResponse = z.object({
    id: z.number(),
    drive_id: z.number(),
    name: z.string(),
    path: z.string(),
    size_bytes: z.number(),
    mime_type: z.string().nullable(),
    created_at: z.string(),
    modified_at: z.string()
});

const itemResponse = z.object({
    id: z.number().nullable(),
    drive_id: z.number(),
    name: z.string(),
    path: z.string(),
    mime_type: z.string().nullable(),
    size_bytes: z.number().nullable(),
    is_folder: z.boolean()
});

const successResponse = z.object({ success: z.boolean() });

const fileParams = z.object({ id: z.coerce.number().int().positive() });
const listQuery = z.object({ drive_id: z.coerce.number().int().positive(), path: z.string() });
const renameFileBody = z.object({ name: z.string().min(1), overwrite: z.boolean().optional() });
const moveFileBody = z.object({ drive_id: z.number().int().positive(), dir: z.string(), overwrite: z.boolean().optional() });
const folderBody = z.object({ drive_id: z.number().int().positive(), path: z.string().min(1) });
const downloadFolderQuery = z.object({ drive_id: z.coerce.number().int().positive(), path: z.string().min(1) });
const renameFolderBody = z.object({ drive_id: z.number().int().positive(), path: z.string().min(1), name: z.string().min(1), overwrite: z.boolean().optional() });
const moveFolderBody = z.object({ drive_id: z.number().int().positive(), path: z.string().min(1), destDriveId: z.number().int().positive(), destDir: z.string(), overwrite: z.boolean().optional() });

function requireWrite(req: Request): void {
    requireRole(req, 'admin', 'user');
}

function listItems(req: Request): Promise<Response> {
    return handle(async () => {
        requireAuth(req);
        const { drive_id, path } = parseQuery(req, listQuery);
        const items = getPathItems(drive_id, path);
        return json(items);
    });
}

function getFileById(req: Bun.BunRequest<'/api/file/:id'>): Promise<Response> {
    return handle(async () => {
        requireAuth(req);
        const { id } = parseParams(req.params, fileParams);
        const file = getFileByIdFn(id);
        if (!file) return json({ error: 'File not found' }, 404);
        return json(file);
    });
}

function downloadFile(req: Bun.BunRequest<'/api/file/:id/download'>): Promise<Response> {
    return handle(async () => {
        requireAuth(req);
        const { id } = parseParams(req.params, fileParams);
        const { file, diskPath } = resolveFilePathFn(id);
        const blob = Bun.file(diskPath);
        if (!(await blob.exists())) throw new ValidationError('File missing on disk');
        return new Response(blob, {
            headers: {
                'Content-Type': file.mime_type ?? 'application/octet-stream',
                'Content-Disposition': `attachment; filename="${encodeURIComponent(file.name)}"`,
            },
        });
    });
}

function insertFile(req: Request): Promise<Response> {
    return handle(async () => {
        requireWrite(req);
        const form = await req.formData();
        const upload = form.get('file');
        const drive_id = Number(form.get('drive_id'));
        const dir = String(form.get('path') ?? '');
        const overwrite = form.get('overwrite') === 'true';
        if (!(upload instanceof File)) throw new ValidationError('A file upload is required');
        if (!drive_id) throw new ValidationError('drive_id is required');
        const buffer = Buffer.from(await upload.arrayBuffer());
        const path = dir ? `${dir.replace(/\/$/, '')}/${upload.name}` : upload.name;
        const record: FileRecord = {
            id: 0,
            drive_id,
            name: upload.name,
            path,
            size_bytes: buffer.byteLength,
            mime_type: getMimeType(upload.name),
            created_at: '',
            modified_at: '',
        };
        await insertFileFn(record, buffer, overwrite);
        return json({ success: true }, 201);
    });
}

function deleteFile(req: Bun.BunRequest<'/api/file/:id'>): Promise<Response> {
    return handle(async () => {
        requireWrite(req);
        const { id } = parseParams(req.params, fileParams);
        await deleteFileFn(id);
        return json({ success: true });
    });
}

function renameFile(req: Bun.BunRequest<'/api/file/:id/rename'>): Promise<Response> {
    return handle(async () => {
        requireWrite(req);
        const { id } = parseParams(req.params, fileParams);
        const { name, overwrite } = await parseBody(req, renameFileBody);
        await renameFileFn(id, name, overwrite);
        return json({ success: true });
    });
}

function moveFile(req: Bun.BunRequest<'/api/file/:id/move'>): Promise<Response> {
    return handle(async () => {
        requireWrite(req);
        const { id } = parseParams(req.params, fileParams);
        const { drive_id, dir, overwrite } = await parseBody(req, moveFileBody);
        await moveFileFn(id, drive_id, dir, overwrite);
        return json({ success: true });
    });
}

function downloadFolder(req: Request): Promise<Response> {
    return handle(async () => {
        requireAuth(req);
        const { drive_id, path } = parseQuery(req, downloadFolderQuery);
        const { name, data } = await downloadFolderFn(drive_id, path);
        return new Response(data, {
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename="${encodeURIComponent(name)}"`,
                'Content-Length': data.byteLength.toString(),
            },
        });
    });
}

function makeFolder(req: Request): Promise<Response> {
    return handle(async () => {
        requireWrite(req);
        const { drive_id, path } = await parseBody(req, folderBody);
        await makeFolderFn(drive_id, path);
        return json({ success: true }, 201);
    });
}

function deleteFolder(req: Request): Promise<Response> {
    return handle(async () => {
        requireWrite(req);
        const { drive_id, path } = await parseBody(req, folderBody);
        await deleteFolderFn(drive_id, path);
        return json({ success: true });
    });
}

function renameFolder(req: Request): Promise<Response> {
    return handle(async () => {
        requireWrite(req);
        const { drive_id, path, name, overwrite } = await parseBody(req, renameFolderBody);
        await renameFolderFn(drive_id, path, name, overwrite);
        return json({ success: true });
    });
}

function moveFolder(req: Request): Promise<Response> {
    return handle(async () => {
        requireWrite(req);
        const { drive_id, path, destDriveId, destDir, overwrite } = await parseBody(req, moveFolderBody);
        await moveFolderFn(drive_id, path, destDriveId, destDir, overwrite);
        return json({ success: true });
    });
}

documentRoute({ method: 'get', path: '/api/files', summary: 'List items under a path, or the full file record if the path is a file', secured: true, query: listQuery, response: z.union([fileResponse, z.array(itemResponse)]) });
documentRoute({ method: 'get', path: '/api/file/{id}', summary: 'Get file by id', secured: true, params: fileParams, response: fileResponse });
documentRoute({ method: 'get', path: '/api/file/{id}/download', summary: 'Download a file', secured: true, params: fileParams });
documentRoute({ method: 'post', path: '/api/file', summary: 'Upload a file (multipart/form-data)', secured: true, response: successResponse, status: 201 });
documentRoute({ method: 'delete', path: '/api/file/{id}', summary: 'Move a file to trash', secured: true, params: fileParams, response: successResponse });
documentRoute({ method: 'patch', path: '/api/file/{id}/rename', summary: 'Rename a file', secured: true, params: fileParams, body: renameFileBody, response: successResponse });
documentRoute({ method: 'patch', path: '/api/file/{id}/move', summary: 'Move a file', secured: true, params: fileParams, body: moveFileBody, response: successResponse });
documentRoute({ method: 'get', path: '/api/folder/download', summary: 'Download a folder as a zip (excludes trash and .keep)', secured: true, query: downloadFolderQuery });
documentRoute({ method: 'post', path: '/api/folder', summary: 'Create a folder', secured: true, body: folderBody, response: successResponse, status: 201 });
documentRoute({ method: 'delete', path: '/api/folder', summary: 'Move a folder to trash', secured: true, body: folderBody, response: successResponse });
documentRoute({ method: 'patch', path: '/api/folder/rename', summary: 'Rename a folder', secured: true, body: renameFolderBody, response: successResponse });
documentRoute({ method: 'patch', path: '/api/folder/move', summary: 'Move a folder', secured: true, body: moveFolderBody, response: successResponse });

export const fileRoutes = {
    '/api/files': { GET: listItems },
    '/api/file': { POST: insertFile },
    '/api/file/:id': { GET: getFileById, DELETE: deleteFile },
    '/api/file/:id/download': { GET: downloadFile },
    '/api/file/:id/rename': { PATCH: renameFile },
    '/api/file/:id/move': { PATCH: moveFile },
    '/api/folder/download': { GET: downloadFolder },
    '/api/folder': { POST: makeFolder, DELETE: deleteFolder },
    '/api/folder/rename': { PATCH: renameFolder },
    '/api/folder/move': { PATCH: moveFolder },
};