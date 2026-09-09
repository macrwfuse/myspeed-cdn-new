import {useState, useEffect} from "react";
import {faNetworkWired, faLocationDot, faBuilding, faRefresh} from "@fortawesome/free-solid-svg-icons";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import "./styles.sass";
import {t} from "i18next";

const NetworkInfo = () => {
    const [networkInfo, setNetworkInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchNetworkInfo = async () => {
        setLoading(true);
        try {
            const response = await fetch("/api/info/network-info");
            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.message || `HTTP ${response.status}`);
            }
            const data = await response.json();
            if (!data.ip) throw new Error("No IP in response");
            setNetworkInfo(data);
            setError(null);
        } catch (err) {
            console.error("Network info fetch failed:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNetworkInfo();
        const interval = setInterval(fetchNetworkInfo, 300000);
        return () => clearInterval(interval);
    }, []);

    if (loading && !networkInfo) return (
        <div className="network-info-area">
            <div className="network-info-item">
                <FontAwesomeIcon icon={faNetworkWired} className="network-icon"/>
                <span className="network-label">{t("network.ip")}</span>
                <span className="network-value loading">{t("network.loading")}</span>
            </div>
        </div>
    );

    if (error && !networkInfo) return (
        <div className="network-info-area">
            <div className="network-info-item">
                <FontAwesomeIcon icon={faNetworkWired} className="network-icon"/>
                <span className="network-label">{t("network.ip")}</span>
                <span className="network-value error">{t("network.error")}</span>
                <FontAwesomeIcon icon={faRefresh} className="network-icon network-retry" onClick={fetchNetworkInfo}/>
            </div>
        </div>
    );

    const location = [networkInfo.city, networkInfo.region, networkInfo.country].filter(Boolean).join(", ");

    return (
        <div className="network-info-area">
            <div className="network-info-item">
                <FontAwesomeIcon icon={faNetworkWired} className="network-icon"/>
                <span className="network-label">{t("network.ip")}</span>
                <span className="network-value">{networkInfo.ip}</span>
            </div>
            {networkInfo.isp && (
                <div className="network-info-item">
                    <FontAwesomeIcon icon={faBuilding} className="network-icon"/>
                    <span className="network-label">{t("network.isp")}</span>
                    <span className="network-value">{networkInfo.isp}</span>
                </div>
            )}
            {location && (
                <div className="network-info-item">
                    <FontAwesomeIcon icon={faLocationDot} className="network-icon"/>
                    <span className="network-label">{t("network.location")}</span>
                    <span className="network-value">{location}</span>
                </div>
            )}
        </div>
    );
};

export default NetworkInfo;
