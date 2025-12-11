const express = require("express");
const cors = require("cors");
const ftp = require("basic-ftp");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");

const app = express();
app.use(cors());

// ----------- FTP SETTINGS --------------
const FTP_HOST = "94.206.164.251";
const FTP_USER = "1";
const FTP_PASS = "1";
const FTP_FOLDER = "/video1/";
// ---------------------------------------

// Create FTP client
async function getFtpClient() {
    const client = new ftp.Client();
    client.ftp.verbose = false;

    await client.access({
        host: FTP_HOST,
        user: FTP_USER,
        password: FTP_PASS,
        secure: false,
        passive: true
    });

    return client;
}

// ✨ API: GET ALL VIDEO FILES
app.get("/api/videos", async (req, res) => {
    try {
        const client = await getFtpClient();
        const list = await client.list(FTP_FOLDER);
        client.close();

        const videoFiles = list
            .filter(f => f.isFile)
            .filter(f =>
                f.name.endsWith(".mp4") ||
                f.name.endsWith(".mkv") ||
                f.name.endsWith(".flv") ||
                f.name.endsWith(".avi") ||
                f.name.endsWith(".mov")
            )
            .map(f => ({
                name: f.name,
                url: `/api/stream/${f.name}`
            }));

        res.json(videoFiles);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "FTP error: " + err.message });
    }
});

// ✨ API: STREAM VIDEO
app.get("/api/stream/:filename", async (req, res) => {
    const filename = req.params.filename;

    try {
        const client = await getFtpClient();
        const stream = await client.downloadToStream(null, FTP_FOLDER + filename);

        res.setHeader("Content-Type", "video/mp4");

        stream.on("error", () => {
            res.status(500).send("Stream error");
        });

        stream.pipe(res);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Streaming error: " + err.message });
    }
});

// Default route
app.get("/", (req, res) => {
    res.send("FTP Video API is running");
});

// Render will assign PORT dynamically
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Backend running on port", PORT));
