import { db } from "@db/db.ts";
import type { File } from "@packages/types.ts";

export const getFilesByDrive = db.query<File, [number]>(
    "SELECT * FROM files WHERE drive_id = ?"
);

export const getFileById = db.query<File, [number]>(
    "SELECT * FROM files WHERE id = ?"
);

export const insertFile = db.query<
    File,
    [number, string, string, number, string | null]>(
    `INSERT INTO files (drive_id, name, path, size_bytes, mime_type)
    VALUES (?, ?, ?, ?, ?)
    RETURNING *`
);

export const upsertFile = db.query<
    File,
    [number, string, string, number, string | null]>(
    `INSERT INTO files (drive_id, name, path, size_bytes, mime_type)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(drive_id, path) DO UPDATE SET
        size_bytes = excluded.size_bytes,
        mime_type = excluded.mime_type,
        modified_at = datetime('now')
    RETURNING *`
);

export const updateFileModified = db.query<void, [string]>(
    "UPDATE files SET modified_at = datetime('now') WHERE path = ?"
);

export const updateFileSize = db.query<void, [number, string | null, number, string]>(
    "UPDATE files SET size_bytes = ?, mime_type = ? WHERE drive_id = ? AND path = ?"
);

export const deleteFile = db.query<File, [number]>(
    "DELETE FROM files WHERE id = ? RETURNING *"
);

export const deleteFilesByDrive = db.query<void, [number]>(
    "DELETE FROM files WHERE drive_id = ?"
);

export const deleteFileByPath = db.query<void, [number, string]>(
    "DELETE FROM files WHERE drive_id = ? AND path = ?"
);

export const deleteFilesUnderPath = db.query<void, [number, string]>(
    "DELETE FROM files WHERE drive_id = ? AND path LIKE ? || '%'"
);

export const trashFolder = db.query<void, [number, number, string]>(
    "UPDATE files SET path = '.trash/' || substr(path, ?), modified_at = datetime('now') WHERE drive_id = ? AND path LIKE ? || '%'"
);

export const moveFolder = db.query<void, [number, string, number, number, string]>(
    "UPDATE files SET drive_id = ?, path = ? || substr(path, ?), modified_at = datetime('now') WHERE drive_id = ? AND path LIKE ? || '%'"
);

export const renameFile = db.query<File, [string, string, string, number]>(
    "UPDATE files SET name = ?, path = ?, modified_at = datetime('now') WHERE path = ? AND drive_id = ? RETURNING *"
);

export const moveFile = db.query<File, [number, string, string, number]>(
    "UPDATE files SET drive_id = ?, path = ?, modified_at = datetime('now') WHERE path = ? AND drive_id = ? RETURNING *"
);

export const getFilesByPath = db.query<File, [number, string]>(
    "SELECT * FROM files WHERE drive_id = ? AND path LIKE ? || '%'"
);