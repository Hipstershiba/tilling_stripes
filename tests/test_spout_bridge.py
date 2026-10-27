"""Connection ownership regression without a GPU, receiver, or network server."""
import importlib.util
from pathlib import Path
import sys
import types
import unittest

sys.modules['SpoutGL'] = types.ModuleType('SpoutGL')
sys.modules['websockets'] = types.ModuleType('websockets')
spec = importlib.util.spec_from_file_location('bridge_test', Path(__file__).parents[1] / 'tools' / 'spout_bridge.py')
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)


class Pause:
    def __await__(self):
        yield self


class Socket:
    remote_address = 'test'

    def __init__(self):
        self.messages = []

    def __aiter__(self):
        return self

    async def __anext__(self):
        if not self.messages:
            await Pause()
        msg = self.messages.pop(0)
        if msg is None:
            raise StopAsyncIteration
        return msg

    async def send(self, _message):
        pass


class Output:
    active = False
    frames = 0

    def start(self, name, width, height):
        self.active = True
        self.name = name

    def stop(self):
        self.active = False

    def send(self, payload):
        self.frames += 1
        return True


class ConnectionOwnership(unittest.TestCase):
    def test_old_connection_cannot_stop_or_overwrite_new_sender(self):
        bridge.OUTPUT = Output()
        bridge.OUTPUT_OWNER = None
        old, new = Socket(), Socket()
        old.messages.append('{"type":"start","name":"Old","width":1,"height":1}')
        old_task = bridge.handler(old).__await__()
        next(old_task)  # Process the start message, then suspend waiting for input.
        new.messages.append('{"type":"start","name":"New","width":1,"height":1}')
        new_task = bridge.handler(new).__await__()
        next(new_task)
        old.messages.extend([b'old!', '{"type":"stop"}', None])
        with self.assertRaises(StopIteration):
            next(old_task)
        self.assertTrue(bridge.OUTPUT.active)
        self.assertIs(bridge.OUTPUT_OWNER, new)
        self.assertEqual(bridge.OUTPUT.frames, 0)
        new.messages.extend([b'new!', None])
        with self.assertRaises(StopIteration):
            next(new_task)
        self.assertEqual(bridge.OUTPUT.frames, 1)
        self.assertFalse(bridge.OUTPUT.active)
        self.assertIsNone(bridge.OUTPUT_OWNER)


if __name__ == '__main__':
    unittest.main()
