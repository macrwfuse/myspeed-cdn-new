import {Dialog, DialogHeader, DialogBody, DialogFooter} from "@/common/contexts/Dialog";
import {t} from "i18next";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faArrowDown, faArrowUp, faCheck, faExclamationTriangle, faTableTennis, faWandMagicSparkles} from "@fortawesome/free-solid-svg-icons";
import "./styles.sass";
import React, {useContext, useEffect, useState} from "react";
import {jsonRequest, patchRequest} from "@/common/utils/RequestUtil";
import {ConfigContext} from "@/common/contexts/Config";
import {ToastNotificationContext} from "@/common/contexts/ToastNotification";

export const OptimalValuesDialog = ({open, onClose}) => {
    const [config, reloadConfig] = useContext(ConfigContext);
    const updateToast = useContext(ToastNotificationContext);
    const [ping, setPing] = useState(config.ping || "");
    const [download, setDownload] = useState(config.download || "");
    const [upload, setUpload] = useState(config.upload || "");
    const [recommendations, setRecommendations] = useState(null);

    useEffect(() => {
        if (!open) return;
        jsonRequest("/recommendations").then((result) => {
            if (!result.message) setRecommendations(result);
        }).catch(() => {});
    }, [open]);

    const applyRecommendations = () => {
        if (recommendations) {
            setPing(recommendations.ping.toString());
            setDownload(recommendations.download.toString());
            setUpload(recommendations.upload.toString());
        }
    };

    const update = async (close) => {
        if ((ping && /[^0-9.]/.test(ping)) || (download && /[^0-9.]/.test(download)) || (upload && /[^0-9.]/.test(upload))) {
            updateToast(t("dropdown.invalid"), "red", faExclamationTriangle);
            return;
        }
        try {
            if (ping !== config.ping) await patchRequest("/config/ping", {value: ping});
            if (download !== config.download) await patchRequest("/config/download", {value: download});
            if (upload !== config.upload) await patchRequest("/config/upload", {value: upload});
            reloadConfig();
            updateToast(t("dropdown.changes_applied"), "green", faCheck);
            close();
        } catch (e) {
            updateToast(t("dropdown.changes_unsaved"), "red", faExclamationTriangle);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} className="optimal-values-dialog">
            {({close}) => (
                <>
                    <DialogHeader onClose={close}>{t("optimal_values.title")}</DialogHeader>
                    <DialogBody>
                        <div className="optimal-values-content">
                            <div className="optimal-values-speeds">
                                <div className="optimal-values-speed">
                                    <div className="optimal-values-speed-header">
                                        <FontAwesomeIcon icon={faTableTennis}/>
                                        <div className="optimal-values-speed-text">
                                            <h2>{t("latest.ping")}</h2>
                                            <p>{t("welcome.ms")}</p>
                                        </div>
                                    </div>
                                    <input type="number" placeholder={recommendations?.ping || ""} className="dialog-input"
                                           value={ping} onChange={(e) => setPing(e.target.value)}/>
                                </div>
                                <div className="optimal-values-speed">
                                    <div className="optimal-values-speed-header">
                                        <FontAwesomeIcon icon={faArrowDown}/>
                                        <div className="optimal-values-speed-text">
                                            <h2>{t("latest.down")}</h2>
                                            <p>{t("welcome.mbps")}</p>
                                        </div>
                                    </div>
                                    <input type="number" placeholder={recommendations?.download || ""} className="dialog-input"
                                           value={download} onChange={(e) => setDownload(e.target.value)}/>
                                </div>
                                <div className="optimal-values-speed">
                                    <div className="optimal-values-speed-header">
                                        <FontAwesomeIcon icon={faArrowUp}/>
                                        <div className="optimal-values-speed-text">
                                            <h2>{t("latest.up")}</h2>
                                            <p>{t("welcome.mbps")}</p>
                                        </div>
                                    </div>
                                    <input type="number" placeholder={recommendations?.upload || ""} className="dialog-input"
                                           value={upload} onChange={(e) => setUpload(e.target.value)}/>
                                </div>
                            </div>
                        </div>
                    </DialogBody>
                    <DialogFooter>
                        {recommendations && (
                            <button className="dialog-btn" onClick={applyRecommendations}>
                                <FontAwesomeIcon icon={faWandMagicSparkles}/>
                                <span>{t("optimal_values.use_recommended")}</span>
                            </button>
                        )}
                        <button className="dialog-btn" onClick={() => update(close)}>{t("dialog.update")}</button>
                    </DialogFooter>
                </>
            )}
        </Dialog>
    );
};
