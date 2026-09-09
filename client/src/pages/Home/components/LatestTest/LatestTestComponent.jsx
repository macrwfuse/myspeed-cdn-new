import {useContext, useEffect, useState} from "react";
import {faArrowDown, faArrowUp, faClockRotateLeft, faPingPongPaddleBall, faWaveSquare} from "@fortawesome/free-solid-svg-icons";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {generateRelativeTime} from "./utils";
import {StatusContext} from "@/common/contexts/Status";
import {useAlert} from "@/common/contexts/Alert";
import {SpeedtestContext} from "@/common/contexts/Speedtests";
import {ConfigContext} from "@/common/contexts/Config";
import BorderAnimation from "@/common/components/BorderAnimation";
import "./styles.sass";
import {getIconBySpeed} from "@/common/utils/TestUtil";
import {downloadInfo, jitterInfo, latestTestInfo, pingInfo, uploadInfo} from "@/pages/Home/components/LatestTest/utils/dialogs";
import {t} from "i18next";
import {PreferencesContext} from "@/common/contexts/Preferences";
import {convertSpeed, getSpeedUnit} from "@/common/utils/FormatUtil";

const LoadingValue = ({ children }) => {
    return (
        <span className="loading-value">{children}</span>
    );
};

const LatestTestComponent = () => {
    const status = useContext(StatusContext)[0];
    const [latest, setLatest] = useState(null);
    const [latestTestTime, setLatestTestTime] = useState("N/A");
    const alert = useAlert();
    const {speedtests} = useContext(SpeedtestContext);
    const config = useContext(ConfigContext)[0];
    const [preferences] = useContext(PreferencesContext);
    const speedUnit = getSpeedUnit(preferences);

    useEffect(() => {
        setLatest(speedtests.length !== 0 ? speedtests[0] : {ping: "N/A", download: "N/A", upload: "N/A"});
    }, [speedtests]);

    useEffect(() => {
        if (latest) setLatestTestTime(generateRelativeTime(latest.created));
        const interval = setInterval(() => setLatestTestTime(generateRelativeTime(latest ? latest.created : 0)), 1000);
        return () => clearInterval(interval);
    }, [latest]);

    if (Object.entries(config).length === 0) return (<></>);
    if (latest === null) return (<></>);

    const getAreaClass = () => {
        if (status.running) return "analyse-area test-running";
        if (status.paused) return "analyse-area tests-paused";
        return "analyse-area pulse";
    };

    const showPingInfo = () => {
        const info = pingInfo();
        alert.openAlert(info.title, info.description, {buttonText: info.buttonText});
    };

    const showJitterInfo = () => {
        const info = jitterInfo();
        alert.openAlert(info.title, info.description, {buttonText: info.buttonText});
    };

    const showDownloadInfo = () => {
        const info = downloadInfo();
        alert.openAlert(info.title, info.description, {buttonText: info.buttonText});
    };

    const showUploadInfo = () => {
        const info = uploadInfo();
        alert.openAlert(info.title, info.description, {buttonText: info.buttonText});
    };

    const showLatestTestInfo = () => {
        const info = latestTestInfo(latest, preferences);
        alert.openAlert(info.title, info.description, {buttonText: info.buttonText});
    };

    return (
        <div className={getAreaClass()}>
            {status.running && <BorderAnimation />}
            <div className="inner-container">
                <div className="container-header">
                    <FontAwesomeIcon onClick={showPingInfo} icon={faPingPongPaddleBall}
                                     className={"container-icon help-icon icon-" + getIconBySpeed(latest.ping, config.ping, false)}/>
                    <h2 className="container-text">{t("latest.ping")}<span
                        className="container-subtext">{t("latest.ping_unit")}</span></h2>
                </div>
                <div className="container-main">
                    <h2>
                        {status.running ? (
                            <LoadingValue>{latest.ping === -1 ? "N/A" : latest.ping}</LoadingValue>
                        ) : (
                            latest.ping === -1 ? "N/A" : latest.ping
                        )}
                        {latest.jitter !== null && latest.jitter !== undefined && (
                            <span className="jitter-suffix" onClick={showJitterInfo} title={t("latest.jitter")}>
                                <FontAwesomeIcon icon={faWaveSquare} className="jitter-icon" />{latest.jitter}
                            </span>
                        )}
                    </h2>
                </div>
            </div>

            <div className="inner-container">
                <div className="container-header">
                    <FontAwesomeIcon onClick={showDownloadInfo} icon={faArrowDown}
                                     className={"container-icon help-icon icon-" + getIconBySpeed(latest.download, config.download, true)}/>
                    <h2 className="container-text">{t("latest.down")}<span
                        className="container-subtext">{speedUnit}</span></h2>
                </div>
                <div className="container-main">
                    <h2>
                        {status.running ? (
                            <LoadingValue>{latest.download === -1 ? "N/A" : convertSpeed(latest.download, preferences)}</LoadingValue>
                        ) : (
                            latest.download === -1 ? "N/A" : convertSpeed(latest.download, preferences)
                        )}
                    </h2>
                </div>
            </div>

            <div className="mobile-break"></div>

            <div className="inner-container">
                <div className="container-header">
                    <FontAwesomeIcon onClick={showUploadInfo} icon={faArrowUp}
                                     className={"container-icon help-icon icon-" + getIconBySpeed(latest.upload, config.upload, true)}/>
                    <h2 className="container-text">{t("latest.up")}<span
                        className="container-subtext">{speedUnit}</span></h2>
                </div>
                <div className="container-main">
                    <h2>
                        {status.running ? (
                            <LoadingValue>{latest.upload === -1 ? "N/A" : convertSpeed(latest.upload, preferences)}</LoadingValue>
                        ) : (
                            latest.upload === -1 ? "N/A" : convertSpeed(latest.upload, preferences)
                        )}
                    </h2>
                </div>
            </div>

            <div className="inner-container">
                <div className="container-header">
                    <FontAwesomeIcon onClick={showLatestTestInfo} icon={faClockRotateLeft}
                                     className="container-icon icon-blue help-icon"/>
                    <h2 className="container-text">{t("latest.latest")}<span
                        className="container-subtext">{t("latest.before")}</span></h2>
                </div>
                <div className="container-main">
                    <h2>
                        {status.running ? (
                            <LoadingValue>{latestTestTime}</LoadingValue>
                        ) : (
                            latestTestTime
                        )}
                    </h2>
                </div>
            </div>
        </div>
    )
}

export default LatestTestComponent;