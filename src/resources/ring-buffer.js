/**
 * Original copyright 2018 Google LLC - Licensed under the Apache License, Version 2.0;
 * Modified for SEPIA project (MIT License)
 */
 
/**
 * A JS FIFO implementation for the AudioWorklet.
 * Note:
 *  - The channel count of input/output cannot be changed dynamically.
 *    The AudioWorkletNode should be configured with the `.channelCount = k`
 *    (where k is the channel count you want) and `.channelCountMode = explicit`.
 *
 * @class
 */
class RingBuffer {
  /**
   * @constructor
   * @param  {number} length Buffer length in frames.
   * @param  {number} channelCount Buffer channel count.
   * @param  {number} precision "Uint8", "Int8", "Uint16", "Int16", "Float32" etc.
   */
  constructor(length, channelCount, precision) {
    this._readIndex = 0;
    this._writeIndex = 0;
    this._framesAvailable = 0;

    this._channelCount = channelCount;
    this._length = length;
    this._channelData = [];
    for (let i = 0; i < this._channelCount; ++i) {
	  if (precision == "Uint16"){ this._channelData[i] = new Uint16Array(length); }
	  else if (precision == "Int16"){ this._channelData[i] = new Int16Array(length); }
	  else if (precision == "Uint8"){ this._channelData[i] = new Uint8Array(length); }
	  else if (precision == "Int8"){ this._channelData[i] = new Int8Array(length); }
	  else{ this._channelData[i] = new Float32Array(length); }
    }
  }

  /**
   * Getter for Available frames in buffer.
   *
   * @return {number} Available frames in buffer.
   */
  get framesAvailable() {
    return this._framesAvailable;
  }

  /**
   * Push a sequence of Arrays to buffer.
   * On overrun the oldest frames are overwritten and the next pull starts at the
   * oldest frame left. Of a sequence longer than the buffer only the last frames are kept.
   *
   * @param  {array} arraySequence A sequence of Arrays.
   * @param  {function} customTransform A function of (array, channel, index) to transform the input during push (or null).
   */
  push(arraySequence, customTransform) {
    // The channel count of arraySequence and the length of each channel must
    // match with this buffer obejct.
    let sourceLength = arraySequence[0].length;
    if (!sourceLength) return;
    let skip = Math.max(0, sourceLength - this._length);
    let frames = sourceLength - skip;
    let start = (this._writeIndex + skip) % this._length;
    //split parts for faster assign
    let part1 = Math.min(frames, this._length - start);
    let part2 = frames - part1;
    for (let channel = 0; channel < this._channelCount; ++channel) {
      let source = arraySequence[channel];
      let target = this._channelData[channel];
      if (!customTransform && ArrayBuffer.isView(source)) {
        target.set(source.subarray(skip, skip + part1), start);
        if (part2 > 0) target.set(source.subarray(skip + part1, skip + frames), 0);
      } else {
        let transform = customTransform || function(thisArray, channel, i){
          return thisArray[channel][i];
        }
        for (let i = 0; i < frames; ++i) {
          target[(start + i) % this._length] = transform(arraySequence, channel, skip + i);
        }
      }
    }
    this._writeIndex = (start + frames) % this._length;

    if (this._framesAvailable + sourceLength >= this._length) {
      this._framesAvailable = this._length;
      this._readIndex = this._writeIndex;
    } else {
      this._framesAvailable += sourceLength;
    }
  }

  /**
   * Pull data out of buffer and fill a given sequence of Arrays.
   * If the buffer holds fewer frames than requested, the rest is filled with silence (zeros).
   *
   * @param  {array} arraySequence An array of Arrays.
   * @param  {function} customTransform A function of (array, channel, index) to transform the output during pull (or null).
   * @return {number} Frames actually read.
   */
  pull(arraySequence, customTransform) {
    // The channel count of arraySequence and the length of each channel must
    // match with this buffer obejct.
    let destinationLength = arraySequence[0].length;
    let available = Math.min(destinationLength, this._framesAvailable);
    //split parts for faster assign
    let part1 = Math.min(available, this._length - this._readIndex);
    let part2 = available - part1;
    for (let channel = 0; channel < this._channelCount; ++channel) {
      let source = this._channelData[channel];
      let target = arraySequence[channel];
      if (!customTransform && ArrayBuffer.isView(target)) {
        target.set(source.subarray(this._readIndex, this._readIndex + part1), 0);
        if (part2 > 0) target.set(source.subarray(0, part2), part1);
        target.fill(0, available, destinationLength);
      } else {
        let transform = customTransform || function(thisArray, channel, i){
          return thisArray[channel][i];
        }
        for (let i = 0; i < available; ++i) {
          target[i] = transform(this._channelData, channel, (this._readIndex + i) % this._length);
        }
        for (let i = available; i < destinationLength; ++i) {
          target[i] = 0;
        }
      }
    }
    this._readIndex = (this._readIndex + available) % this._length;
    this._framesAvailable -= available;
    return available;
  }
};
/*
export {
  RingBuffer
};
*/