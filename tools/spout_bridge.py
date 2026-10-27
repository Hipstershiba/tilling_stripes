"""
Spout bridge — Tiling Stripes Studio
====================================

The browser cannot open a Spout sender: Spout shares a DX11/OpenGL texture through a native
DLL. This small local bridge receives frames over WebSocket (127.0.0.1:8766) and forwards them
to a Spout sender using SpoutGL.

Usage (Python 3.12, the only interpreter here with a SpoutGL wheel):

    py -3.12 tools/spout_bridge.py
    # or: C:\\Users\\<user>\\AppData\\Local\\Programs\\Python\\Python312\\python.exe tools/spout_bridge.py

Dependencies (already installed on this machine):
    py -3.12 -m pip install SpoutGL websockets

Protocol (JSON text + raw binary frames)
----------------------------------------
    -> {"type":"start","name":"Tiling Stripes","width":600,"height":600}
    -> <bytes: width*height*4, RGBA, top-down>
    -> {"type":"stop"}

The bridge answers {"type":"status","sender":"...","frames":N} on start and on errors.
"""

import asyncio
import ctypes
import json
import sys

GL_RGBA = 0x1908
HOST = "127.0.0.1"
PORT = 8766

try:
    import websockets
except ImportError:  # pragma: no cover - environment guard
    sys.exit("websockets ausente: py -3.12 -m pip install websockets")

try:
    import SpoutGL
except ImportError:  # pragma: no cover - environment guard
    sys.exit("SpoutGL ausente: py -3.12 -m pip install SpoutGL")


class SpoutOutput:
    """Thin wrapper around SpoutGL.SpoutSender with explicit lifecycle."""

    def __init__(self):
        self.sender = None
        self.width = 0
        self.height = 0
        self.frames = 0
        self.name = ""

    def start(self, name, width, height):
        self.stop()
        sender = SpoutGL.SpoutSender()
        if not sender.createOpenGL():
            raise RuntimeError("createOpenGL() falhou — sem contexto OpenGL disponível")
        sender.setSenderName(name)
        self.sender = sender
        self.name = name
        self.width = int(width)
        self.height = int(height)
        self.frames = 0
        return True

    def send(self, payload):
        if not self.sender:
            return False
        if len(payload) != self.width * self.height * 4:
            return False
        buffer = (ctypes.c_ubyte * len(payload)).from_buffer_copy(payload)
        # Format RGBA, invert vertically (WebGL/Canvas is top-down, Spout is bottom-up), FBO 0.
        ok = self.sender.sendImage(buffer, self.width, self.height, GL_RGBA, True, 0)
        if ok:
            self.frames += 1
        return bool(ok)

    def stop(self):
        if self.sender:
            try:
                self.sender.releaseSender()
                self.sender.closeOpenGL()
            except Exception:
                pass
        self.sender = None

    @property
    def active(self):
        return self.sender is not None


OUTPUT = SpoutOutput()
OUTPUT_OWNER = None


async def handler(ws):
    global OUTPUT_OWNER
    peer = ws.remote_address
    print(f"[spout] cliente conectado {peer}")
    try:
        async for message in ws:
            if isinstance(message, (bytes, bytearray)):
                if OUTPUT_OWNER is not ws:
                    continue
                if not OUTPUT.active:
                    await ws.send(json.dumps({"type": "error", "reason": "nenhum sender ativo"}))
                    continue
                ok = OUTPUT.send(bytes(message))
                if not ok and OUTPUT.frames == 0:
                    await ws.send(json.dumps({"type": "error", "reason": "frame rejeitado"}))
                continue

            try:
                data = json.loads(message)
            except json.JSONDecodeError:
                continue

            kind = data.get("type")
            if kind == "start":
                name = str(data.get("name") or "Tiling Stripes").strip() or "Tiling Stripes"
                width = int(data.get("width") or 0)
                height = int(data.get("height") or 0)
                if width <= 0 or height <= 0:
                    await ws.send(json.dumps({"type": "error", "reason": "dimensões inválidas"}))
                    continue
                try:
                    OUTPUT.start(name, width, height)
                    OUTPUT_OWNER = ws
                except Exception as exc:
                    await ws.send(json.dumps({"type": "error", "reason": str(exc)}))
                    continue
                await ws.send(json.dumps({"type": "status", "sender": name, "width": width, "height": height}))
                print(f"[spout] sender '{name}' {width}x{height}")
            elif kind == "stop":
                if OUTPUT_OWNER is not ws:
                    continue
                OUTPUT.stop()
                OUTPUT_OWNER = None
                await ws.send(json.dumps({"type": "status", "sender": None}))
                print("[spout] sender encerrado")
    except Exception as exc:  # connection reset, etc.
        print(f"[spout] conexão encerrada: {exc}")
    finally:
        if OUTPUT_OWNER is ws:
            OUTPUT.stop()
            OUTPUT_OWNER = None
        print(f"[spout] cliente desconectado {peer}")


def process_request(connection, request):
    """Answers plain HTTP requests so the browser can prove it can reach the bridge.

    Open http://127.0.0.1:8766/health in the same browser that runs the app:
    if it loads, the network path is fine and the problem is the WebSocket itself.
    Anything that is not a health check falls through to the WebSocket handshake.
    """
    if request.headers.get("Upgrade", "").lower() == "websocket":
        return None  # never intercept the WebSocket handshake

    if request.path in ("/health", "/healthz"):
        return connection.respond(200, "spout bridge ok\n")
    if request.path in ("/", "/index.html"):
        return connection.respond(
            200,
            "Spout bridge alive.\n"
            "WebSocket: ws://127.0.0.1:8766/\n"
            "Health:    http://127.0.0.1:8766/health\n"
            "Open the app from your local server (e.g. http://127.0.0.1:5500).\n",
        )
    return None


async def main():
    print(f"[spout] ponte ouvindo em ws://{HOST}:{PORT}")
    print(f"[spout] teste no navegador: http://{HOST}:{PORT}/health")
    print("[spout] abra o app, ligue 'Saida Spout' e escolha o nome do sender")
    try:
        async with websockets.serve(handler, HOST, PORT, max_size=None, process_request=process_request):
            await asyncio.Future()
    except OSError as exc:
        print(f"[spout] ERRO: a porta {PORT} ja esta em uso ({exc}).")
        print("[spout] Feche a outra janela da ponte e tente de novo.")
        raise


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[spout] encerrado")
