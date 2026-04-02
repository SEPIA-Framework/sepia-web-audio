// DIFFERENCE from original ring-buffer: no support for multiple types via
// constructor parameter ('Uint16', 'Int16', 'Uint8', 'Int8', Float32 as default).
// Float32 only here -- sufficient for audio output.
class ZeroPaddingRingBuffer {
  constructor(length, channelCount) {
    this._readIndex       = 0;
    this._writeIndex      = 0;
    this._framesAvailable = 0;
    this._channelCount    = channelCount;
    this._length          = length;
    this._channelData     = [];
    for (let i = 0; i < channelCount; i++) {
      this._channelData[i] = new Float32Array(length);
    }
  }
  get framesAvailable() { return this._framesAvailable; }
  get length()          { return this._length; }

  push(data) {
    const frames = data[0].length;
    for (let f = 0; f < frames; f++) {
      const idx = (this._writeIndex + f) % this._length;
      for (let c = 0; c < this._channelCount; c++) {
        this._channelData[c][idx] = data[c][f];
      }
    }
    this._writeIndex = (this._writeIndex + frames) % this._length;
    this._framesAvailable = Math.min(this._framesAvailable + frames, this._length);
  }

  pull(output, frames) {
    // DIFFERENCE 1: remaining output is filled with silence on underrun.
    // This prevents stale samples from lingering in the WebAudio output.
    //
    // DIFFERENCE 2: original returns nothing.
    // Here the number of actually read frames is returned so the caller
    // can detect and count underruns.
    const available = Math.min(frames, this._framesAvailable);
    for (let f = 0; f < available; f++) {
      const idx = (this._readIndex + f) % this._length;
      for (let c = 0; c < this._channelCount; c++) {
        output[c][f] = this._channelData[c][idx];
      }
    }
    // Fill missing frames with silence (underrun)
	for (let c = 0; c < this._channelCount; c++) {
		output[c].fill(0, available, frames); 
	}
    this._readIndex = (this._readIndex + available) % this._length;
    this._framesAvailable -= available;
    return available; // actually read frames
  }
}