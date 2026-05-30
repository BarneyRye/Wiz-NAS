import { buildOpenApiDocument } from '@backend/src/libs/openapi'
import { json } from '@backend/src/libs/http'

const reference = `<!doctype html>
<html>
  <head>
    <title>Wiz-NAS API</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <script id="api-reference" data-url="/openapi.json"></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>`;

function openApiSpec(): Response {
    return json(buildOpenApiDocument());
}

function apiReference(): Response {
    return new Response(reference, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}

export const docsRoutes = {
    '/openapi.json': { GET: openApiSpec },
    '/docs': { GET: apiReference },
};
