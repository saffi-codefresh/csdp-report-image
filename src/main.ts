import EventSource from 'eventsource'

import { validate } from './validate'
import { buildUrlHeaders } from './request-builder'

/**
 * Take (CF_ prefixed) Env variables and perform http/s request (SSE) to app-proxy for image-report with CF_ENRICHERS
 */
async function mainProcess(argv, env): Promise<void> {
    const verbose = argv.includes('verbose') || env['VERBOSE']
    if (verbose) {
        console.debug('Running with verbose log')
    }
    const payload = validate(env)
    const { url, headers } = buildUrlHeaders(payload)
    if (verbose) {
        console.debug(`Payload: ${JSON.stringify(payload, null, 2)}`)
        console.debug(`Sending request: ${url}, headers: ${JSON.stringify(headers)}`)
    }
    if (payload['CF_CI_TYPE'] && payload['CF_WORKFLOW_URL']) {
        console.info(`Running ${payload['CF_CI_TYPE']} URL: ${payload['CF_WORKFLOW_URL']}`)
    }
    const waitFor = new Promise((resolve, reject) => {
        const eventSource = new EventSource(url, { headers })
        eventSource.addEventListener('report', function (event) {
            console.info(`report =>`, JSON.stringify(JSON.parse(event.data), null, 2))
        })
        eventSource.addEventListener('info', function (event) {
            console.info(`\t\t${JSON.stringify(event.data)}`)
        })
        eventSource.addEventListener('warn', function (event) {
            console.warn(`Warning:\t${JSON.stringify(event.data)}`)
        })
        eventSource.addEventListener('error', (err) => {
            eventSource.close()
            reject(err)
        })
        eventSource.addEventListener('end', (ev) => {
            eventSource.close()
            resolve(ev)
        })
    })
    await waitFor
}

async function main(argv, env): Promise<void> {
    try {
        await mainProcess(argv, env)
    } catch (error) {
        console.error(error)
        if (error.type=='error' && error.status===500) {
            const tokenStart = (env['CF_API_KEY'] || '').slice(0, 6)
            const tokenEnd = (env['CF_API_KEY'] || '').slice(-6)
            console.info(`Error 500 are usually caused by providing an invalid CF_API_KEY, please check that the validity of the provided codefresh api token ${tokenStart}..${tokenEnd}`)
        }
        throw error
    }
}

/**
 * calling main with process argv and env. Exit code 1 on error
 */
export async function mainErrorHandling() {
    try {
        await main(process.argv, process.env)
    } catch {
        // Catchall for general errors
        process.exit(1)
    }
}


