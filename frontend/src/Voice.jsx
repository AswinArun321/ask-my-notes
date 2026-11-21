
import { useRef, useState } from "react";

const VOICE_URL = "ws://localhost:8000/voice";

function toPCM16(samples) {
    const pcm = new Int16Array(samples.length);

    for (let i = 0; i < samples.length; i++) {
        const sample = Math.max(-1, Math.min(1, samples[i]));
        pcm[i] = sample < 0
            ? sample * 0x8000
            : sample * 0x7fff;
    }

    return pcm.buffer;
}

export default function Voice() {
    const [on, setOn] = useState(false);
    const [caption, setCaption] = useState("");
    const [status, setStatus] = useState("Ready to talk");

    const live = useRef({});
    const captionRef = useRef("");

    function stopPlayback() {
        live.current.playing?.forEach(source => {
            try {
                source.stop();
            } catch {
                // Already stopped.
            }
        });

        live.current.playing = [];
        live.current.playAt = 0;
    }

    function startSpeaker(ws) {
        const ctx = new AudioContext({ sampleRate: 24000 });

        live.current.speakerCtx = ctx;
        live.current.playAt = 0;
        live.current.playing = [];

        ws.onmessage = async (event) => {
            if (typeof event.data === "string") {
                let msg;

                try {
                    msg = JSON.parse(event.data);
                } catch {
                    console.warn("Invalid server message:", event.data);
                    return;
                }

                console.log("Voice server message:", msg);

                if (msg.type === "caption") {
                    captionRef.current +=
                        (captionRef.current ? " " : "") + msg.text;

                    setCaption(captionRef.current);
                }

                if (msg.type === "done") {
                    setStatus("Listening... Say hello!");
                }

                if (msg.type === "interrupted") {
                    stopPlayback();
                    captionRef.current = "";
                    setCaption("");
                }

                if (msg.type === "error") {
                    setStatus("Voice error: " + msg.message);
                }

                return;
            }

            if (!live.current.speakerCtx) return;

            try {
                const buffer = event.data instanceof Blob
                    ? await event.data.arrayBuffer()
                    : event.data;

                const pcm = new Int16Array(buffer);

                if (!pcm.length) return;

                console.log("Received audio samples:", pcm.length);

                const speakerCtx = live.current.speakerCtx;

                if (speakerCtx.state === "suspended") {
                    await speakerCtx.resume();
                }

                const audioBuffer = speakerCtx.createBuffer(
                    1,
                    pcm.length,
                    24000
                );

                const channel = audioBuffer.getChannelData(0);

                for (let i = 0; i < pcm.length; i++) {
                    channel[i] = pcm[i] / 32768;
                }

                const source = speakerCtx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(speakerCtx.destination);

                const startAt = Math.max(
                    live.current.playAt,
                    speakerCtx.currentTime
                );

                source.start(startAt);

                live.current.playAt = startAt + audioBuffer.duration;
                live.current.playing.push(source);

                source.onended = () => {
                    live.current.playing =
                        live.current.playing.filter(item => item !== source);
                };

            } catch (error) {
                console.error("Audio playback error:", error);
                setStatus("Audio playback failed: " + error.message);
            }
        };

        return ctx;
    }

    async function startMic(ws) {
        if (!navigator.mediaDevices?.getUserMedia) {
            throw new Error(
                "Microphone access is unavailable. Use localhost or HTTPS."
            );
        }

        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                channelCount: 1,
                sampleRate: 16000,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });

        const micCtx = new AudioContext({ sampleRate: 16000 });

        live.current.stream = stream;
        live.current.micCtx = micCtx;

        await micCtx.audioWorklet.addModule("/mic-processor.js");
        await micCtx.resume();

        console.log("Microphone AudioContext sample rate:", micCtx.sampleRate);

        if (micCtx.sampleRate !== 16000) {
            throw new Error(
                `Expected 16000 Hz microphone audio, but browser is using ${micCtx.sampleRate} Hz.`
            );
        }

        const micSource = micCtx.createMediaStreamSource(stream);

        const worklet = new AudioWorkletNode(
            micCtx,
            "mic-processor",
            {
                numberOfInputs: 1,
                numberOfOutputs: 1,
                outputChannelCount: [1]
            }
        );

        // Connect through a silent gain node to activate the worklet
        // without playing microphone input through the speakers.
        const silentGain = micCtx.createGain();
        silentGain.gain.value = 0;

        micSource.connect(worklet);
        worklet.connect(silentGain);
        silentGain.connect(micCtx.destination);

        live.current.micSource = micSource;
        live.current.worklet = worklet;
        live.current.silentGain = silentGain;

        let saved = [];

        worklet.port.onmessage = (event) => {
            if (ws.readyState !== WebSocket.OPEN) return;

            const samples = event.data;

            for (let i = 0; i < samples.length; i++) {
                saved.push(samples[i]);
            }

            // Send approximately 100 ms of audio.
            while (saved.length >= 1600) {
                const chunk = new Float32Array(saved.slice(0, 1600));
                saved = saved.slice(1600);

                ws.send(toPCM16(chunk));

                console.log("Sent microphone audio:", chunk.length, "samples");
            }
        };
    }

    async function start() {
        if (live.current.ws?.readyState === WebSocket.OPEN) {
            stop();
            return;
        }

        try {
            setCaption("");
            captionRef.current = "";
            setStatus("Connecting...");

            const ws = new WebSocket(VOICE_URL);
            ws.binaryType = "arraybuffer";

            live.current.ws = ws;

            ws.onclose = (event) => {
                console.log("Voice WebSocket closed:", event.code, event.reason);
                stop();
            };

            ws.onerror = (event) => {
                console.error("Voice WebSocket error:", event);
            };

            await new Promise((resolve, reject) => {
                ws.onopen = () => {
                    console.log("Voice WebSocket connected");
                    resolve();
                };

                ws.onerror = () => {
                    reject(new Error("Could not connect to voice server."));
                };

                ws.onclose = () => {
                    reject(new Error("Voice WebSocket closed during connection."));
                };
            });

            const speakerCtx = startSpeaker(ws);
            await speakerCtx.resume();

            await startMic(ws);

            if (ws.readyState !== WebSocket.OPEN) {
                throw new Error("Voice connection closed unexpectedly.");
            }

            setOn(true);
            setStatus("Listening... Say hello!");

        } catch (error) {
            console.error("Voice startup error:", error);
            setStatus(error.message || "Could not start voice.");
            stop();
        }
    }

    function stop() {
        const resources = live.current;
        live.current = {};

        try {
            resources.ws?.close();
        } catch {}

        try {
            resources.worklet?.disconnect();
            resources.micSource?.disconnect();
            resources.silentGain?.disconnect();
        } catch {}

        resources.stream?.getTracks().forEach(track => track.stop());

        if (resources.micCtx && resources.micCtx.state !== "closed") {
            resources.micCtx.close();
        }

        if (resources.speakerCtx && resources.speakerCtx.state !== "closed") {
            resources.speakerCtx.close();
        }

        resources.playing?.forEach(source => {
            try {
                source.stop();
            } catch {}
        });

        setOn(false);
        setStatus("Ready to talk");
    }

    return (
        <div className="voice">
            <button
                type="button"
                className={on ? "talk on" : "talk"}
                onClick={on ? stop : start}
            >
                {on ? "■ Stop" : "🎙 Talk to Study Buddy"}
            </button>

            <p className="voice-status">{status}</p>

            {caption && (
                <p className="caption">{caption}</p>
            )}
        </div>
    );
}
