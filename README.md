# SEPIA Web-Audio Library

## -- Currently in BETA --

Modular, cross-browser library to record and process audio using audio-worklets, web-workers and script-processors (as fallback).
Can be used to chain different modules (worklets AND workers) to one audio pipeline.   
  
Available modules:

- Resampler using Speex codec (WASM module)
- Voice-Activity-Detection (VAD) via WebRTC-VAD
- Custom SEPIA VAD module using Meyda to analyze bark-scale, MFCC and more
- Wave Encoder with lookback-buffer
- Porcupine Wake-Word detector
- more to come ...

# Resources (see LICENSE as well)

* [AudioWorklet Polyfill](https://github.com/GoogleChromeLabs/audioworklet-polyfill)
* [GoogleChromeLabs AudioWorklet Design Patterns](https://github.com/GoogleChromeLabs/web-audio-samples/blob/gh-pages/audio-worklet/design-pattern/)
* [Mozilla WebRTC VAD](https://github.com/mozilla/webrtcvad_js)
* [Chromium VAD](https://chromium.googlesource.com/external/webrtc/+/refs/heads/lkgr/common_audio/vad/)
* [Meyda](https://github.com/meyda/meyda)
* [Node Speex Resampler](https://github.com/geekuillaume/node-speex-resampler)
* [pcm-convert](https://github.com/audiojs/pcm-convert)
* [uPlot Lazy Interface](https://github.com/bytemind-de/uPlot-lazy-interface)
* [Freesound.org](https://freesound.org/)