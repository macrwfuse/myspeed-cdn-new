import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faQuestion} from "@fortawesome/free-solid-svg-icons";
import {useTranslation} from "react-i18next";
import "./styles.sass";

export const NotFound = () => {
    const {t} = useTranslation();

    return (
        <div className="not-found-page">
            <div className="not-found-content">
                <div className="not-found-icon">
                    <FontAwesomeIcon icon={faQuestion} size="4x"/>
                </div>
                <h1 className="not-found-title">404</h1>
                <h2 className="not-found-subtitle">{t("not_found.title")}</h2>
                <p className="not-found-description">{t("not_found.description")}</p>
            </div>
        </div>
    );
};
