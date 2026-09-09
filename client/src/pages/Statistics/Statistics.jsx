import {
    ArcElement, BarElement,
    CategoryScale,
    Chart as ChartJS,
    Legend,
    LinearScale,
    LineElement,
    PointElement,
    RadialLinearScale,
    Title,
    Tooltip,
    Filler
} from "chart.js";
import {useEffect, useState, useCallback, startTransition, useDeferredValue} from "react";
import {jsonRequest} from "@/common/utils/RequestUtil";
import DateRangePicker from "@/common/components/DateRangePicker";
import ChartModal from "@/common/components/ChartModal";
import SpeedChart from "@/pages/Statistics/charts/SpeedChart";
import LatestTestChart from "@/pages/Statistics/charts/LatestTestChart";
import PingChart from "@/pages/Statistics/charts/PingChart";
import OverviewChart from "@/pages/Statistics/charts/OverviewChart";
import AverageChart from "@/pages/Statistics/charts/AverageChart";
import HourlyChart from "@/pages/Statistics/charts/HourlyChart.jsx";
import ConsistencyChart from "@/pages/Statistics/charts/ConsistencyChart";
import ExportButton from "@/common/components/ExportButton";
import i18n, {t} from "i18next";
import "./styles.sass";

ChartJS.register(ArcElement, Tooltip, CategoryScale, LinearScale, PointElement, LineElement, Title, Legend, BarElement, RadialLinearScale, Filler);

const crosshairPlugin = {
    id: 'crosshair',
    afterDraw: (chart) => {
        if (chart.tooltip?._active?.length) {
            const ctx = chart.ctx;
            const activePoint = chart.tooltip._active[0];
            const x = activePoint.element.x;
            const topY = chart.scales.y.top;
            const bottomY = chart.scales.y.bottom;

            ctx.save();
            ctx.beginPath();
            ctx.setLineDash([5, 5]);
            ctx.moveTo(x, topY);
            ctx.lineTo(x, bottomY);
            ctx.lineWidth = 1;
            ctx.strokeStyle = 'hsla(215, 20%, 65%, 0.6)';
            ctx.stroke();
            ctx.restore();
        }
    }
};

if (!ChartJS.registry.plugins.get('crosshair')) ChartJS.register(crosshairPlugin);

ChartJS.defaults.color = "hsl(215, 20%, 55%)";
ChartJS.defaults.font.color = "hsl(215, 20%, 55%)";
ChartJS.defaults.font.family = "Inter, sans-serif";
ChartJS.defaults.font.weight = 500;
ChartJS.defaults.font.size = 11;
ChartJS.defaults.elements.line.tension = 0.35;
ChartJS.defaults.elements.line.borderWidth = 2.5;
ChartJS.defaults.elements.point.radius = 0;
ChartJS.defaults.elements.point.hoverRadius = 5;
ChartJS.defaults.elements.point.hoverBorderWidth = 2;
ChartJS.defaults.elements.arc.borderWidth = 0;
ChartJS.defaults.plugins.legend.labels.usePointStyle = true;
ChartJS.defaults.plugins.legend.labels.pointStyle = 'circle';
ChartJS.defaults.plugins.legend.labels.padding = 16;
ChartJS.defaults.plugins.legend.labels.boxWidth = 8;
ChartJS.defaults.plugins.legend.labels.boxHeight = 8;


export const Statistics = () => {
    const [statistics, setStatistics] = useState(null);
    const [latestTest, setLatestTest] = useState(null);
    const [loading, setLoading] = useState(true);
    const [expandedChart, setExpandedChart] = useState(null);
    const [mountPhase, setMountPhase] = useState(0);

    const [dateRange, setDateRange] = useState(() => {
        const to = new Date();
        const from = new Date();
        from.setDate(from.getDate() - 7);
        return { from, to };
    });

    const deferredStatistics = useDeferredValue(statistics);
    const isStale = deferredStatistics !== statistics;

    useEffect(() => {
        const timer = setTimeout(() => setMountPhase(1), 50);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (mountPhase === 1) {
            const timer = setTimeout(() => setMountPhase(2), 150);
            return () => clearTimeout(timer);
        }
    }, [mountPhase]);

    const formatDateParam = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const updateStats = useCallback(() => {
        const fromParam = formatDateParam(dateRange.from);
        const toParam = formatDateParam(dateRange.to);
        startTransition(() => setLoading(true));
        Promise.all([
            jsonRequest(`/speedtests/statistics/?from=${fromParam}&to=${toParam}`),
            jsonRequest("/speedtests?limit=1")
        ]).then(([stats, tests]) => {
            startTransition(() => {
                setStatistics(stats);
                setLatestTest(tests.length > 0 ? tests[0] : null);
                setLoading(false);
            });
        }).catch(error => {
            console.error("Failed to load statistics:", error);
            startTransition(() => setLoading(false));
        });
    }, [dateRange]);

    const handleDateRangeChange = (from, to) => setDateRange({ from, to });

    useEffect(() => {
        if (mountPhase >= 2) updateStats();
    }, [mountPhase, updateStats]);

    useEffect(() => {
        const callback = () => updateStats();
        i18n.on("languageChanged", callback);
        return () => i18n.off("languageChanged", callback);
    }, []);

    if (mountPhase === 0) return null;

    if (loading && !deferredStatistics) {
        return (
            <div className="statistic-area statistic-loading">
                <div className="statistics-header">
                    <div className="skeleton-picker skeleton-visible"></div>
                </div>
                <div className="skeleton-chart skeleton-visible"></div>
                <div className="skeleton-chart skeleton-visible"></div>
                <div className="skeleton-chart skeleton-visible"></div>
            </div>
        );
    }

    if (!deferredStatistics) return <></>;
    if (!deferredStatistics.tests || deferredStatistics.tests.total === 0) return (
        <div className="statistic-area">
            <div className="statistics-header">
                <DateRangePicker 
                    from={dateRange.from} 
                    to={dateRange.to} 
                    onChange={handleDateRangeChange}
                />
            </div>
            <div className="statistics-empty">
                <p>{t("test.not_available")}</p>
            </div>
        </div>
    );

    const renderChart = (chartType) => {
        switch (chartType) {
            case 'overview':
                return <OverviewChart tests={deferredStatistics.tests} time={deferredStatistics.time} dateRange={dateRange}/>;
            case 'latest':
                return <LatestTestChart test={latestTest} expanded/>;
            case 'consistency':
                return <ConsistencyChart consistency={deferredStatistics.consistency}/>;
            case 'download':
                return <SpeedChart labels={deferredStatistics.labels} data={deferredStatistics.data} dataKey="download" titleKey="latest.down" color="hsl(187, 94%, 43%)" failed={deferredStatistics.failed} errors={deferredStatistics.errors} />;
            case 'upload':
                return <SpeedChart labels={deferredStatistics.labels} data={deferredStatistics.data} dataKey="upload" titleKey="latest.up" color="hsl(258, 90%, 66%)" failed={deferredStatistics.failed} errors={deferredStatistics.errors} />;
            case 'ping':
                return <PingChart labels={deferredStatistics.labels} data={deferredStatistics.data} failed={deferredStatistics.failed} errors={deferredStatistics.errors}/>;
            case 'hourly':
                return <HourlyChart hourlyAverages={deferredStatistics.hourlyAverages}/>;
            case 'avgDownload':
                return <AverageChart title={t("statistics.values.down")} data={deferredStatistics.download}/>;
            case 'avgUpload':
                return <AverageChart title={t("statistics.values.up")} data={deferredStatistics.upload}/>;
            default:
                return null;
        }
    };

    return (
        <div className={`statistic-area${isStale ? ' statistic-stale' : ''}`}>
            <div className="statistics-header">
                <DateRangePicker 
                    from={dateRange.from} 
                    to={dateRange.to} 
                    onChange={handleDateRangeChange}
                />
                <ExportButton dateRange={dateRange} />
            </div>

            <OverviewChart tests={deferredStatistics.tests} time={deferredStatistics.time} dateRange={dateRange} onClick={() => setExpandedChart('overview')}/>
            <LatestTestChart test={latestTest} onClick={() => setExpandedChart('latest')}/>
            <ConsistencyChart consistency={deferredStatistics.consistency} onClick={() => setExpandedChart('consistency')}/>

            <SpeedChart labels={deferredStatistics.labels} data={deferredStatistics.data} dataKey="download" titleKey="latest.down" color="hsl(187, 94%, 43%)" failed={deferredStatistics.failed} errors={deferredStatistics.errors} onClick={() => setExpandedChart('download')} compact/>
            <SpeedChart labels={deferredStatistics.labels} data={deferredStatistics.data} dataKey="upload" titleKey="latest.up" color="hsl(258, 90%, 66%)" failed={deferredStatistics.failed} errors={deferredStatistics.errors} onClick={() => setExpandedChart('upload')} compact/>
            <PingChart labels={deferredStatistics.labels} data={deferredStatistics.data} failed={deferredStatistics.failed} errors={deferredStatistics.errors} onClick={() => setExpandedChart('ping')} compact/>

            <HourlyChart hourlyAverages={deferredStatistics.hourlyAverages} onClick={() => setExpandedChart('hourly')}/>

            <AverageChart title={t("statistics.values.down")} data={deferredStatistics.download} onClick={() => setExpandedChart('avgDownload')}/>
            <AverageChart title={t("statistics.values.up")} data={deferredStatistics.upload} onClick={() => setExpandedChart('avgUpload')}/>

            <ChartModal 
                isOpen={!!expandedChart} 
                onClose={() => setExpandedChart(null)}
                isChart={['download', 'upload', 'ping', 'hourly'].includes(expandedChart)}
            >
                {expandedChart && renderChart(expandedChart)}
            </ChartModal>
        </div>
    );
}