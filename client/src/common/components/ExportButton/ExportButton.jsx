import { useState, useRef, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDownload, faChevronDown, faFileLines, faCode } from "@fortawesome/free-solid-svg-icons";
import { t } from "i18next";
import "./styles.sass";

export const ExportButton = ({ dateRange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [exporting, setExporting] = useState(false);
    const dropdownRef = useRef(null);
    const buttonRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target) &&
                buttonRef.current && !buttonRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const formatDateParam = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const handleExport = async (format) => {
        setExporting(true);
        setIsOpen(false);

        try {
            const fromParam = formatDateParam(dateRange.from);
            const toParam = formatDateParam(dateRange.to);
            const url = `/api/speedtests/export?from=${fromParam}&to=${toParam}&format=${format}`;
            
            const response = await fetch(url);
            if (!response.ok) throw new Error('Export failed');
            
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `myspeed-export-${fromParam}-to-${toParam}.${format}`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(downloadUrl);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Export failed:', error);
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="export-button-container">
            <button 
                className="export-button" 
                ref={buttonRef}
                onClick={() => setIsOpen(!isOpen)}
                disabled={exporting}
            >
                <FontAwesomeIcon icon={faDownload} className="export-icon" />
                <span className="export-text">{t("statistics.export.button")}</span>
                <FontAwesomeIcon icon={faChevronDown} className={`chevron-icon ${isOpen ? 'open' : ''}`} />
            </button>

            {isOpen && (
                <div className="export-dropdown" ref={dropdownRef}>
                    <div className="export-option" onClick={() => handleExport('csv')}>
                        <FontAwesomeIcon icon={faFileLines} />
                        <span>{t("storage.csv")}</span>
                    </div>
                    <div className="export-option" onClick={() => handleExport('json')}>
                        <FontAwesomeIcon icon={faCode} />
                        <span>{t("storage.json")}</span>
                    </div>
                </div>
            )}
        </div>
    );
};
