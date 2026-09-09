import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faChevronDown, faPlus} from "@fortawesome/free-solid-svg-icons";
import {useState, useRef} from "react";
import "./styles.sass";

export const DropdownSelect = ({
    items,
    onSelect,
    buttonText,
    buttonIcon = faPlus,
    disabled = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    const handleBlur = (event) => {
        if (!containerRef.current?.contains(event.relatedTarget)) {
            setIsOpen(false);
        }
    };

    const handleSelect = (item) => {
        onSelect(item);
        setIsOpen(false);
    };

    if (disabled) return null;

    return (
        <div className="dropdown-select-container" ref={containerRef} onBlur={handleBlur} tabIndex={-1}>
            <button className="dropdown-select-btn" onClick={() => setIsOpen(!isOpen)}>
                <FontAwesomeIcon icon={buttonIcon}/>
                <span>{buttonText}</span>
                <FontAwesomeIcon icon={faChevronDown} className={`dropdown-select-chevron ${isOpen ? "rotated" : ""}`}/>
            </button>

            {isOpen && (
                <div className="dropdown-select-menu">
                    {items.map((item, index) => (
                        <div key={item.key || index} className="dropdown-select-item" onClick={() => handleSelect(item)} tabIndex={0}>
                            {item.icon && <FontAwesomeIcon icon={item.icon}/>}
                            <span>{item.label}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
