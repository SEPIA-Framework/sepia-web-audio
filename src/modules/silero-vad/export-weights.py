#!/usr/bin/env python3
"""Export the 16 kHz weights of the official Silero VAD ONNX model for silero-vad-interface.js.

Usage: python3 export-weights.py silero_vad.onnx [release-tag]
Needs: pip install onnx numpy

Writes silero-vad-16k-f32.bin and silero-vad-16k-f16.bin next to this script.
Source: https://github.com/snakers4/silero-vad - src/silero_vad/data/silero_vad.onnx

File layout (little endian):
  "SVAD", uint32 header length, UTF-8 JSON header (padded with spaces to a multiple of 4),
  then the tensors of header.tensors in that order, each as dtype values, row-major.

The STFT basis is not exported: the script checks that it is a periodic Hann window times
a 256-point DFT, which the interface computes with an FFT.
"""
import hashlib, json, os, struct, sys
import numpy as np
import onnx
from onnx import numpy_helper

#PyTorch names of the 16 kHz model; LSTM gate order is i, f, g, o
TENSORS = [
    ("encoder.0.reparam_conv.weight", [128, 129, 3]),
    ("encoder.0.reparam_conv.bias", [128]),
    ("encoder.1.reparam_conv.weight", [64, 128, 3]),
    ("encoder.1.reparam_conv.bias", [64]),
    ("encoder.2.reparam_conv.weight", [64, 64, 3]),
    ("encoder.2.reparam_conv.bias", [64]),
    ("encoder.3.reparam_conv.weight", [128, 64, 3]),
    ("encoder.3.reparam_conv.bias", [128]),
    ("decoder.rnn.weight_ih", [512, 128]),
    ("decoder.rnn.weight_hh", [512, 128]),
    ("decoder.rnn.bias_ih", [512]),
    ("decoder.rnn.bias_hh", [512]),
    ("decoder.decoder.2.weight", [1, 128, 1]),
    ("decoder.decoder.2.bias", [1]),
]
N_FFT = 256


def branch_constants(model):
    """Constants of the 'If' branch taken for sr == 16000, keyed by their PyTorch name."""
    for node in model.graph.node:
        if node.op_type != "If":
            continue
        branches = {a.name: a.g for a in node.attribute if a.type == onnx.AttributeProto.GRAPH}
        consts = {}
        for n in branches["then_branch"].node:
            if n.op_type == "Constant" and "__Inline_0__" in n.output[0]:
                value = next(a.t for a in n.attribute if a.name == "value")
                consts[n.output[0].split("__Inline_0__", 1)[1]] = numpy_helper.to_array(value)
        if "stft.forward_basis_buffer" in consts and consts["stft.forward_basis_buffer"].shape[2] == N_FFT:
            return consts
    raise SystemExit("16 kHz branch not found - model layout changed?")


def check_stft_basis(basis):
    j = np.arange(N_FFT)
    window = 0.5 - 0.5 * np.cos(2 * np.pi * j / N_FFT)
    f = np.arange(N_FFT // 2 + 1)[:, None]
    expected = np.concatenate([window * np.cos(2 * np.pi * f * j / N_FFT), -window * np.sin(2 * np.pi * f * j / N_FFT)])
    err = np.abs(basis[:, 0, :] - expected).max()
    if err > 1e-6:
        raise SystemExit("STFT basis is not a periodic Hann DFT (max error %g) - the interface would compute it wrong" % err)
    return err


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    path = sys.argv[1]
    release = sys.argv[2] if len(sys.argv) > 2 else None
    with open(path, "rb") as f:
        sha256 = hashlib.sha256(f.read()).hexdigest()
    consts = branch_constants(onnx.load(path))
    basis_err = check_stft_basis(consts["stft.forward_basis_buffer"])
    arrays = []
    for name, shape in TENSORS:
        a = consts[name].astype(np.float32)
        if list(a.shape) != shape:
            raise SystemExit("%s has shape %s, expected %s" % (name, list(a.shape), shape))
        arrays.append(a)
    out_dir = os.path.dirname(os.path.abspath(__file__))
    for dtype, np_type in (("float32", "<f4"), ("float16", "<f2")):
        header = {
            "format": 1,
            "model": "silero_vad.onnx",
            "release": release,
            "sha256": sha256,
            "sampleRate": 16000,
            "dtype": dtype,
            "tensors": [{"name": n, "shape": s} for n, s in TENSORS],
        }
        h = json.dumps(header, separators=(",", ":")).encode("utf-8")
        h += b" " * (-len(h) % 4)
        file = os.path.join(out_dir, "silero-vad-16k-%s.bin" % ("f32" if dtype == "float32" else "f16"))
        with open(file, "wb") as f:
            f.write(b"SVAD" + struct.pack("<I", len(h)) + h)
            for a in arrays:
                f.write(a.astype(np_type).tobytes())
        print("wrote", file, os.path.getsize(file), "bytes")
    print("source sha256", sha256, "- STFT basis check max error %.1e" % basis_err)


if __name__ == "__main__":
    main()
