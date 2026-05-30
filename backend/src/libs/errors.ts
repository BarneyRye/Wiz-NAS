export class FileExistsError extends Error {
    constructor(path: string) {
        super(`File already exists: ${path}`);
        this.name = 'FileExistsError';
    }
}

export class AuthError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AuthError';
    }
}

export class ValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ValidationError';
    }
}

export class AdminChangeError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "AdminChangeError";
    }
}

export class NotFoundError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'NotFoundError';
    }
}