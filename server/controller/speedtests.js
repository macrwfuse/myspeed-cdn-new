import tests from '../models/Speedtests.js';
import { Op, Sequelize } from 'sequelize';
import { mapFixed, mapRounded } from '../util/helpers.js';
import { getValue } from './config.js';

const DEFAULT_RETENTION_DAYS = 365;

export const create = async (ping, download, upload, time, serverId, type = "auto", resultId = null, error = null, jitter = null, serverName = null, serverHost = null) => {
    return (await tests.create({ping, jitter, download, upload, error, serverId, serverName, serverHost, type, resultId, time, created: new Date().toISOString()})).id;
}

export const getOne = async (id) => {
    let speedtest = await tests.findByPk(id);
    if (speedtest === null) return null;
    if (speedtest.error === null) delete speedtest.error;
    return speedtest
}

export const listAll = async () => {
    let dbEntries = await tests.findAll({order: [["created", "DESC"]]});
    for (let dbEntry of dbEntries) {
        if (dbEntry.error === null) delete dbEntry.error;
        if (dbEntry.resultId === null) delete dbEntry.resultId;
    }

    return dbEntries;
}

export const listTests = async (afterId, limit) => {
    limit = parseInt(limit) || 10;

    let whereClause = {};
    
    if (afterId) whereClause.id = {[Op.lt]: afterId};

    let dbEntries = await tests.findAll({
        where: Object.keys(whereClause).length > 0 ? whereClause : undefined, 
        order: [["created", "DESC"]], 
        limit
    });

    for (let dbEntry of dbEntries) {
        if (dbEntry.error === null) delete dbEntry.error;
        if (dbEntry.resultId === null) delete dbEntry.resultId;
    }

    return dbEntries;
}

export const deleteTests = async () => {
    await tests.destroy({where: {}});
    return true;
}

export const importTests = async (data) => {
    if (!Array.isArray(data)) return false;

    for (let entry of data) {
        if (entry.error === null) delete entry.error;
        if (entry.resultId === null) delete entry.resultId;

        if (!["custom", "auto"].includes(entry.type)) continue;
        if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/.test(entry.created)) continue;

        try {
            console.log(entry)
            await tests.create(entry);
        } catch (e) {
        }
    }

    return true;
}

export const listStatistics = async (fromDate, toDate) => {
    const [fromYear, fromMonth, fromDay] = fromDate.split('-').map(Number);
    const [toYear, toMonth, toDay] = toDate.split('-').map(Number);
    
    const from = new Date(fromYear, fromMonth - 1, fromDay, 0, 0, 0, 0);
    const to = new Date(toYear, toMonth - 1, toDay, 23, 59, 59, 999);
    
    const dbEntries = (await tests.findAll({order: [["created", "DESC"]]}))
        .filter((entry) => {
            const entryDate = new Date(entry.created);
            return entryDate >= from && entryDate <= to;
        });

    let notFailed = dbEntries.filter((entry) => entry.error === null);

    const daysDiff = Math.ceil((to - from) / (1000 * 60 * 60 * 24));
    const dataPointCount = dbEntries.length;
    const TARGET_CHART_POINTS = 300;

    let data = {};
    ["ping", "jitter", "download", "upload", "time"].forEach(item => {
        data[item] = notFailed.map(entry => entry[item]);
    });

    const hourlyData = {};
    for (let i = 0; i < 24; i++) {
        hourlyData[i] = { download: [], upload: [], ping: [], jitter: [] };
    }
    
    notFailed.forEach(entry => {
        const hour = new Date(entry.created).getHours();
        hourlyData[hour].download.push(entry.download);
        hourlyData[hour].upload.push(entry.upload);
        hourlyData[hour].ping.push(entry.ping);
        if (entry.jitter !== null) hourlyData[hour].jitter.push(entry.jitter);
    });

    const hourlyAverages = Object.keys(hourlyData).map(hour => ({
        hour: parseInt(hour),
        download: hourlyData[hour].download.length > 0 
            ? parseFloat((hourlyData[hour].download.reduce((a, b) => a + b, 0) / hourlyData[hour].download.length).toFixed(2))
            : null,
        upload: hourlyData[hour].upload.length > 0
            ? parseFloat((hourlyData[hour].upload.reduce((a, b) => a + b, 0) / hourlyData[hour].upload.length).toFixed(2))
            : null,
        ping: hourlyData[hour].ping.length > 0
            ? Math.round(hourlyData[hour].ping.reduce((a, b) => a + b, 0) / hourlyData[hour].ping.length)
            : null,
        jitter: hourlyData[hour].jitter.length > 0
            ? parseFloat((hourlyData[hour].jitter.reduce((a, b) => a + b, 0) / hourlyData[hour].jitter.length).toFixed(2))
            : null,
        count: hourlyData[hour].download.length
    }));

    const calcStdDev = (arr) => {
        if (arr.length < 2) return 0;
        const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
        const squaredDiffs = arr.map(val => Math.pow(val - mean, 2));
        return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / arr.length);
    };

    const downloadValues = notFailed.map(e => e.download);
    const uploadValues = notFailed.map(e => e.upload);
    const pingValues = notFailed.map(e => e.ping);

    const downloadMean = downloadValues.length > 0 ? downloadValues.reduce((a, b) => a + b, 0) / downloadValues.length : 0;
    const uploadMean = uploadValues.length > 0 ? uploadValues.reduce((a, b) => a + b, 0) / uploadValues.length : 0;

    const consistency = {
        download: {
            stdDev: parseFloat(calcStdDev(downloadValues).toFixed(2)),
            consistency: downloadMean > 0 ? parseFloat((100 - (calcStdDev(downloadValues) / downloadMean * 100)).toFixed(1)) : 100
        },
        upload: {
            stdDev: parseFloat(calcStdDev(uploadValues).toFixed(2)),
            consistency: uploadMean > 0 ? parseFloat((100 - (calcStdDev(uploadValues) / uploadMean * 100)).toFixed(1)) : 100
        },
        ping: {
            stdDev: parseFloat(calcStdDev(pingValues).toFixed(2)),
            jitter: parseFloat(calcStdDev(pingValues).toFixed(2))
        }
    };

    let chartData = data;
    let chartLabels = notFailed.map((entry) => new Date(entry.created).toISOString());
    let chartFailed = notFailed.map(() => false);
    let chartErrors = notFailed.map(() => null);
    const allEntriesSorted = [...dbEntries].sort((a, b) => new Date(a.created) - new Date(b.created));
    
    if (allEntriesSorted.length <= TARGET_CHART_POINTS) {
        chartLabels = allEntriesSorted.map((entry) => new Date(entry.created).toISOString());
        chartFailed = allEntriesSorted.map((entry) => entry.error !== null);
        chartErrors = allEntriesSorted.map((entry) => entry.error);
        chartData = {
            ping: allEntriesSorted.map(entry => entry.error === null ? entry.ping : null),
            jitter: allEntriesSorted.map(entry => entry.error === null ? entry.jitter : null),
            download: allEntriesSorted.map(entry => entry.error === null ? entry.download : null),
            upload: allEntriesSorted.map(entry => entry.error === null ? entry.upload : null),
            time: allEntriesSorted.map(entry => entry.error === null ? entry.time : null)
        };
    } else {
        const bucketCount = TARGET_CHART_POINTS;
        const timeRange = to.getTime() - from.getTime();
        const bucketSize = timeRange / bucketCount;
        
        const buckets = [];
        for (let i = 0; i < bucketCount; i++) {
            buckets.push({
                startTime: from.getTime() + (i * bucketSize),
                endTime: from.getTime() + ((i + 1) * bucketSize),
                entries: [],
                failed: 0,
                errors: []
            });
        }
        
        allEntriesSorted.forEach(entry => {
            const entryTime = new Date(entry.created).getTime();
            const bucketIndex = Math.min(Math.floor((entryTime - from.getTime()) / bucketSize), bucketCount - 1);
            if (bucketIndex >= 0 && bucketIndex < bucketCount) {
                buckets[bucketIndex].entries.push(entry);
                if (entry.error !== null) {
                    buckets[bucketIndex].failed++;
                    buckets[bucketIndex].errors.push(entry.error);
                }
            }
        });
        
        chartLabels = [];
        chartFailed = [];
        chartErrors = [];
        chartData = { ping: [], jitter: [], download: [], upload: [], time: [] };
        
        buckets.forEach((bucket, index) => {
            const validEntries = bucket.entries.filter(e => e.error === null);
            
            if (validEntries.length === 0) {
                if (bucket.failed > 0) {
                    chartLabels.push(new Date(bucket.startTime + bucketSize / 2).toISOString());
                    chartFailed.push(true);
                    chartErrors.push(bucket.errors.join('; '));
                    chartData.ping.push(null);
                    chartData.jitter.push(null);
                    chartData.download.push(null);
                    chartData.upload.push(null);
                    chartData.time.push(null);
                }
                return;
            }
            
            const midTime = bucket.startTime + bucketSize / 2;
            let closestEntry = validEntries[0];
            let closestDiff = Math.abs(new Date(closestEntry.created).getTime() - midTime);
            
            validEntries.forEach(entry => {
                const diff = Math.abs(new Date(entry.created).getTime() - midTime);
                if (diff < closestDiff) {
                    closestDiff = diff;
                    closestEntry = entry;
                }
            });
            
            const avgPing = Math.round(validEntries.reduce((sum, e) => sum + e.ping, 0) / validEntries.length);
            const jitterEntries = validEntries.filter(e => e.jitter !== null);
            const avgJitter = jitterEntries.length > 0 
                ? parseFloat((jitterEntries.reduce((sum, e) => sum + e.jitter, 0) / jitterEntries.length).toFixed(2))
                : null;
            const avgDownload = parseFloat((validEntries.reduce((sum, e) => sum + e.download, 0) / validEntries.length).toFixed(2));
            const avgUpload = parseFloat((validEntries.reduce((sum, e) => sum + e.upload, 0) / validEntries.length).toFixed(2));
            const avgTime = Math.round(validEntries.reduce((sum, e) => sum + e.time, 0) / validEntries.length);
            
            chartLabels.push(new Date(midTime).toISOString());
            chartFailed.push(bucket.failed > 0);
            chartErrors.push(bucket.failed > 0 ? `${bucket.failed} failed in period` : null);
            chartData.ping.push(avgPing);
            chartData.jitter.push(avgJitter);
            chartData.download.push(avgDownload);
            chartData.upload.push(avgUpload);
            chartData.time.push(avgTime);
        });
    }

    return {
        tests: {
            total: dbEntries.length,
            failed: dbEntries.length - notFailed.length
        },
        ping: mapRounded(notFailed, "ping"),
        jitter: mapFixed(notFailed.filter(e => e.jitter !== null), "jitter"),
        download: mapFixed(notFailed, "download"),
        upload: mapFixed(notFailed, "upload"),
        time: mapRounded(notFailed, "time"),
        data: chartData,
        labels: chartLabels,
        failed: chartFailed,
        errors: chartErrors,
        hourlyAverages,
        consistency,
        dataPoints: chartLabels.length,
        rawDataPoints: dataPointCount,
        downsampled: dataPointCount > TARGET_CHART_POINTS,
        dateRange: {
            from: fromDate,
            to: toDate,
            days: daysDiff
        }
    };
}

export const deleteOne = async (id) => {
    if (await getOne(id) === null) return false;
    await tests.destroy({where: {id: id}});
    return true;
}

export const removeOld = async () => {
    const stored = await getValue("retentionDays");
    const days = parseInt(stored ?? DEFAULT_RETENTION_DAYS);

    if (!Number.isFinite(days) || days <= 0) return true;

    await tests.destroy({
        where: {
            created: process.env.DB_TYPE === "mysql"
                ? {[Op.lte]: new Date(new Date().getTime() - days * 24 * 3600000)}
                : {[Op.lte]: Sequelize.literal(`datetime('now', '-${days} days')`)}
        }
    });
    return true;
}

export const getLatest = async () => {
    let latest = await tests.findOne({order: [["created", "DESC"]]});
    if (latest === null) return undefined;
    if (latest.error === null) delete latest.error;
    if (latest.resultId === null) delete latest.resultId;
    return latest;
}

export const exportTests = async (fromDate, toDate) => {
    const [fromYear, fromMonth, fromDay] = fromDate.split('-').map(Number);
    const [toYear, toMonth, toDay] = toDate.split('-').map(Number);
    
    const from = new Date(fromYear, fromMonth - 1, fromDay, 0, 0, 0, 0);
    const to = new Date(toYear, toMonth - 1, toDay, 23, 59, 59, 999);
    
    const dbEntries = (await tests.findAll({order: [["created", "ASC"]]}))
        .filter((entry) => {
            const entryDate = new Date(entry.created);
            return entryDate >= from && entryDate <= to;
        });

    return dbEntries.map(entry => ({
        id: entry.id,
        ping: entry.ping,
        jitter: entry.jitter,
        download: entry.download,
        upload: entry.upload,
        time: entry.time,
        type: entry.type,
        created: entry.created,
        error: entry.error
    }));
}