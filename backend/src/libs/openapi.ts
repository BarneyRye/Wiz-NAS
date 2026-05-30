import { z } from 'zod'

type RouteDoc = {
    method: 'get' | 'post' | 'put' | 'patch' | 'delete';
    path: string;
    summary: string;
    secured?: boolean;
    params?: z.ZodType;
    query?: z.ZodType;
    body?: z.ZodType;
    response?: z.ZodType;
    status?: number;
};

const routeDocs: RouteDoc[] = [];

export function documentRoute(doc: RouteDoc): void {
    routeDocs.push(doc);
}

function toSchema(schema: z.ZodType): Record<string, unknown> {
    const json = z.toJSONSchema(schema) as Record<string, unknown>;
    delete json.$schema;
    return json;
}

function toParameters(schema: z.ZodType, location: 'path' | 'query'): Record<string, unknown>[] {
    const json = z.toJSONSchema(schema) as { properties?: Record<string, Record<string, unknown>>; required?: string[] };
    const required = new Set(json.required ?? []);
    return Object.entries(json.properties ?? {}).map(([name, propSchema]) => {
        const paramSchema = { ...propSchema };
        delete paramSchema.$schema;
        return {
            name,
            in: location,
            required: location === 'path' ? true : required.has(name),
            schema: paramSchema,
        };
    });
}

export function buildOpenApiDocument(): Record<string, unknown> {
    const paths: Record<string, Record<string, unknown>> = {};
    for (const doc of routeDocs) {
        const operation: Record<string, unknown> = { summary: doc.summary };
        if (doc.secured) operation.security = [{ bearerAuth: [] }];
        const parameters: Record<string, unknown>[] = [];
        if (doc.params) parameters.push(...toParameters(doc.params, 'path'));
        if (doc.query) parameters.push(...toParameters(doc.query, 'query'));
        if (parameters.length) operation.parameters = parameters;
        if (doc.body) {
            operation.requestBody = {
                required: true,
                content: { 'application/json': { schema: toSchema(doc.body) } },
            };
        }
        const responses: Record<string, unknown> = {
            [String(doc.status ?? 200)]: {
                description: 'Success',
                ...(doc.response ? { content: { 'application/json': { schema: toSchema(doc.response) } } } : {}),
            },
        };
        if (doc.body) responses['400'] = { description: 'Validation error' };
        if (doc.secured) responses['401'] = { description: 'Unauthorized' };
        operation.responses = responses;
        paths[doc.path] ??= {};
        paths[doc.path][doc.method] = operation;
    }
    return {
        openapi: '3.1.0',
        info: { title: 'Wiz-NAS API', version: '1.0.0' },
        components: {
            securitySchemes: {
                bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
            },
        },
        paths,
    };
}
