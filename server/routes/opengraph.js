import express from 'express';
import passwordWrapper from '../middlewares/passwordWrapper.js';
import generateOpenGraphImage from '../controller/opengraph.js';

const app = express.Router();

app.get("/image", passwordWrapper(true, (req, res) => {
  // If there is a password set and the user does not want others to view their test data, return the project banner
  res.redirect('https://repository-images.githubusercontent.com/478222232/b5331514-aa27-4a56-af3e-c4b25446438d');
}), async (req, res) => {

  try {
    const png = await generateOpenGraphImage(req);

    if (!png) {
      return res.status(500).json({ message: "Error fetching test data" });
    }

    res.setHeader("Content-Type", "image/svg+xml").status(200).send(png);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default app;
