const express = require("express");
const ftp = require("basic-ftp");
const cors = require("cors");
const fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const path = require("path");

const app = express();
app.use(cors());

ffmpeg.setFfmpegPath(ffmpegPath);

const FTP_HOST = "94.206.164.251";
const FTP_USER = "1";
const FTP_PASS = "1";
const FTP_DIR = "video1";

if (!fs.existsSync("cache")) fs.mkdirSync("cache");

async function getFTP() {
    const client = new ftp.Client();
    await client.access({
        host: FTP_HOST,
        user: FTP_USER,
        password: FTP_PASS,
        secure: false,
        passive: true
    });
    return client;
}

app.get("/api/videos", async (req, res) => {
    try {
        const client = await getFTP();
        const list = await client.list(FTP_DIR);
        const videos = list.filter(f => !f.isDirectory);
        const result = videos.map(v => ({
            name: v.name,
            stream: `/api/video/${encodeURIComponent(v.name)}`,
            thumb: `/api/thumb/${encodeURIComponent(v.name)}`,
            preview: `/api/preview/${encodeURIComponent(v.name)}`
        }));
        res.json(result);
        client.close();
    } catch (err) {
        res.status(500).send(err.toString());
    }
});

app.get("/api/video/:name", async (req, res) => {
    try {
        const name = req.params.name;
        const client = await getFTP();
        res.setHeader("Content-Type", "video/mp4");
        await client.downloadTo(res, `${FTP_DIR}/${name}`);
        client.close();
    } catch (err) {
        res.status(500).send(err.toString());
    }
});

app.get("/api/thumb/:name", async (req, res) => {
    const name = req.params.name;
    const local = `cache/${name}`;
    const thumb = `cache/${name}.jpg`;

    if (fs.existsSync(thumb)) return res.sendFile(thumb, { root: "." });

    try {
        const client = await getFTP();
        await client.downloadTo(local, `${FTP_DIR}/${name}`);
        client.close();

        ffmpeg(local)
            .screenshots({
                timestamps: ["5%"],
                folder: "cache",
                filename: name + ".jpg",
                size: "300x200"
            })
            .on("end", () => res.sendFile(thumb, { root: "." }))
            .on("error", err => res.status(500).send(err.toString()));
    } catch (err) {
        res.status(500).send(err.toString());
    }
});

app.get("/api/preview/:name", async (req, res) => {
    const name = req.params.name;
    const local = `cache/${name}`;
    const preview = `cache/${name}-preview.mp4`;

    if (fs.existsSync(preview)) return res.sendFile(preview, { root: "." });

    try {
        const client = await getFTP();
        await client.downloadTo(local, `${FTP_DIR}/${name}`);
        client.close();

        ffmpeg(local)
            .setStartTime("00:00:02")
            .setDuration(3)
            .output(preview)
            .on("end", () => res.sendFile(preview, { root: "." }))
            .on("error", err => res.status(500).send(err.toString()))
            .run();

    } catch (err) {
        res.status(500).send(err.toString());
    }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Backend running on port", port));
