import express from 'express';
import * as config from '../controller/config.js';
import * as timer from '../tasks/timer.js';
import * as nodeUpdateTask from '../tasks/nodeUpdate.js';
import * as nodeUpdateSettings from '../util/nodeUpdateSettings.js';
import password from '../middlewares/password.js';

const app = express.Router();

// 访客(只读)不应看到节点自动更新的开关与定时
const VIEW_MODE_HIDDEN = [
    "ooklaId", "libreId", "libreUrl", "cron", "scheduleOffset", "passwordLevel",
    ...config.NODE_UPDATE_KEYS
];

app.get("/", password(true), async (req, res) => {
    let configValues = {};
    (await config.listAll()).forEach(row => {
        if (row.key !== "password" && !(req.viewMode && VIEW_MODE_HIDDEN.includes(row.key)))
            configValues[row.key] = row.value;
    });
    configValues['viewMode'] = req.viewMode;
    configValues['previewMode'] = process.env.PREVIEW_MODE === "true";

    if (process.env.PREVIEW_MODE === "true")
        configValues['previewMessage'] = String(process.env.PREVIEW_MESSAGE || "The owner of this instance has not provided a message");

    if (Object.keys(configValues).length === 0) return res.status(404).json({message: "Hmm. There are no config values. Weird..."});
    res.json(configValues);
});

app.patch("/:key", password(false), async (req, res) => {
    const value = await config.validateInput(req.params.key, req.body?.value);
    if (Object.keys(value).length !== 1) return res.status(400).json({message: value});

    if (!await config.updateValue(req.params.key, value.value))
        return res.status(500).json({message: `Error updating the key '${req.params.key}'`});

    if (req.params.key === "cron") {
        timer.stopTimer();
        timer.startTimer(req.body.value.toString());
    }

    // 节点自动更新配置变更: 重新落共享文件(CDN 调度器靠它生效)并重启定时器。
    // 已启用的服务商会立即跑一轮, 让用户马上看到设置是否生效。
    if (config.NODE_UPDATE_KEYS.includes(req.params.key)) {
        const settings = await nodeUpdateSettings.sync();
        await nodeUpdateTask.reload();

        const provider = req.params.key.startsWith("ookla") ? "ookla"
            : req.params.key.startsWith("libre") ? "libre" : null;

        // 刚开启的服务商立即跑一轮, 让用户马上看到效果(重复触发由任务内部去重)
        if (provider && settings[provider].enabled)
            nodeUpdateTask.runOnce(provider).then(undefined);
    }

    res.json({message: `The key '${req.params.key}' has been successfully updated`});
});

export default app;