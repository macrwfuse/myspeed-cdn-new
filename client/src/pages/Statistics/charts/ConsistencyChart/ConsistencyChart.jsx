import { useContext, useMemo } from "react";
import { t } from "i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowDown, faArrowUp, faPingPongPaddleBall } from "@fortawesome/free-solid-svg-icons";
import StatisticContainer from "@/pages/Statistics/components/StatisticContainer";
import { PreferencesContext } from "@/common/contexts/Preferences";
import { convertSpeed, getSpeedUnit } from "@/common/utils/FormatUtil";
import "./styles.sass";

export const ConsistencyChart = (props) => {
    const [preferences] = useContext(PreferencesContext);
    const speedUnit = getSpeedUnit(preferences);

    const data = useMemo(() => {
        if (!props.consistency) return null;
        return props.consistency;
    }, [props.consistency]);

    if (!data) return null;

    const getConsistencyColor = (value) => {
        if (value >= 90) return 'icon-green';
        if (value >= 70) return 'icon-orange';
        return 'icon-red';
    };

    return (
        <StatisticContainer title={t("statistics.consistency.title")} onClick={props.onClick}>
            <div className="consistency-container">
                <div className="consistency-item">
                    <div className="consistency-info">
                        <h2>{t("latest.down")}</h2>
                        <p className={getConsistencyColor(data.download.consistency)}>
                            {data.download.consistency}%
                        </p>
                        <span className="consistency-detail">±{convertSpeed(data.download.stdDev, preferences)} {speedUnit}</span>
                    </div>
                    <FontAwesomeIcon icon={faArrowDown} className={getConsistencyColor(data.download.consistency)} />
                </div>

                <div className="consistency-item">
                    <div className="consistency-info">
                        <h2>{t("latest.up")}</h2>
                        <p className={getConsistencyColor(data.upload.consistency)}>
                            {data.upload.consistency}%
                        </p>
                        <span className="consistency-detail">±{convertSpeed(data.upload.stdDev, preferences)} {speedUnit}</span>
                    </div>
                    <FontAwesomeIcon icon={faArrowUp} className={getConsistencyColor(data.upload.consistency)} />
                </div>

                <div className="consistency-item">
                    <div className="consistency-info">
                        <h2>{t("latest.ping")}</h2>
                        <p className="icon-orange">
                            ±{data.ping.stdDev} {t("latest.ping_unit")}
                        </p>
                        <span className="consistency-detail">{t("statistics.consistency.ping_variance")}</span>
                    </div>
                    <FontAwesomeIcon icon={faPingPongPaddleBall} className="icon-orange" />
                </div>
            </div>
        </StatisticContainer>
    );
};