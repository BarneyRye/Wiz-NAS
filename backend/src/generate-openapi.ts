import './routes/auth'
import './routes/drives'
import './routes/files'
import './routes/scan'
import './routes/user'
import { buildOpenApiDocument } from './libs/openapi'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const dir = join(import.meta.dir, '../../spec')
mkdirSync(dir, { recursive: true })
writeFileSync(join(dir, 'openapi.json'), JSON.stringify(buildOpenApiDocument(), null, 2))
