import "./styles.sass";

export const Tooltip = ({children, content, position = "bottom"}) => {
    if (!content) return children;

    return (
        <div className="tooltip-wrapper">
            {children}
            <div className={`tooltip-popup tooltip-${position}`}>
                <span className="tooltip-content">{content}</span>
                <span className="tooltip-arrow"/>
            </div>
        </div>
    );
};