import os from "os";
import { postText } from "../util/http.js";

const escapeTag = (value) => String(value).replace(/[ ,=]/g, "\\$&");

const buildLine = (measurement, tags, fields, timestampSeconds) => {
    const tagPart = Object.entries(tags)
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(([k, v]) => `${escapeTag(k)}=${escapeTag(v)}`)
        .join(",");

    const fieldPart = Object.entries(fields)
        .filter(([, v]) => typeof v === "number" && Number.isFinite(v))
        .map(([k, v]) => `${k}=${v}`)
        .join(",");

    const prefix = tagPart ? `${measurement},${tagPart}` : measurement;
    return `${prefix} ${fieldPart} ${timestampSeconds}`;
};

const send = (c, line, activity) => {
    const baseUrl = c.url.replace(/\/+$/, "");
    const url = `${baseUrl}/api/v2/write?org=${encodeURIComponent(c.org)}` +
        `&bucket=${encodeURIComponent(c.bucket)}&precision=s`;
    return postText(url, line, {
        headers: {
            "Authorization": `Token ${c.token}`,
            "Content-Type": "text/plain; charset=utf-8"
        },
        activity
    });
};

export default (registerEvent) => {
    registerEvent("testFinished", async ({data: c}, data, activity) => {
        const tags = {
            host: c.host || os.hostname(),
            ...(c.tags ? Object.fromEntries(c.tags.split(",")
                .map(t => t.split("=").map(s => s.trim()))
                .filter(([k, v]) => k && v)) : {})
        };

        const fields = {
            download: data.download,
            upload: data.upload,
            ping: data.ping,
            jitter: data.jitter ?? 0
        };

        const timestamp = Math.floor(Date.now() / 1000);
        const line = buildLine(c.measurement || "speedtests", tags, fields, timestamp);

        await send(c, line, activity);
    });

    return {
        icon: "fa-solid fa-database",
        fields: [
            {name: "url", type: "text", required: true, regex: /^https?:\/\/.+/},
            {name: "org", type: "text", required: true},
            {name: "bucket", type: "text", required: true},
            {name: "token", type: "text", required: true},
            {name: "measurement", type: "text", required: false},
            {name: "host", type: "text", required: false},
            {name: "tags", type: "text", required: false}
        ]
    };
};
