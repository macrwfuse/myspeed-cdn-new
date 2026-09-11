import React, {useContext, useState} from "react";
import {Dialog, DialogHeader, DialogBody, DialogFooter} from "@/common/contexts/Dialog";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faArrowRotateRight, faCheck, faCloud, faGauge, faServer} from "@fortawesome/free-solid-svg-icons";
import {t} from "i18next";
import {patchRequest} from "@/common/utils/RequestUtil";
import {ConfigContext} from "@/common/contexts/Config";
import {ToastNotificationContext} from "@/common/contexts/ToastNotification";
import {PreferencesContext} from "@/common/contexts/Preferences";
import {formatDateTime} from "@/common/utils/FormatUtil";
import ToggleSwitch from "@/common/components/ToggleSwitch";
import {CronExpressionParser} from "cron-parser";
import "./styles.sass";

const PRESETS = [
    {id: "hourly", cron: "17 * * * *"},
    {id: "daily", cron: "17 3 * * *"},
    {id: "twice_daily", cron: "17 3,15 * * *"},
    {id: "weekly", cron: "17 3 * * 0"}
];

const DEFAULT_CRON = "17 3 * * *";

const PROVIDERS = [
    {id: "ookla", icon: faGauge},
    {id: "libre", icon: faServer},
    {id: "cdn", icon: faCloud}
];

const getNextRunDate = (cron) => {
    try {
        return CronExpressionParser.parse(cron).next().toDate();
    } catch {
        return null;
    }
};

const ProviderSection = ({provider, value, onChange, nextRun}) => {
    // 是否处于"自定义"模式: 手动改过 cron 后即使内容恰好等于某个预设, 也保持自定义
    const isPreset = !value.custom && PRESETS.some(p => p.cron === value.cron);

    return (
        <div className="node-update-section">
            <div className="node-update-header">
                <FontAwesomeIcon icon={provider.icon}/>
                <div className="node-update-title">
                    <h3>{t(`node_update.${provider.id}.title`)}</h3>
                    <p>{t(`node_update.${provider.id}.description`)}</p>
                </div>
                <ToggleSwitch checked={value.enabled}
                    onChange={(enabled) => onChange({...value, enabled})}/>
            </div>

            {value.enabled && (
                <div className="node-update-schedule">
                    <select className="dialog-input node-update-preset"
                        value={isPreset ? value.cron : "custom"}
                        onChange={(e) => {
                            if (e.target.value === "custom") onChange({...value, custom: true});
                            else onChange({...value, cron: e.target.value, custom: false});
                        }}>
                        {PRESETS.map(preset => (
                            <option key={preset.id} value={preset.cron}>{t(`node_update.presets.${preset.id}`)}</option>
                        ))}
                        <option value="custom">{t("node_update.custom")}</option>
                    </select>

                    <input type="text" className="dialog-input node-update-cron"
                        value={value.cron}
                        onChange={(e) => onChange({...value, cron: e.target.value, custom: true})}
                        placeholder={DEFAULT_CRON}/>

                    <p className="node-update-next">
                        {nextRun
                            ? `${t("node_update.next_run")} ${nextRun}`
                            : t("node_update.invalid_cron")}
                    </p>
                </div>
            )}

            {provider.id === "cdn" && (
                <p className="node-update-hint">{t("node_update.cdn_hint")}</p>
            )}
        </div>
    );
};

export const NodeUpdateDialog = ({open, onClose}) => {
    const [config, reloadConfig] = useContext(ConfigContext);
    const updateToast = useContext(ToastNotificationContext);
    const [preferences] = useContext(PreferencesContext);
    const [saving, setSaving] = useState(false);

    const buildState = () => Object.fromEntries(PROVIDERS.map(({id}) => [id, {
        enabled: config[`${id}UpdateEnabled`] === "true",
        cron: config[`${id}UpdateCron`] || DEFAULT_CRON,
        custom: !PRESETS.some(p => p.cron === config[`${id}UpdateCron`])
    }]));

    const [state, setState] = useState(buildState);
    const [maxPing, setMaxPing] = useState(config.ooklaUpdateMaxPing || "100");

    const formatNextRun = (cron) => {
        const date = getNextRunDate(cron);
        return date ? formatDateTime(date, preferences) : null;
    };

    // 只校验已启用的服务商: 停用的即便 cron 填错也不该拦住保存
    const isValid = PROVIDERS.every(({id}) => !state[id].enabled || getNextRunDate(state[id].cron))
        && parseInt(maxPing, 10) > 0;

    const handleSave = async (close) => {
        setSaving(true);

        const requests = [];
        for (const {id} of PROVIDERS) {
            requests.push(patchRequest(`/config/${id}UpdateEnabled`, {value: state[id].enabled ? "true" : "false"}));

            // 停用的服务商也保存 cron(下次开启即沿用), 但内容非法时跳过以免整个保存失败
            if (state[id].enabled || getNextRunDate(state[id].cron))
                requests.push(patchRequest(`/config/${id}UpdateCron`, {value: state[id].cron}));
        }
        requests.push(patchRequest("/config/ooklaUpdateMaxPing", {value: maxPing}));

        const results = await Promise.all(requests);
        setSaving(false);

        if (results.every(res => res.ok)) {
            updateToast(t("dropdown.changes_applied"), "green", faCheck);
            reloadConfig();
            close();
        } else {
            updateToast(t("dropdown.changes_unsaved"), "red");
        }
    };

    return (
        <Dialog open={open} onClose={onClose} className="node-update-dialog">
            {({close}) => (
                <>
                    <DialogHeader onClose={close}>{t("node_update.title")}</DialogHeader>
                    <DialogBody>
                        <div className="node-update-content">
                            <p className="node-update-intro">{t("node_update.intro")}</p>

                            {PROVIDERS.map(provider => (
                                <ProviderSection key={provider.id}
                                    provider={provider}
                                    value={state[provider.id]}
                                    nextRun={formatNextRun(state[provider.id].cron)}
                                    onChange={(next) => setState({...state, [provider.id]: next})}/>
                            ))}

                            <div className="node-update-section">
                                <div className="node-update-header">
                                    <FontAwesomeIcon icon={faArrowRotateRight}/>
                                    <div className="node-update-title">
                                        <h3>{t("node_update.max_ping.title")}</h3>
                                        <p>{t("node_update.max_ping.description")}</p>
                                    </div>
                                    <input type="text" className="dialog-input node-update-max-ping"
                                        value={maxPing}
                                        onChange={(e) => setMaxPing(e.target.value)}
                                        placeholder="100"/>
                                </div>
                            </div>
                        </div>
                    </DialogBody>
                    <DialogFooter>
                        <button className="dialog-btn" onClick={() => handleSave(close)} disabled={saving || !isValid}>
                            {saving ? t("dialog.saving") : t("dialog.save")}
                        </button>
                    </DialogFooter>
                </>
            )}
        </Dialog>
    );
};
