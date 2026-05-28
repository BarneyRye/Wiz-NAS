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
  [number, string, string, number, string | null]
>(
  `INSERT INTO files (drive_id, name, path, size_bytes, mime_type)
   VALUES (?, ?, ?, ?, ?)
   RETURNING *`
);

export const updateFileModified = db.query<void, [string]>(
  "UPDATE files SET modified_at = datetime('now') WHERE path = ?"
);

export const deleteFile = db.query<void, [number]>(
  "DELETE FROM files WHERE id = ?"
);

export const deleteFilesByDrive = db.query<void, [number]>(
  "DELETE FROM files WHERE drive_id = ?"
);

export const renameFile = db.query<void, [string, string, string]>(
  `UPDATE files SET name = ?, path = ?, modified_at = datetime('now') WHERE path = ?`
);