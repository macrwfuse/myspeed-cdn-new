const jsonInit = (method, json, headers) => ({
    method,
    headers: {"content-type": "application/json", ...headers},
    body: JSON.stringify(json)
});

export const postJson = async (url, json, {headers, activity} = {}) => {
    try {
        const res = await fetch(url, jsonInit("POST", json, headers));
        activity?.(res.ok ? undefined : true);
        return res;
    } catch {
        activity?.(true);
        return null;
    }
};

export const postText = async (url, body, {headers, activity} = {}) => {
    try {
        const res = await fetch(url, {
            method: "POST",
            headers: {"content-type": "text/plain; charset=utf-8", ...headers},
            body
        });
        activity?.(res.ok ? undefined : true);
        return res;
    } catch {
        activity?.(true);
        return null;
    }
};

export const getJson = async (url, {headers, signal} = {}) => {
    const res = await fetch(url, {headers, signal});
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
};
