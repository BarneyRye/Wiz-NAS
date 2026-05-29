export class FileExistsError extends Error {
    constructor(path: string) {
        super(`File already exists: ${path}`);
        this.name = 'FileExistsError';
    }
}
