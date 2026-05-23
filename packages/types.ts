export type Drive = {
  id: number;
  name: string;
  path: string;
  total_bytes: number | null;
  used_bytes: number | null;
};

export type File = {
  id: number;
  drive_id: number;
  name: string;
  path: string;
  size_bytes: number;
  mime_type: string | null;
  created_at: string;
  modified_at: string;
};

export type Role = "admin" | "user" | "viewer";

export type User = {
  id: number;
  username: string;
  password_hash: string;
  role: Role;
  blocked: number;
};

export type RevokedToken = {
  jti: string;
  expires_at: number;
};

export type DirectoryItem = Omit<File, "id" | "drive_id" | "created_at"> & {
  isDirectory: boolean;
};

export const MIME_TYPES: Record<string, string> = {
  ".txt": "text/plain",
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".mkv": "video/x-matroska",
  ".mp3": "audio/mpeg",
  ".flac": "audio/flac",
  ".zip": "application/zip",
  ".rar": "application/x-rar-compressed",
};

export function getMimeType(filename: string): string {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf("."));
  return MIME_TYPES[ext] || "application/octet-stream";
}