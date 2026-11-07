"""Read and rewrite the LAME/Lavc tag's encoder delay and padding in an MP3's Info/Xing frame (and its tag CRC).
The tag: 9-byte encoder string, then 12 bytes, then delay and padding as two 12-bit numbers (21 bytes in), and the tag's
own CRC-16 34 bytes in: CRC-16/ARC over the frame's first 190 bytes with the CRC field itself zeroed, as ffmpeg's
mp3enc writes it (in a mono frame the tag starts earlier, so the field falls inside those 190 bytes)."""
import struct


def crc16_arc(data, crc=0):
    for b in data:
        crc ^= b
        for _ in range(8):
            crc = (crc >> 1) ^ 0xA001 if crc & 1 else crc >> 1
    return crc


def tag_crc(buf, t):
    z = bytearray(buf[t["frame"]:t["frame"] + 190])
    at = t["ext"] + 34 - t["frame"]
    if at < 190:
        z[at:at + 2] = b"\0\0"
    return crc16_arc(z)


def find_tag(buf):
    i = 0
    if buf[:3] == b"ID3":
        size = (buf[6] << 21) | (buf[7] << 14) | (buf[8] << 7) | buf[9]
        i = 10 + size
    while i + 4 < len(buf) and not (buf[i] == 0xFF and buf[i + 1] & 0xE0 == 0xE0):
        i += 1
    frame = i
    for tag in (b"Info", b"Xing"):
        at = buf.find(tag, frame, frame + 64)
        if at >= 0:
            break
    else:
        return None
    flags = struct.unpack(">I", buf[at + 4:at + 8])[0]
    p = at + 8
    frames = None
    if flags & 1:
        frames = struct.unpack(">I", buf[p:p + 4])[0]
        p += 4
    if flags & 2:
        p += 4
    if flags & 4:
        p += 100
    if flags & 8:
        p += 4
    return {"frame": frame, "ext": p, "frames": frames}


def read(buf):
    t = find_tag(buf)
    if not t:
        return None
    e = t["ext"]
    b0, b1, b2 = buf[e + 21], buf[e + 22], buf[e + 23]
    crc_ok = tag_crc(buf, t) == struct.unpack(">H", buf[e + 34:e + 36])[0]
    return {"encoder": bytes(buf[e:e + 9]).decode("latin1"), "delay": (b0 << 4) | (b1 >> 4),
            "padding": ((b1 & 15) << 8) | b2, "frames": t["frames"], "crc_ok": crc_ok}


def write(buf, delay, padding):
    buf = bytearray(buf)
    t = find_tag(buf)
    e = t["ext"]
    assert 0 <= delay < 4096 and 0 <= padding < 4096
    buf[e + 21] = delay >> 4
    buf[e + 22] = ((delay & 15) << 4) | (padding >> 8)
    buf[e + 23] = padding & 255
    buf[e + 34:e + 36] = struct.pack(">H", tag_crc(buf, t))
    return bytes(buf)
