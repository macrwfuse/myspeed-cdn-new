import "./styles.sass";
import BorderAnimation from "@/common/components/BorderAnimation";

export const StatisticContainer = (props) => {
    const showAnimation = props.running && !props.expanded;

    return (
        <div className={"stats-container" + (props.size ? " container-" + props.size : "") + (showAnimation ? " container-running" : "")} onClick={props.onClick}>
            {showAnimation && <BorderAnimation />}
            <div className="stats-header">
                {props.title}
            </div>
            <div className={"stats-content " + (props.center ?" container-center" : "")}>
                {props.children}
            </div>
        </div>
    );
}