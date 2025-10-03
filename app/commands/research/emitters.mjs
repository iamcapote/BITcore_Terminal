/**
 * Why: Provide reusable emitters for the research CLI so output mirrors custom handlers while remaining fully logged.
 * What: Creates logger-backed emitter functions that serialize payloads, forward to supplied handlers, and fall back to stdio safely.
 * How: Stringifies values defensively, invokes the requested logger level, invokes optional handlers, and writes to stdout/stderr on handler absence or failure.
 */

const ERROR_LEVEL = 'error';

function stringifyValue(value, logger) {
    if (typeof value === 'string') {
        return value;
    }
    if (value instanceof Error) {
        return value.stack || `${value.name}: ${value.message}`;
    }
    if (value == null) {
        return '';
    }
    if (typeof value === 'object') {
        try {
            return JSON.stringify(value);
        } catch (serializationError) {
            logger?.warn?.('Failed to stringify output payload.', {
                message: serializationError?.message || String(serializationError)
            });
            return '[unserializable payload]';
        }
    }
    return String(value);
}

export function createResearchEmitter({ handler, level = 'info', logger }) {
    const target = typeof handler === 'function' ? handler : null;
    const stream = level === ERROR_LEVEL ? process.stderr : process.stdout;

    return (value, meta = null) => {
        const message = stringifyValue(value, logger);
        const payloadMeta = meta && typeof meta === 'object'
            ? meta
            : (typeof value === 'object' && value !== null && !(value instanceof Error) ? { payload: value } : null);

        logger?.[level]?.(message, payloadMeta || undefined);

        if (target) {
            try {
                target(value, meta);
                return;
            } catch (handlerError) {
                logger?.error?.('Output handler threw while emitting.', {
                    level,
                    message: handlerError?.message || String(handlerError),
                    stack: handlerError?.stack || null
                });
            }
        }

        if (message) {
            stream.write(`${message}\n`);
        }
    };
}
