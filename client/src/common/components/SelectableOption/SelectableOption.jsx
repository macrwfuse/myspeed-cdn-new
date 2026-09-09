import React from "react";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import "./styles.sass";

export const SelectableList = ({children, className = "", ...rest}) => (
    <div className={`selectable-list ${className}`.trim()} {...rest}>
        {children}
    </div>
);

export const SelectableOption = ({
    active = false,
    onClick,
    icon,
    image,
    title,
    description,
    showRadio = true,
    className = "",
    children
}) => {
    const classes = [
        "selectable-option",
        active ? "selectable-option-active" : "",
        className
    ].filter(Boolean).join(" ");

    return (
        <div className={classes} onClick={onClick}>
            {icon && (
                <FontAwesomeIcon icon={icon} className="selectable-option-icon"/>
            )}
            {image && (
                <img src={image.src} alt={image.alt || ""} className="selectable-option-image"/>
            )}
            <div className="selectable-option-text">
                {children ?? (
                    <>
                        {title !== undefined && <h3>{title}</h3>}
                        {description !== undefined && <p>{description}</p>}
                    </>
                )}
            </div>
            {showRadio && (
                <div className={`selectable-option-radio${active ? " selectable-option-radio-active" : ""}`}/>
            )}
        </div>
    );
};