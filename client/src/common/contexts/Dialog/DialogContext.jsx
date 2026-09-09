import React, {useCallback, useEffect, useRef, useState} from "react";
import {createPortal} from "react-dom";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faClose} from "@fortawesome/free-solid-svg-icons";
import "./styles.sass";

export const Dialog = ({open, onClose, className, disableClose, children}) => {
    const areaRef = useRef();
    const dialogRef = useRef();
    const [visible, setVisible] = useState(false);
    const isClosingRef = useRef(false);

    useEffect(() => {
        if (open && !visible) {
            setVisible(true);
            isClosingRef.current = false;
        } else if (!open && visible && !isClosingRef.current) {
            isClosingRef.current = true;
            areaRef.current?.classList.add("dialog-area-hidden");
            dialogRef.current?.classList.add("dialog-hidden");
        }
    }, [open, visible]);

    const handleClose = useCallback(() => {
        if (disableClose || isClosingRef.current) return;
        isClosingRef.current = true;
        areaRef.current?.classList.add("dialog-area-hidden");
        dialogRef.current?.classList.add("dialog-hidden");
    }, [disableClose]);

    const forceClose = useCallback(() => {
        if (isClosingRef.current) return;
        isClosingRef.current = true;
        areaRef.current?.classList.add("dialog-area-hidden");
        dialogRef.current?.classList.add("dialog-hidden");
    }, []);

    const handleAnimationEnd = (e) => {
        if (e.animationName === "fadeOut") {
            setVisible(false);
            isClosingRef.current = false;
            onClose?.();
        }
    };

    const handleBackdropClick = (e) => {
        if (e.target === areaRef.current) handleClose();
    };

    useEffect(() => {
        if (!visible) return;
        const handleKeyDown = (e) => {
            if (e.key === "Escape" && !disableClose) {
                e.preventDefault();
                handleClose();
            }
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [visible, disableClose, handleClose]);

    if (!visible) return null;

    return createPortal(
        <div className="dialog-area" ref={areaRef} onClick={handleBackdropClick}>
            <div className={`dialog${className ? ` ${className}` : ""}`} ref={dialogRef}
                 onAnimationEnd={handleAnimationEnd}>
                {typeof children === "function" ? children({close: handleClose, forceClose}) : children}
            </div>
        </div>,
        document.body
    );
};

export const DialogHeader = ({children, onClose, disableClose}) => (
    <div className="dialog-header">
        <h4 className="dialog-text">{children}</h4>
        {!disableClose && <FontAwesomeIcon icon={faClose} className="dialog-text dialog-icon" onClick={onClose}/>}
    </div>
);

export const DialogBody = ({children}) => <div className="dialog-main">{children}</div>;

export const DialogFooter = ({children}) => <div className="dialog-buttons">{children}</div>;
