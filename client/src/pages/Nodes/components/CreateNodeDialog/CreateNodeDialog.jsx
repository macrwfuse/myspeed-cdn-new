import {Dialog, DialogHeader, DialogBody, DialogFooter} from "@/common/contexts/Dialog";
import {useAlert} from "@/common/contexts/Alert";
import React, {useContext, useState} from "react";
import "./styles.sass";
import {t} from "i18next";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faCircleInfo, faServer} from "@fortawesome/free-solid-svg-icons";
import {baseRequest} from "@/common/utils/RequestUtil";
import {ToastNotificationContext} from "@/common/contexts/ToastNotification";
import {NodeContext} from "@/common/contexts/Node";

export const CreateNodeDialog = ({open, onClose}) => {
    const alert = useAlert();
    const updateNodes = useContext(NodeContext)[1];
    const updateToast = useContext(ToastNotificationContext);
    const [invalidUrl, setInvalidUrl] = useState(false);
    const [serverName, setServerName] = useState("");
    const [serverUrl, setServerUrl] = useState("");

    const runPasswordProcess = async (wrong = false) => {
        const password = await alert.openInput(t("dialog.password.title"), {
            inputType: "password",
            description: wrong ? <span className="icon-red">{t("dialog.password.wrong")}</span> : t("nodes.password_required"),
            placeholder: t("dialog.password.placeholder"),
            buttonText: t("nodes.create")
        });
        if (password) {
            const res = await (await baseRequest("/nodes", "PUT", {
                name: serverName, url: serverUrl, password
            })).json();
            if (res.type === "PASSWORD_REQUIRED") runPasswordProcess(true);
            else if (res.type === "NODE_CREATED") {
                updateNodes();
                updateToast(t("nodes.created"), "green", faServer);
            }
        }
    };

    const createNode = async (close) => {
        const response = await (await baseRequest("/nodes", "PUT", {name: serverName, url: serverUrl})).json();
        if (response.type === "INVALID_URL") setInvalidUrl(true);
        else if (response.type === "PASSWORD_REQUIRED") {
            close();
            runPasswordProcess();
        } else if (response.type === "NODE_CREATED") {
            updateNodes();
            close();
            updateToast(t("nodes.created"), "green", faServer);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} className="create-node-dialog">
            {({close}) => (
                <>
                    <DialogHeader onClose={close}>{t("nodes.add")}</DialogHeader>
                    <DialogBody>
                        <div className="server-dialog">
                            <div className="server-group">
                                <div className="server-label">
                                    <FontAwesomeIcon icon={faCircleInfo}/>
                                    <h3>{t("nodes.group.name")}</h3>
                                </div>
                                <input type="text" className="dialog-input server-input" placeholder={t("nodes.placeholder.name")} value={serverName}
                                       onChange={(e) => setServerName(e.target.value)}/>
                            </div>
                            <div className={"server-group" + (invalidUrl ? " server-error" : "")}>
                                <div className="server-label">
                                    <FontAwesomeIcon icon={faServer}/>
                                    <h3>{t("nodes.group.url")}</h3>
                                </div>
                                <input type="text" className="dialog-input server-input" placeholder={t("nodes.placeholder.url")} value={serverUrl}
                                       onChange={(e) => { setServerUrl(e.target.value); setInvalidUrl(false); }}/>
                            </div>
                        </div>
                    </DialogBody>
                    <DialogFooter>
                        <button className="dialog-btn" onClick={() => createNode(close)}>{t("nodes.create")}</button>
                    </DialogFooter>
                </>
            )}
        </Dialog>
    );
}