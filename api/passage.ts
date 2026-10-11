import { handleScriptureRequest } from '../src/server/scriptureApi.ts'

export default { fetch: (request: Request) => handleScriptureRequest(request) }
