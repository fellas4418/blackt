# -*- coding: utf-8 -*-
"""Minimal HWP 5.0 text extractor (olefile + zlib). Used by merge_ebs_hwp_headwords.py."""
from __future__ import annotations

import io
import struct
import zlib

try:
    import olefile
except ImportError:
    olefile = None

HWPTAG_PARA_TEXT = 67


def _decompress(data: bytes) -> bytes:
    for wbits in (-15, zlib.MAX_WBITS):
        try:
            return zlib.decompress(data, wbits)
        except zlib.error:
            pass
    return data


def _hwp_unicode_to_str(data: bytes) -> str:
    out: list[str] = []
    i = 0
    while i + 1 < len(data):
        ch = data[i] | (data[i + 1] << 8)
        i += 2
        if ch == 0 or ch < 32:
            continue
        out.append(chr(ch))
    return "".join(out)


def extract_paragraphs(path: str) -> list[str]:
    if olefile is None:
        raise ImportError("olefile is required: pip install olefile")

    ole = olefile.OleFileIO(path)
    texts: list[str] = []
    idx = 0
    while True:
        stream_name = f"BodyText/Section{idx}"
        if not ole.exists(stream_name):
            break
        raw = ole.openstream(stream_name).read()
        data = _decompress(raw)
        stream = io.BytesIO(data)
        while True:
            header_bytes = stream.read(4)
            if len(header_bytes) < 4:
                break
            header_val = struct.unpack("<I", header_bytes)[0]
            tag_id = header_val & 0x3FF
            size = (header_val >> 20) & 0xFFF
            if size == 0xFFF:
                size = struct.unpack("<I", stream.read(4))[0]
            content = stream.read(size)
            if tag_id == HWPTAG_PARA_TEXT:
                texts.append(_hwp_unicode_to_str(content))
        idx += 1
    ole.close()
    return texts
