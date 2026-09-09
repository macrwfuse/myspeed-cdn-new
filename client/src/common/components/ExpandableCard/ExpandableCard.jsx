import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faChevronDown, faChevronUp} from "@fortawesome/free-solid-svg-icons";
import {useState} from "react";
import "./styles.sass";

export const ExpandableCard = ({
    icon,
    title,
    subtitle,
    statusDot,
    actions,
    children,
    defaultExpanded = false,
    error = false,
    success = false
}) => {
    const [expanded, setExpanded] = useState(defaultExpanded);

    return (
        <div className={`expandable-card ${error ? "card-error" : ""} ${success ? "card-success" : ""}`}>
            <div className="expandable-card-header" onClick={() => setExpanded(!expanded)}>
                <div className="expandable-card-info">
                    {icon && (
                        <div className="expandable-card-icon">
                            <FontAwesomeIcon icon={icon}/>
                        </div>
                    )}
                    <div className="expandable-card-details">
                        <h3>{title}</h3>
                        {(subtitle || statusDot) && (
                            <div className="expandable-card-status">
                                {statusDot && <span className={`status-dot ${statusDot}`}/>}
                                {subtitle && <span className="status-text">{subtitle}</span>}
                            </div>
                        )}
                    </div>
                </div>
                <div className="expandable-card-actions">
                    {actions}
                    <button className="card-action-btn expand-btn">
                        <FontAwesomeIcon icon={expanded ? faChevronUp : faChevronDown}/>
                    </button>
                </div>
            </div>

            {expanded && (
                <div className="expandable-card-body">
                    {children}
                </div>
            )}
        </div>
    );
};
