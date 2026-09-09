import React, {useContext, useState} from "react";
import {Dialog, DialogHeader, DialogBody, DialogFooter} from "@/common/contexts/Dialog";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faCheck, faClock, faGauge, faMoon, faPalette, faSun} from "@fortawesome/free-solid-svg-icons";
import {t} from "i18next";
import {ToastNotificationContext} from "@/common/contexts/ToastNotification";
import {ThemeContext} from "@/common/contexts/Theme";
import SelectableOption, {SelectableList} from "@/common/components/SelectableOption";
import {
    PreferencesContext,
    SPEED_UNIT_MBPS,
    SPEED_UNIT_MBYTES,
    TIME_FORMAT_12H,
    TIME_FORMAT_24H
} from "@/common/contexts/Preferences";
import "./styles.sass";

const THEME_OPTIONS = [
    {id: "dark", labelKey: "preferences.theme.dark", descKey: "preferences.theme.dark_desc", icon: faMoon},
    {id: "light", labelKey: "preferences.theme.light", descKey: "preferences.theme.light_desc", icon: faSun}
];

const TIME_FORMAT_OPTIONS = [
    {id: TIME_FORMAT_24H, labelKey: "preferences.time_format.h24", descKey: "preferences.time_format.h24_desc"},
    {id: TIME_FORMAT_12H, labelKey: "preferences.time_format.h12", descKey: "preferences.time_format.h12_desc"}
];

const SPEED_UNIT_OPTIONS = [
    {id: SPEED_UNIT_MBPS, labelKey: "preferences.speed_unit.mbps", descKey: "preferences.speed_unit.mbps_desc"},
    {id: SPEED_UNIT_MBYTES, labelKey: "preferences.speed_unit.mbytes", descKey: "preferences.speed_unit.mbytes_desc"}
];

const PreferencesSection = ({icon, title, description, options, value, onChange}) => (
    <div className="preferences-section">
        <div className="preferences-section-header">
            <FontAwesomeIcon icon={icon}/>
            <div>
                <h3>{title}</h3>
                <p>{description}</p>
            </div>
        </div>
        <SelectableList>
            {options.map(option => (
                <SelectableOption
                    key={option.id}
                    icon={option.icon}
                    title={t(option.labelKey)}
                    description={t(option.descKey)}
                    active={value === option.id}
                    onClick={() => onChange(option.id)}
                />
            ))}
        </SelectableList>
    </div>
);

export const PreferencesDialog = ({open, onClose}) => {
    const [preferences, updatePreferences] = useContext(PreferencesContext);
    const [isDarkMode, toggleTheme] = useContext(ThemeContext);
    const updateToast = useContext(ToastNotificationContext);
    const [timeFormat, setTimeFormat] = useState(preferences.timeFormat);
    const [speedUnit, setSpeedUnit] = useState(preferences.speedUnit);
    const [theme, setTheme] = useState(isDarkMode ? "dark" : "light");

    const handleSave = (close) => {
        updatePreferences({timeFormat, speedUnit});
        const wantsDark = theme === "dark";
        if (wantsDark !== isDarkMode) toggleTheme();
        updateToast(t("dropdown.changes_applied"), "green", faCheck);
        close();
    };

    const handleClose = () => {
        setTimeFormat(preferences.timeFormat);
        setSpeedUnit(preferences.speedUnit);
        setTheme(isDarkMode ? "dark" : "light");
        onClose();
    };

    return (
        <Dialog open={open} onClose={handleClose} className="preferences-dialog">
            {({close}) => (
                <>
                    <DialogHeader onClose={close}>{t("preferences.title")}</DialogHeader>
                    <DialogBody>
                        <div className="preferences-content">
                            <PreferencesSection
                                icon={faPalette}
                                title={t("preferences.theme.title")}
                                description={t("preferences.theme.description")}
                                options={THEME_OPTIONS}
                                value={theme}
                                onChange={setTheme}
                            />
                            <PreferencesSection
                                icon={faClock}
                                title={t("preferences.time_format.title")}
                                description={t("preferences.time_format.description")}
                                options={TIME_FORMAT_OPTIONS}
                                value={timeFormat}
                                onChange={setTimeFormat}
                            />
                            <PreferencesSection
                                icon={faGauge}
                                title={t("preferences.speed_unit.title")}
                                description={t("preferences.speed_unit.description")}
                                options={SPEED_UNIT_OPTIONS}
                                value={speedUnit}
                                onChange={setSpeedUnit}
                            />
                        </div>
                    </DialogBody>
                    <DialogFooter>
                        <button className="dialog-btn" onClick={() => handleSave(close)}>
                            {t("dialog.save")}
                        </button>
                    </DialogFooter>
                </>
            )}
        </Dialog>
    );
};
