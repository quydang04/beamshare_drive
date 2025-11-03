'use strict';

const SUBPROTOCOL_TOKEN_REGEX = /^[!#$%&'*+\-.0-9A-Z^_`|a-z~]+$/;

function parse(headerValue) {
    if (headerValue === undefined || headerValue === null) {
        return new Set();
    }

    if (typeof headerValue !== 'string') {
        throw new TypeError('Sec-WebSocket-Protocol header must be a string');
    }

    const protocols = new Set();
    const rawTokens = headerValue
        .split(',')
        .map((token) => token.trim())
        .filter(Boolean);

    for (const token of rawTokens) {
        if (!SUBPROTOCOL_TOKEN_REGEX.test(token)) {
            throw new Error('Invalid subprotocol token');
        }
        if (protocols.has(token)) {
            throw new Error('Duplicate subprotocol token');
        }
        protocols.add(token);
    }

    return protocols;
}

module.exports = {
    parse
};
