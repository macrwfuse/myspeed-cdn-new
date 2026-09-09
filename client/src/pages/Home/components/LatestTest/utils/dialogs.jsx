import {t} from "i18next";
import {Trans} from "react-i18next";
import {formatTime} from "@/common/utils/FormatUtil";

export const downloadInfo = () => ({title: t("info.down.title"), description: t("info.down.description"), buttonText: t("dialog.okay")});

export const pingInfo = () => ({title: t("info.ping.title"), description: t("info.ping.description"), buttonText: t("dialog.okay")});

export const jitterInfo = () => ({title: t("info.jitter.title"), description: t("info.jitter.description"), buttonText: t("dialog.okay")});

export const uploadInfo = () => ({title: t("info.up.title"), description: t("info.up.description"), buttonText: t("dialog.okay")});

export const latestTestInfo = (latest, preferences) => ({
    title: t("info.latest.title"),
    description: latest.created ? <Trans shouldUnescape components={{Bold: <span className="dialog-value"/>}}
                                         values={{date: new Date(latest.created).toLocaleDateString(),
                                             time: formatTime(latest.created, preferences)}}>
        info.latest.description</Trans> : t("test.no_latest"),
    buttonText: t("dialog.okay")
});