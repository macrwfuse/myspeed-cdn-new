import React, {createContext, useEffect, useState} from "react";
import {useAlert} from "../Alert";
import {request} from "@/common/utils/RequestUtil";
import {apiErrorDialog, passwordRequiredDialog} from "@/common/contexts/Config/dialog";
import WelcomeDialog from "@/common/components/WelcomeDialog";
import {useNavigate} from "react-router-dom";

export const ConfigContext = createContext({});

export const ConfigProvider = (props) => {
    const [config, setConfig] = useState({});
    const alert = useAlert();
    const [welcomeShown, setWelcomeShown] = useState(false);
    const navigate = useNavigate();


    const reloadConfig = () => {
        request("/config").then(async res => {
            if (res.status === 401) throw 1;
            if (!res.ok) throw 2;

            try {
                return JSON.parse(await res.text());
            } catch (e) {
                throw 2;
            }
        }).then(result => {
            if (config !== result)
                result.viewMode && localStorage.getItem("currentNode") !== null && localStorage.getItem("currentNode") !== "0"
                    ? navigate("/nodes") : setConfig(result);
        }).catch((code) => {
            localStorage.getItem("currentNode") !== null && localStorage.getItem("currentNode") !== "0"
                ? navigate("/nodes") : showErrorDialog(code);
        });
    }

    const showErrorDialog = async (code) => {
        const dialogConfig = code === 1 ? passwordRequiredDialog() : apiErrorDialog();
        
        if (code === 1) {
            const result = await alert.openInput(dialogConfig.title, {
                placeholder: dialogConfig.placeholder,
                description: dialogConfig.description,
                inputType: dialogConfig.type,
                buttonText: dialogConfig.buttonText,
                disableClose: dialogConfig.disableCloseButton
            });
            if (result) dialogConfig.onSuccess(result);
        } else {
            await alert.openAlert(dialogConfig.title, dialogConfig.description, {
                buttonText: dialogConfig.buttonText,
                disableClose: dialogConfig.disableCloseButton
            });
            dialogConfig.onSuccess();
        }
    };

    const checkConfig = async () => (await request("/config")).json();

    useEffect(reloadConfig, []);

    useEffect(() => {
        if (config.previewMode && !localStorage.getItem("welcomeShown")) setWelcomeShown(true);
        if (!config.previewMode && config.provider === "none") setWelcomeShown(true);
    }, [config]);

    return (
        <ConfigContext.Provider value={[config, reloadConfig, checkConfig]}>
            <WelcomeDialog open={welcomeShown} onClose={() => setWelcomeShown(false)}/>
            {props.children}
        </ConfigContext.Provider>
    )
}