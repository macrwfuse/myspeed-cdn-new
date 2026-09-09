import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faExclamationTriangle} from "@fortawesome/free-solid-svg-icons";
import {useNavigate, useRouteError, isRouteErrorResponse} from "react-router-dom";
import {useTranslation} from "react-i18next";
import "./styles.sass";

export const RouteError = () => {
    const error = useRouteError();
    const navigate = useNavigate();
    const {t} = useTranslation();

    const is404 = isRouteErrorResponse(error) && error.status === 404;

    return (
        <div className="route-error-page">
            <div className="route-error-content">
                <div className="route-error-icon">
                    <FontAwesomeIcon icon={faExclamationTriangle} size="4x"/>
                </div>
                <h1 className="route-error-title">
                    {is404 ? "404" : t("route_error.title")}
                </h1>
                <h2 className="route-error-subtitle">
                    {is404 ? t("not_found.title") : t("route_error.subtitle")}
                </h2>
                <p className="route-error-description">
                    {is404 ? t("not_found.description") : t("route_error.description")}
                </p>
                {!is404 && error?.message && (
                    <pre className="route-error-details">{error.message}</pre>
                )}
                <div className="route-error-actions">
                    <button className="dialog-btn" onClick={() => navigate("/")}>
                        {t("not_found.back_home")}
                    </button>
                    {!is404 && (
                        <button className="dialog-btn dialog-secondary" onClick={() => window.location.reload()}>
                            {t("route_error.reload")}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
