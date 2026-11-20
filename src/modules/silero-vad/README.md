# Silero VAD in plain JavaScript

The [Silero VAD](https://github.com/snakers4/silero-vad) v6 model, 16 kHz branch, computed in
plain JavaScript. It needs no WebAssembly, no SIMD and no ONNX runtime. The weights come from
the official ONNX model and are stored as float32 or float16. `silero-vad-worker.js` uses this
folder.

## Files

| File | What it is |
|---|---|
| `silero-vad-interface.js` | The forward pass, loaded by the worker with `importScripts` |
| `silero-vad-16k-f16.bin` | Weights as float16, 488 KB, the worker's default |
| `silero-vad-16k-f32.bin` | Weights as float32, 975 KB, exact |
| `export-weights.py` | Writes both `.bin` files from `silero_vad.onnx` |
| `SILERO_LICENSE` | MIT license of the Silero VAD model |

## How it works

The ONNX model holds two branches, one for 8 kHz and one for 16 kHz. The export takes the
16 kHz branch. For each frame of 512 samples (32 ms), the interface does this:

1. It puts the last 64 samples of the previous frame in front and mirrors 64 samples at the
   end, which gives 640 samples.
2. It takes the STFT magnitude with a periodic Hann window, 256 points and a hop of 128. That
   gives 4 steps of 129 bins. The model does this as a convolution with a fixed basis. The
   interface uses an FFT instead, so the basis is not stored. `export-weights.py` checks that
   the basis really is Hann × DFT.
3. It runs 4 Conv1d layers with kernel 3, each followed by ReLU: 129→128, 128→64 (stride 2),
   64→64 (stride 2), 64→128.
4. It runs one LSTM step with 128 units. The h and c state carries over to the next frame.
5. It applies ReLU, a linear layer to one value, and a sigmoid. The result is the speech
   probability.

`Vad.reset()` clears the LSTM state and the context. Float16 weights are expanded to float32
once, when the file is loaded. Input samples must be in the range -1..1. The worker converts
Int16 input to that range.

## Reproduce the weights

```bash
curl -L -o silero_vad.onnx https://github.com/snakers4/silero-vad/raw/v6.2.3/src/silero_vad/data/silero_vad.onnx
sha256sum silero_vad.onnx
# 1a153a22f4509e292a94e67d6f9b85e8deb25b4988682b7e174c65279d8788e3

python3 -m venv venv && venv/bin/pip install onnx numpy
venv/bin/python export-weights.py silero_vad.onnx v6.2.3
sha256sum silero-vad-16k-*.bin
# 42144acd991dbdd70e9665ddef9f598bd7cdd4cb14daa88acde6e1ababdeb573  silero-vad-16k-f16.bin
# 45c06e878578f07c1c324715bb60efc981b187da65d9db5c8c19220cd7fd4be1  silero-vad-16k-f32.bin
```

The script writes the files next to itself. The output is the same byte for byte on every run.
The release tag and the sha256 of the ONNX source are stored in each file's header. The worker
reports them as `moduleInfo.modelRelease` and `moduleInfo.modelDtype`. The docstring of
`export-weights.py` describes the file layout.

For a newer Silero release, run the script on its `silero_vad.onnx`. The script stops if a
tensor shape or the STFT basis no longer matches what the interface computes.

## Verification

The interface was compared with onnxruntime 1.32, running the same ONNX file frame by frame in
the official way: 64 samples of context and the state passed on. The test input was a 60 s
recording at 16 kHz (1875 frames), run in Node.js 24.

| Weights | Max. difference | Changed decisions at 0.5 | Time per frame |
|---|---|---|---|
| f32 | 1.8e-6 | 0 | about 0.4 ms |
| f16 | 2.3e-3 | 0 | about 0.4 ms |

*Max. difference* is the largest difference in speech probability over all frames.
*Changed decisions* counts frames where the interface and onnxruntime would decide differently
at a threshold of 0.5. A frame is 32 ms of audio.

A reference script does the same comparison:

```python
import numpy as np, onnxruntime as ort
sess = ort.InferenceSession("silero_vad.onnx")
state, ctx, sr = np.zeros((2, 1, 128), np.float32), np.zeros((1, 64), np.float32), np.array(16000, np.int64)
for frame in frames:  # float32 arrays of 512 samples, -1..1
    x = np.concatenate([ctx, frame[None]], axis=1)
    prob, state = sess.run(None, {"input": x, "state": state, "sr": sr})
    ctx = x[:, -64:]
```

## Usage in the worker

```js
setup: {
	model: "silero-vad-16k-f16",	//default; "silero-vad-16k-f32" for the exact weights
	vadThreshold: 0.5
}
```

The worker fetches `./silero-vad/<model>.bin`, relative to itself. You can also give the file
as the preLoad `modelFile`.
