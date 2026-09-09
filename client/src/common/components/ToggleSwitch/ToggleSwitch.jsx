import "./styles.sass";

export const ToggleSwitch = ({checked, onChange, disabled = false}) => (
    <label className={`toggle-switch ${disabled ? "toggle-disabled" : ""}`}>
        <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            disabled={disabled}
        />
        <span className="toggle-slider"/>
    </label>
);
