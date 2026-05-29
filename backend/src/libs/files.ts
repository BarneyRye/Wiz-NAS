import { writeFile, mkdir, rename, copyFile, unlink, rm, cp } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { Item, File } from '@packages/types'
import { getFilesByPath, getFileById, getDriveById, upsertFile, deleteFile, deleteFileByPath, deleteFilesUnderPath, trashFolder, moveFolder, renameFile, moveFile} from '@db/queries'
import { FileExistsError } from './errors'

const TRASH_DIR = '.trash';
const FOLDER_KEEP = '.keep';

function resolveDiskPath(drive_id: number, path: string): string {
    const drive = getDriveById.get(drive_id);
    if (!drive) throw new Error(`Drive ${drive_id} not found`);
    return join(drive.path, path);
}

export function getFileByIdFn(id: number): File | null {
    const file = getFileById.get(id);
    return file;
}

export async function insertFileFn(file: File, buffer: Buffer, overwrite: boolean = false): Promise<void> {
    const diskPath = resolveDiskPath(file.drive_id, file.path);
    if (await Bun.file(diskPath).exists() && !overwrite) throw new FileExistsError(file.path);
    await mkdir(dirname(diskPath), { recursive: true });
    await writeFile(diskPath, buffer);
    upsertFile.get(file.drive_id, file.name, file.path, buffer.byteLength, file.mime_type);
    const slash = file.path.lastIndexOf('/');
    if (slash !== -1 && file.path.slice(slash + 1) !== FOLDER_KEEP) {
        const keepPath = `${file.path.slice(0, slash)}/${FOLDER_KEEP}`;
        const keepDisk = resolveDiskPath(file.drive_id, keepPath);
        if (await Bun.file(keepDisk).exists()) {
            deleteFileByPath.run(file.drive_id, keepPath);
            await Bun.file(keepDisk).delete();
        }
    }
}

export function getPathItems(drive_id: number, path: string): Item[] {
    if (!drive_id || !path) throw new Error('Drive ID and path needed to retireve items by path');
    const prefix = path.endsWith('/') ? path : `${path}/`;
    const files = getFilesByPath.all(drive_id, prefix);
    const items: Item[] = [];
    const seen = new Set<string>();
    for (const file of files) {
        const relPath = file.path.slice(prefix.length);
        const idx = relPath.indexOf('/');
        const isFolder = idx >= 0;
        const name = isFolder ? relPath.slice(0, idx) : relPath;
        if (!isFolder && name === FOLDER_KEEP) continue;
        const itemPath = isFolder ? `${prefix}${name}` : file.path;
        if (seen.has(itemPath)) continue;
        seen.add(itemPath);
        items.push({ drive_id: file.drive_id, name, path: itemPath, is_folder: isFolder });
    }
    return items;
}

export async function deleteFileFn(id: number): Promise<void> {
    const file = getFileById.get(id);
    if (!file) return;
    if (file.path.startsWith(`${TRASH_DIR}/`)) {
        deleteFile.run(id);
        await Bun.file(resolveDiskPath(file.drive_id, file.path)).delete();
        return;
    }
    const trashPath = `${TRASH_DIR}/${file.name}`;
    const srcDiskPath = resolveDiskPath(file.drive_id, file.path);
    const destDiskPath = resolveDiskPath(file.drive_id, trashPath);
    if (await Bun.file(destDiskPath).exists()) {
        deleteFileByPath.run(file.drive_id, trashPath);
        await Bun.file(destDiskPath).delete();
    }
    await mkdir(dirname(destDiskPath), { recursive: true });
    await rename(srcDiskPath, destDiskPath);
    const moved = moveFile.get(file.drive_id, trashPath, file.path, file.drive_id);
    if (!moved) throw new Error('Failed to move file to trash');
}

export async function deleteFolderFn(drive_id: number, path: string): Promise<void> {
    const folder = path.endsWith('/') ? path.slice(0, -1) : path;
    if (!folder) throw new Error('Folder path required');
    const srcDir = resolveDiskPath(drive_id, folder);
    if (folder.startsWith(`${TRASH_DIR}/`)) {
        deleteFilesUnderPath.run(drive_id, `${folder}/`);
        await rm(srcDir, { recursive: true, force: true });
        return;
    }
    if (!existsSync(srcDir)) throw new Error(`Folder ${folder} doesn't exist`);
    const slash = folder.lastIndexOf('/');
    const folderName = slash === -1 ? folder : folder.slice(slash + 1);
    const substrStart = slash + 2;
    const trashDir = `${TRASH_DIR}/${folderName}`;
    const destDir = resolveDiskPath(drive_id, trashDir);
    await rm(destDir, { recursive: true, force: true });
    deleteFilesUnderPath.run(drive_id, `${trashDir}/`);
    await mkdir(dirname(destDir), { recursive: true });
    await rename(srcDir, destDir);
    trashFolder.run(substrStart, drive_id, `${folder}/`);
}

export async function renameFileFn(id: number, name: string, overwrite: boolean = false): Promise<void> {
    const file = getFileById.get(id);
    if (!file) throw new Error(`File with id: ${id} doesn't exist`);
    const slash = file.path.lastIndexOf('/');
    const dir = slash === -1 ? '' : file.path.slice(0, slash);
    const filename = file.path.slice(slash + 1);
    const dot = filename.lastIndexOf('.');
    const ext = dot > 0 ? filename.slice(dot) : '';
    const newName = `${name}${ext}`;
    const newPath = dir ? `${dir}/${newName}` : newName;
    const newDiskPath = resolveDiskPath(file.drive_id, newPath);
    const exists = await Bun.file(newDiskPath).exists();
    if (exists && !overwrite) throw new FileExistsError(newPath);
    await rename(resolveDiskPath(file.drive_id, file.path), newDiskPath);
    if (exists) deleteFileByPath.run(file.drive_id, newPath);
    const newFile = renameFile.get(newName, newPath, file.path, file.drive_id);
    if (!newFile) throw new Error('Failed to rename file');
}

export async function moveFileFn(id: number, drive_id: number, dir: string, overwrite: boolean = false): Promise<void> {
    const file = getFileById.get(id);
    if (!file) throw new Error(`File with id: ${id} doesn't exist`);
    const newPath = dir ? `${dir}/${file.name}` : file.name;
    if (drive_id === file.drive_id && newPath === file.path) return;
    const srcDiskPath = resolveDiskPath(file.drive_id, file.path);
    const destDiskPath = resolveDiskPath(drive_id, newPath);
    const exists = await Bun.file(destDiskPath).exists();
    if (exists && !overwrite) throw new FileExistsError(newPath);
    await mkdir(dirname(destDiskPath), { recursive: true });
    try {
        await rename(srcDiskPath, destDiskPath);
    } catch (err) {
        if ((err as { code?: string }).code !== 'EXDEV') throw err;
        await copyFile(srcDiskPath, destDiskPath);
        await unlink(srcDiskPath);
    }
    if (exists) deleteFileByPath.run(drive_id, newPath);
    const moved = moveFile.get(drive_id, newPath, file.path, file.drive_id);
    if (!moved) throw new Error('Failed to move file');
}

export async function moveFolderFn(drive_id: number, path: string, destDriveId: number, destDir: string, overwrite: boolean = false): Promise<void> {
    const folder = path.endsWith('/') ? path.slice(0, -1) : path;
    if (!folder) throw new Error('Folder path required');
    const slash = folder.lastIndexOf('/');
    const folderName = slash === -1 ? folder : folder.slice(slash + 1);
    const substrStart = slash + 2;
    const dest = destDir.endsWith('/') ? destDir.slice(0, -1) : destDir;
    const newFolder = dest ? `${dest}/${folderName}` : folderName;
    if (destDriveId === drive_id && newFolder === folder) return;
    if (destDriveId === drive_id && newFolder.startsWith(`${folder}/`)) throw new Error('Cannot move a folder into itself');
    const srcDir = resolveDiskPath(drive_id, folder);
    if (!existsSync(srcDir)) throw new Error(`Folder ${folder} doesn't exist`);
    const destPath = resolveDiskPath(destDriveId, newFolder);
    if (existsSync(destPath)) {
        if (!overwrite) throw new FileExistsError(newFolder);
        await rm(destPath, { recursive: true, force: true });
        deleteFilesUnderPath.run(destDriveId, `${newFolder}/`);
    }
    await mkdir(dirname(destPath), { recursive: true });
    try {
        await rename(srcDir, destPath);
    } catch (err) {
        if ((err as { code?: string }).code !== 'EXDEV') throw err;
        await cp(srcDir, destPath, { recursive: true });
        await rm(srcDir, { recursive: true, force: true });
    }
    moveFolder.run(destDriveId, dest ? `${dest}/` : '', substrStart, drive_id, `${folder}/`);
}

export async function renameFolderFn(drive_id: number, path: string, name: string, overwrite: boolean = false): Promise<void> {
    const folder = path.endsWith('/') ? path.slice(0, -1) : path;
    if (!folder) throw new Error('Folder path required');
    const slash = folder.lastIndexOf('/');
    const parent = slash === -1 ? '' : folder.slice(0, slash);
    const newFolder = parent ? `${parent}/${name}` : name;
    if (newFolder === folder) return;
    const srcDir = resolveDiskPath(drive_id, folder);
    if (!existsSync(srcDir)) throw new Error(`Folder ${folder} doesn't exist`);
    const destDir = resolveDiskPath(drive_id, newFolder);
    if (existsSync(destDir)) {
        if (!overwrite) throw new FileExistsError(newFolder);
        await rm(destDir, { recursive: true, force: true });
        deleteFilesUnderPath.run(drive_id, `${newFolder}/`);
    }
    await rename(srcDir, destDir);
    moveFolder.run(drive_id, `${newFolder}/`, folder.length + 2, drive_id, `${folder}/`);
}

export async function makeFolderFn(drive_id: number, path: string): Promise<void> {
    const folder = path.endsWith('/') ? path.slice(0, -1) : path;
    if (!folder) throw new Error('Folder path required');
    const folderDisk = resolveDiskPath(drive_id, folder);
    if (existsSync(folderDisk)) throw new FileExistsError(folder);
    const keepPath = `${folder}/${FOLDER_KEEP}`;
    await mkdir(folderDisk, { recursive: true });
    await writeFile(resolveDiskPath(drive_id, keepPath), '');
    upsertFile.get(drive_id, FOLDER_KEEP, keepPath, 0, null);
}