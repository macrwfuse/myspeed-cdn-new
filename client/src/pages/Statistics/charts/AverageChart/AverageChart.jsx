import StatisticContainer from "@/pages/Statistics/components/StatisticContainer";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faGauge, faMinusCircle, faPlusCircle} from "@fortawesome/free-solid-svg-icons";
import {useContext} from "react";
import {t} from "i18next";
import {PreferencesContext} from "@/common/contexts/Preferences";
import {convertSpeed, getSpeedUnit} from "@/common/utils/FormatUtil";
import "./styles.sass";

export const AverageChart = (props) => {
    const [preferences] = useContext(PreferencesContext);
    const speedUnit = getSpeedUnit(preferences);

    return (
        <StatisticContainer title={props.title} size="small" center={true} onClick={props.onClick}>
            <div className="value-container">
                <div className="value-item">
                    <div className="value-info">
                        <h2>{t("statistics.values.min")}</h2>
                        <p>{convertSpeed(props.data.min, preferences)} {speedUnit}</p>
                    </div>
                    <FontAwesomeIcon icon={faMinusCircle}/>
                </div>
                <div className="value-item">
                    <div className="value-info">
                        <h2>{t("statistics.values.max")}</h2>
                        <p>{convertSpeed(props.data.max, preferences)} {speedUnit}</p>
                    </div>
                    <FontAwesomeIcon icon={faPlusCircle}/>
                </div>
                <div className="value-item">
                    <div className="value-info">
                        <h2>{t("statistics.values.avg")}</h2>
                        <p>{convertSpeed(props.data.avg, preferences)} {speedUnit}</p>
                    </div>
                    <FontAwesomeIcon icon={faGauge}/>
                </div>
            </div>
        </StatisticContainer>
    );

}