
# voice_agent.py
# Real-time voice assistant for Ask My Notes

import asyncio
import pyaudio

from google.genai import types

from live_config import (
    gemini,
    MODEL,
    CONFIG,
    answer_tool_call,
)


# Audio configuration
FORMAT = pyaudio.paInt16
CHANNELS = 1

MIC_RATE = 16000
SPEAKER_RATE = 24000

CHUNK = 1024

# PyAudio instance
pya = pyaudio.PyAudio()

# Queue for Gemini's audio responses
speaker_queue = asyncio.Queue()


async def listen(session):
    """
    Capture microphone audio and send it to Gemini.
    """

    print("🎤 Microphone is active. Start speaking!")

    mic = await asyncio.to_thread(
        pya.open,
        format=FORMAT,
        channels=CHANNELS,
        rate=MIC_RATE,
        input=True,
        frames_per_buffer=CHUNK,
    )

    try:
        while True:
            # Read microphone audio without blocking asyncio
            data = await asyncio.to_thread(
                mic.read,
                CHUNK,
                exception_on_overflow=False,
            )

            # Send audio to Gemini Live
            await session.send_realtime_input(
                audio=types.Blob(
                    data=data,
                    mime_type=f"audio/pcm;rate={MIC_RATE}",
                )
            )

    finally:
        await asyncio.to_thread(mic.stop_stream)
        await asyncio.to_thread(mic.close)


async def receive(session):
    """
    Receive Gemini responses, handle tool calls,
    and queue generated audio for playback.
    """

    print("🤖 Listening for Gemini responses...")

    while True:
        async for response in session.receive():

            # Handle Gemini tool calls
            if response.tool_call:
                await answer_tool_call(
                    session,
                    response.tool_call,
                )

            content = response.server_content

            if not content:
                continue

            # Stop queued playback if the user interrupts Gemini
            if content.interrupted:
                while not speaker_queue.empty():
                    try:
                        speaker_queue.get_nowait()
                    except asyncio.QueueEmpty:
                        break

                print("\n⏸️ Response interrupted.")

            # Receive generated audio
            if content.model_turn:
                for part in content.model_turn.parts:
                    if part.inline_data:
                        audio_data = part.inline_data.data

                        if audio_data:
                            await speaker_queue.put(audio_data)

            # Print what the user said
            if content.input_transcription:
                text = content.input_transcription.text

                if text:
                    print(f"\nYou: {text}", flush=True)

            # Print Gemini's spoken response as captions
            if content.output_transcription:
                text = content.output_transcription.text

                if text:
                    print(f"\nStudy Buddy: {text}", end="", flush=True)

            if content.turn_complete:
                print("\n")


async def speak():
    """
    Play Gemini's audio through the speakers.
    """

    speaker = await asyncio.to_thread(
        pya.open,
        format=FORMAT,
        channels=CHANNELS,
        rate=SPEAKER_RATE,
        output=True,
    )

    try:
        while True:
            data = await speaker_queue.get()

            await asyncio.to_thread(
                speaker.write,
                data,
            )

    finally:
        await asyncio.to_thread(speaker.stop_stream)
        await asyncio.to_thread(speaker.close)


async def main():
    """
    Connect to Gemini Live and run microphone,
    response and speaker tasks concurrently.
    """

    print("\n===================================")
    print("   ASK MY NOTES - LIVE VOICE")
    print("===================================")

    try:
        async with gemini.aio.live.connect(
            model=MODEL,
            config=CONFIG,
        ) as session:

            print("\n✅ Connected to Gemini Live!")
            print("Start talking to your notes.")
            print("Press Ctrl + C to stop.\n")

            async with asyncio.TaskGroup() as group:
                group.create_task(listen(session))
                group.create_task(receive(session))
                group.create_task(speak())

    except KeyboardInterrupt:
        print("\n👋 Voice assistant stopped.")

    finally:
        pya.terminate()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nBye!")
