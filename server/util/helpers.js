const pad = (n) => String(n).padStart(2, "0");

const getDateVariables = () => {
    const now = new Date();
    return {
        year: now.getFullYear(),
        month: pad(now.getMonth() + 1),
        day: pad(now.getDate()),
        hour: pad(now.getHours()),
        minute: pad(now.getMinutes()),
        second: pad(now.getSeconds())
    };
};

export const replaceVariables = (message, variables) => {
    const allVariables = {...getDateVariables(), ...variables};
    for (const variable in allVariables)
        message = message.replaceAll(`%${variable}%`, allVariables[variable]);
    return message;
};

export const mapFixed = (entries, type) => ({
    min: Math.min(...entries.map((entry) => entry[type])),
    max: Math.max(...entries.map((entry) => entry[type])),
    avg: parseFloat((entries.reduce((a, b) => a + b[type], 0) / entries.length).toFixed(2))
});

export const mapRounded = (entries, type) => ({
    min: Math.min(...entries.map((entry) => entry[type])),
    max: Math.max(...entries.map((entry) => entry[type])),
    avg: Math.round(entries.reduce((a, b) => a + b[type], 0) / entries.length)
});