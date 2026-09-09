import recommendations from '../models/Recommendations.js';
import { triggerEvent } from './integrations.js';

export const getCurrent = async () => {
    return await recommendations.findOne();
}

export const update = async (ping, download, upload) => {
    const configuration = {ping: Math.round(ping), download: parseFloat(download.toFixed(2)),
        upload: parseFloat(upload.toFixed(2))};
    
    const existing = await recommendations.findOne();
    
    triggerEvent("recommendationsUpdated", configuration).then(() => {});

    if (existing) {
        await recommendations.update(configuration, {where: {id: existing.id}});
        return recommendations.findOne({where: {id: existing.id}});
    }
    
    return recommendations.create(configuration);
}