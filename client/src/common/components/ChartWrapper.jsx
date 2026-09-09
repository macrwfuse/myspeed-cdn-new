import {useRef, useEffect, useState} from "react";
import {Chart} from "chart.js";
import "../utils/chartConfig";

export default function ChartWrapper({type, data, options}) {
    const canvasRef = useRef(null);
    const chartRef = useRef(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setReady(true), 0);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (!ready || !canvasRef.current) return;
        if (!chartRef.current) {
            chartRef.current = new Chart(canvasRef.current, {type, data, options});
        } else {
            chartRef.current.data = data;
            chartRef.current.options = options;
            chartRef.current.update("none");
        }
    }, [ready, type, data, options]);

    useEffect(() => () => {
        chartRef.current?.destroy();
        chartRef.current = null;
    }, []);

    return <canvas ref={canvasRef}/>;
}
