import nodes from '../models/Node.js';

export const listAll = async () => await nodes.findAll()
    .then((result) => result.map((node) => ({...node, password: node.password !== null})));

export const create = async (name, url, password) => await nodes.create({name: name, url: url, password: password});

export const deleteNode = async (nodeId) => await nodes.destroy({where: {id: nodeId}});

export const getOne = async (nodeId) => await nodes.findOne({where: {id: nodeId}});

export const updateName = async (nodeId, name) => await nodes.update({name: name}, {where: {id: nodeId}});

export const updatePassword = async (nodeId, password) => await nodes.update({password: password}, {where: {id: nodeId}});

export const checkStatus = async (url, password) => {
    try {
        const headers = password && password !== "none" ? {password} : {};
        const res = await fetch(url + "/api/config", {headers});

        if (res.status === 401) return "PASSWORD_REQUIRED";
        if (!res.ok) return "INVALID_URL";

        const data = await res.json();
        if (!data.ping) return "INVALID_URL";
        if (data.viewMode) return "PASSWORD_REQUIRED";
        return "NODE_VALID";
    } catch {
        return "INVALID_URL";
    }
}

const SKIP_HEADERS = new Set(["host", "content-length", "connection"]);
const serverError = (res) => res.status(500).json({message: "Internal server error"});

export const proxyRequest = async (url, req, res) => {
    const headers = Object.fromEntries(
        Object.entries(req.headers).filter(([k]) => !SKIP_HEADERS.has(k.toLowerCase()))
    );

    try {
        const response = await fetch(url, {
            method: req.method,
            headers,
            body: req.method === "GET" ? undefined : JSON.stringify(req.body),
            signal: req.signal
        });

        if (response.status >= 500) return serverError(res);

        const disposition = response.headers.get("content-disposition");
        if (disposition) res.setHeader("content-disposition", disposition);

        res.status(response.status).json(await response.json().catch(() => null));
    } catch {
        serverError(res);
    }
}
