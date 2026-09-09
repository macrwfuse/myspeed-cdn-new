import React, {useContext, useEffect, useRef, useState} from "react";
import "./styles.sass";
import {
    faCircleNodes,
    faClock,
    faGlobeEurope,
    faInfo,
    faKey,
    faPause,
    faPlay,
    faSliders,
    faHardDrive,
    faGauge,
    faUserGear
} from "@fortawesome/free-solid-svg-icons";
import {ConfigContext} from "@/common/contexts/Config";
import {StatusContext} from "@/common/contexts/Status";
import {useAlert} from "@/common/contexts/Alert";
import {postRequest} from "@/common/utils/RequestUtil";
import {t} from "i18next";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {ToastNotificationContext} from "@/common/contexts/ToastNotification";
import {IntegrationDialog} from "@/common/components/IntegrationDialog";
import LanguageDialog from "@/common/components/LanguageDialog";
import ProviderDialog from "@/common/components/ProviderDialog";
import StorageDialog from "@/common/components/StorageDialog";
import OptimalValuesDialog from "@/common/components/OptimalValuesDialog";
import FrequencyDialog from "@/common/components/FrequencyDialog";
import PasswordDialog from "@/common/components/PasswordDialog";
import PauseDialog from "@/common/components/PauseDialog";
import PreferencesDialog from "@/common/components/PreferencesDialog";

const DropdownComponent = ({isOpen, switchDropdown}) => {
    const [config] = useContext(ConfigContext);
    const [status, updateStatus] = useContext(StatusContext);
    const updateToast = useContext(ToastNotificationContext);
    const alert = useAlert();
    const [showIntegrationDialog, setShowIntegrationDialog] = useState(false);
    const [showLanguageDialog, setShowLanguageDialog] = useState(false);
    const [showProviderDialog, setShowProviderDialog] = useState(false);
    const [showStorageDialog, setShowStorageDialog] = useState(false);
    const [showOptimalValuesDialog, setShowOptimalValuesDialog] = useState(false);
    const [showFrequencyDialog, setShowFrequencyDialog] = useState(false);
    const [showPasswordDialog, setShowPasswordDialog] = useState(false);
    const [showPauseDialog, setShowPauseDialog] = useState(false);
    const [showPreferencesDialog, setShowPreferencesDialog] = useState(false);
    const ref = useRef();

    useEffect(() => {
        const onPress = event => {
            if (event.code === "Escape" && isOpen) {
                switchDropdown();
            }
        }

        const onClick = event => {
            let headerIcon = event.composedPath()[1].id || event.composedPath()[2].id;
            if (isOpen && !ref.current.contains(event.target) && headerIcon !== "open-header") {
                switchDropdown();
            }
        }

        document.addEventListener("mousedown", onClick);
        document.addEventListener("keyup", onPress);
        return () => {
            document.removeEventListener("keyup", onPress);
            document.removeEventListener("mousedown", onClick);
        }
    }, [isOpen]);
    
    const togglePause = async () => {
        if (!status.paused) {
            setShowPauseDialog(true);
        } else {
            await postRequest("/speedtests/continue");
            updateStatus();
        }
    };

    const showProviderDetails = () => alert.openAlert(
        t("dropdown.provider"),
        config.previewMessage,
        { buttonText: t("dialog.close") }
    );

    const options = [
        {run: () => setShowOptimalValuesDialog(true), icon: faGauge, text: t("dropdown.optimal_values")},
        {hr: true, key: 1},
        {run: () => setShowProviderDialog(true), icon: faSliders, text: t("dropdown.change_provider")},
        {run: () => setShowStorageDialog(true), icon: faHardDrive, text: t("dropdown.storage")},
        {run: () => setShowPasswordDialog(true), icon: faKey, text: t("dropdown.password"), previewHidden: true},
        {run: () => setShowFrequencyDialog(true), icon: faClock, text: t("dropdown.cron")},
        {run: togglePause, icon: status.paused ? faPlay : faPause, text: t("dropdown." + (status.paused ? "resume_tests" : "pause_tests"))},
        {run: () => setShowIntegrationDialog(true), icon: faCircleNodes, text: t("dropdown.integrations")},
        {hr: true, key: 2},
        {run: () => setShowLanguageDialog(true), icon: faGlobeEurope, text: t("dropdown.language"), allowView: true},
        {run: () => setShowPreferencesDialog(true), icon: faUserGear, text: t("dropdown.preferences"), allowView: true},
        {run: showProviderDetails, icon: faInfo, text: t("dropdown.provider"), previewShown: true}
    ];

    return (
        <>
            <IntegrationDialog open={showIntegrationDialog} onClose={() => setShowIntegrationDialog(false)}/>
            <LanguageDialog open={showLanguageDialog} onClose={() => setShowLanguageDialog(false)}/>
            <ProviderDialog open={showProviderDialog} onClose={() => setShowProviderDialog(false)}/>
            <StorageDialog open={showStorageDialog} onClose={() => setShowStorageDialog(false)}/>
            <OptimalValuesDialog open={showOptimalValuesDialog} onClose={() => setShowOptimalValuesDialog(false)}/>
            <FrequencyDialog open={showFrequencyDialog} onClose={() => setShowFrequencyDialog(false)}/>
            <PasswordDialog open={showPasswordDialog} onClose={() => setShowPasswordDialog(false)}/>
            <PauseDialog open={showPauseDialog} onClose={() => setShowPauseDialog(false)} onPause={updateStatus}/>
            <PreferencesDialog open={showPreferencesDialog} onClose={() => setShowPreferencesDialog(false)}/>
            <div className={`dropdown ${isOpen ? '' : 'dropdown-invisible'}`} ref={ref}>
                <div className="dropdown-content">
                    <h2>{t("dropdown.settings")}</h2>
                    <div className="dropdown-entries">
                        {options.map(entry => {
                            if (entry.previewHidden && config.previewMode) return;
                            if (entry.previewShown && !config.previewMode) return;
                            if (!config.viewMode || (config.viewMode && entry.allowView)) {
                                if (!entry.hr) {
                                    return (<div className="dropdown-item" onClick={() => {
                                        switchDropdown();
                                        entry.run();
                                    }} key={entry.run}>
                                        <FontAwesomeIcon icon={entry.icon}/>
                                        <h3>{entry.text}</h3>
                                    </div>);
                                } else return (<div className="center" key={entry.key}>
                                    <hr className="dropdown-hr"/>
                                </div>);
                            }
                        })}
                    </div>
                </div>
            </div>
        </>
    );
}

export default DropdownComponent;