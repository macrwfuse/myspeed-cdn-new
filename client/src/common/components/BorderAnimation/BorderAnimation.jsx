import {useRef, useState, useEffect, useMemo} from "react";
import "./styles.sass";

const BORDER_RADIUS = 14;

export const BorderAnimation = ({color = "var(--accent-primary)"}) => {
    const ref = useRef(null);
    const [size, setSize] = useState({w: 100, h: 100});

    useEffect(() => {
        const parent = ref.current?.parentElement;
        if (!parent) return;

        const update = () => {
            setSize({w: parent.offsetWidth, h: parent.offsetHeight});
        };

        update();

        const resizeObserver = new ResizeObserver(update);
        resizeObserver.observe(parent);

        return () => resizeObserver.disconnect();
    }, []);

    const {w, h} = size;
    const r = BORDER_RADIUS;
    const inset = 1.5;

    const path = useMemo(() => {
        const iw = w - inset * 2;
        const ih = h - inset * 2;
        const ir = Math.min(r, iw / 2, ih / 2);

        return `
            M ${w / 2} ${inset}
            H ${w - inset - ir}
            Q ${w - inset} ${inset} ${w - inset} ${inset + ir}
            V ${h - inset - ir}
            Q ${w - inset} ${h - inset} ${w - inset - ir} ${h - inset}
            H ${inset + ir}
            Q ${inset} ${h - inset} ${inset} ${h - inset - ir}
            V ${inset + ir}
            Q ${inset} ${inset} ${inset + ir} ${inset}
            H ${w / 2}
        `;
    }, [w, h, r]);

    const perimeter = useMemo(() => {
        const iw = w - inset * 2;
        const ih = h - inset * 2;
        const ir = Math.min(r, iw / 2, ih / 2);
        return 2 * (iw - 2 * ir) + 2 * (ih - 2 * ir) + 2 * Math.PI * ir;
    }, [w, h, r]);

    const dashLength = Math.min(200, perimeter * 0.15);
    const gapLength = perimeter - dashLength;
    const duration = Math.max(1.5, perimeter / 600);

    return (
        <svg
            ref={ref}
            className="border-animation-svg"
        >
            <path
                d={path}
                fill="none"
                stroke={color}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeDasharray={`${dashLength} ${gapLength}`}
                style={{
                    animation: `border-travel ${duration}s linear infinite`
                }}
            />
            <style>{`
                @keyframes border-travel { 
                    from { stroke-dashoffset: 0; } 
                    to { stroke-dashoffset: -${perimeter}; } 
                }
            `}</style>
        </svg>
    );
};
