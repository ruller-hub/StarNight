const autoResponses = new Map();

export function getAutoResponse(content) {
    if (!content) return null;

    const normalized = content.trim().toLowerCase();

    return autoResponses.get(normalized) ?? null;
}

export function setAutoResponse(trigger, response) {
    if (!trigger || !response) return false;

    autoResponses.set(trigger.trim().toLowerCase(), response);
    return true;
}

export function deleteAutoResponse(trigger) {
    if (!trigger) return false;

    return autoResponses.delete(trigger.trim().toLowerCase());
}

export function getAllAutoResponses() {
    return Object.fromEntries(autoResponses);
}
