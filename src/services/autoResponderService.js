const autoResponses = new Map();

export function getAutoResponse(content) {
    if (!content) return null;

    const normalized = content.trim().toLowerCase();

    console.log('[AUTORESPONDER] Checking:', normalized);
    console.log('[AUTORESPONDER] Stored:', [...autoResponses.entries()]);

    return autoResponses.get(normalized) ?? null;
}

export function setAutoResponse(trigger, response) {
    if (!trigger || !response) return false;

    const normalized = trigger.trim().toLowerCase();

    autoResponses.set(normalized, response);

    console.log('[AUTORESPONDER] Saved:', normalized, '->', response);

    return true;
}

export function deleteAutoResponse(trigger) {
    if (!trigger) return false;

    return autoResponses.delete(trigger.trim().toLowerCase());
}

export function getAllAutoResponses() {
    return Object.fromEntries(autoResponses);
}
