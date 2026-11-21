
import asyncio
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from google.genai import types

from live_config import gemini, MODEL, CONFIG, answer_tool_call

router = APIRouter()


@router.websocket("/voice")
async def voice(ws: WebSocket):
    await ws.accept()

    print("[VOICE] Browser connected")

    try:
        async with gemini.aio.live.connect(
            model=MODEL,
            config=CONFIG
        ) as session:

            print(f"[VOICE] Gemini Live connected using model: {MODEL}")

            async def browser_to_gemini():
                packets = 0

                while True:
                    pcm = await ws.receive_bytes()

                    if not pcm:
                        continue

                    packets += 1

                    if packets == 1 or packets % 50 == 0:
                        print(
                            f"[VOICE] Received microphone packet "
                            f"{packets}: {len(pcm)} bytes"
                        )

                    await session.send_realtime_input(
                        audio=types.Blob(
                            data=pcm,
                            mime_type="audio/pcm;rate=16000"
                        )
                    )

            async def gemini_to_browser():
                async for response in session.receive():

                    # Handle Gemini function calls
                    if response.tool_call:
                        print("[VOICE] Gemini requested a tool")

                        await answer_tool_call(
                            session,
                            response.tool_call
                        )

                    content = response.server_content

                    if not content:
                        continue

                    # Handle interruption
                    if content.interrupted:
                        print("[VOICE] Gemini interrupted")

                        await ws.send_text(
                            json.dumps({"type": "interrupted"})
                        )

                    # Forward generated audio
                    if content.model_turn:
                        for part in content.model_turn.parts:

                            if part.inline_data:
                                audio_data = part.inline_data.data

                                if audio_data:
                                    await ws.send_bytes(audio_data)

                    # Forward speech transcription
                    if content.output_transcription:
                        text = content.output_transcription.text

                        if text:
                            print("[VOICE] Gemini caption:", text)

                            await ws.send_text(
                                json.dumps({
                                    "type": "caption",
                                    "text": text
                                })
                            )

                    # Turn complete
                    if content.turn_complete:
                        print("[VOICE] Gemini turn completed")

                        await ws.send_text(
                            json.dumps({"type": "done"})
                        )

            tasks = [
                asyncio.create_task(browser_to_gemini()),
                asyncio.create_task(gemini_to_browser())
            ]

            try:
                done, pending = await asyncio.wait(
                    tasks,
                    return_when=asyncio.FIRST_COMPLETED
                )

                for task in done:
                    if not task.cancelled():
                        error = task.exception()

                        if error:
                            raise error

            finally:
                for task in tasks:
                    if not task.done():
                        task.cancel()

                await asyncio.gather(
                    *tasks,
                    return_exceptions=True
                )

    except WebSocketDisconnect:
        print("[VOICE] Browser disconnected")

    except Exception as error:
        print("[VOICE] Connection error:", repr(error))

        try:
            await ws.send_text(
                json.dumps({
                    "type": "error",
                    "message": str(error)
                })
            )
        except Exception:
            pass

    finally:
        try:
            await ws.close()
        except Exception:
            pass

        print("[VOICE] Session closed")
