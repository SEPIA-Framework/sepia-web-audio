"use strict";
let speexModule;
let globalModulePromise = Speex().then((s) => speexModule = s);
class SpeexResampler {
    /**
      * Create an SpeexResampler tranform stream.
      * @param channels Number of channels, minimum is 1, no maximum
      * @param inRate frequency in Hz for the input chunk
      * @param outRate frequency in Hz for the target chunk
      * @param quality number from 1 to 10, default to 7, 1 is fast but of bad quality, 10 is slow but best quality
      */
    constructor(channels, inRate, outRate, quality = 7) {
        this.channels = channels;
        this.inRate = inRate;
        this.outRate = outRate;
        this.quality = quality;
        this._inBufferPtr = -1;
        this._inBufferSize = -1;
        this._outBufferPtr = -1;
        this._outBufferSize = -1;
        this._inLengthPtr = -1;
        this._outLengthPtr = -1;
    }
    /**
      * Resample a chunk of audio.
      * @param chunk interleaved PCM data in signed 16bits int
      */
    processChunk(chunk) {
        if (!speexModule) {
            throw new Error('You need to wait for SpeexResampler.initPromise before calling this method');
        }
        // We check that we have as many chunks for each channel and that the last chunk is full (2 bytes)
        if (chunk.length % (this.channels * Uint16Array.BYTES_PER_ELEMENT) !== 0) {
            throw new Error('Chunk length should be a multiple of channels * 2 bytes');
        }
        if (!this._resamplerPtr) {
            const errPtr = speexModule._malloc(4);
            this._resamplerPtr = speexModule._speex_resampler_init(this.channels, this.inRate, this.outRate, this.quality, errPtr);
            const errNum = speexModule.getValue(errPtr, 'i32');
            if (errNum !== 0) {
                throw new Error(speexModule.AsciiToString(speexModule._speex_resampler_strerror(errNum)));
            }
            this._inLengthPtr = speexModule._malloc(Uint32Array.BYTES_PER_ELEMENT);
            this._outLengthPtr = speexModule._malloc(Uint32Array.BYTES_PER_ELEMENT);
        }
        // Resizing the input buffer in the WASM memory space to match what we need
        if (this._inBufferSize < chunk.length) {
            if (this._inBufferPtr !== -1) {
                speexModule._free(this._inBufferPtr);
            }
            this._inBufferPtr = speexModule._malloc(chunk.length);
            this._inBufferSize = chunk.length;
        }
        // Resizing the output buffer in the WASM memory space to match what we need
        const outBufferLengthTarget = Math.ceil(chunk.length * this.outRate / this.inRate);
        if (this._outBufferSize < outBufferLengthTarget) {
            if (this._outBufferPtr !== -1) {
                speexModule._free(this._outBufferPtr);
            }
            this._outBufferPtr = speexModule._malloc(outBufferLengthTarget);
            this._outBufferSize = outBufferLengthTarget;
        }
        // number of samples per channel in input buffer
        speexModule.setValue(this._inLengthPtr, chunk.length / this.channels / Uint16Array.BYTES_PER_ELEMENT, 'i32');
        // Copying the info from the input Buffer in the WASM memory space
        speexModule.HEAPU8.set(chunk, this._inBufferPtr);
        // number of samples per channels available in output buffer
        speexModule.setValue(this._outLengthPtr, this._outBufferSize / this.channels / Uint16Array.BYTES_PER_ELEMENT, 'i32');
        const errNum = speexModule._speex_resampler_process_interleaved_int(this._resamplerPtr, this._inBufferPtr, this._inLengthPtr, this._outBufferPtr, this._outLengthPtr);
        if (errNum !== 0) {
            throw new Error(speexModule.AsciiToString(speexModule._speex_resampler_strerror(errNum)));
        }
        const outSamplesPerChannelsWritten = speexModule.getValue(this._outLengthPtr, 'i32');
        // we are copying the info in a new buffer here, we could just pass a buffer pointing to the same memory space if needed
        return new Uint8Array(speexModule.HEAPU8.slice(this._outBufferPtr, this._outBufferPtr + outSamplesPerChannelsWritten * this.channels * Uint16Array.BYTES_PER_ELEMENT).buffer);
    }
}
SpeexResampler.initPromise = globalModulePromise;
