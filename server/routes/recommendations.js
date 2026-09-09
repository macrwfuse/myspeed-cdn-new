import express from 'express';
import * as recommendations from '../controller/recommendations.js';
import password from '../middlewares/password.js';

const app = express.Router();

app.get("/", password(false), async (req, res) => {
    let currentRecommendations = await recommendations.getCurrent();
    if (currentRecommendations === null) return res.status(501).json({message: "There are no recommendations yet"});

    return res.json(currentRecommendations);
});

export default app;