/**
 * Original copyright 2018 Google LLC - Licensed under the Apache License, Version 2.0;
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
   *
   * @param  {array} arraySequence A sequence of Arrays.
   * @param  {function} customTransform A function of (array, channel, index) to transform the input during push (or null).
   */
  push(arraySequence, customTransform) {
    // The channel count of arraySequence and the length of each channel must
    // match with this buffer obejct.

    // Transfer data from the |arraySequence| storage to the internal buffer.
    let sourceLength = arraySequence[0].length;
	let transform = customTransform || function(thisArray, channel, i){
		return thisArray[channel][i];
	}
    for (let i = 0; i < sourceLength; ++i) {
      let writeIndex = (this._writeIndex + i) % this._length;
      for (let channel = 0; channel < this._channelCount; ++channel) {
        this._channelData[channel][writeIndex] = transform(arraySequence, channel, i);
      }
    }

    this._writeIndex += sourceLength;
    if (this._writeIndex >= this._length) {
      this._writeIndex = this._writeIndex - this._length;
    }

    // For excessive frames, the buffer will be overwritten.
    this._framesAvailable += sourceLength;
    if (this._framesAvailable > this._length) {
      this._framesAvailable = this._length;
    }
  }

  /**
   * Pull data out of buffer and fill a given sequence of Arrays.
   *
   * @param  {array} arraySequence An array of Arrays.
   * @param  {function} customTransform A function of (array, channel, index) to transform the output during pull (or null).
   */
  pull(arraySequence, customTransform) {
    // The channel count of arraySequence and the length of each channel must
    // match with this buffer obejct.

    // If the FIFO is completely empty, do nothing.
    if (this._framesAvailable === 0) {
      return;
    }

    let destinationLength = arraySequence[0].length;
	let that = this;
	let transform = customTransform || function(thisArray, channel, i){
		return thisArray[channel][i];
	}

    // Transfer data from the internal buffer to the |arraySequence| storage.
    for (let i = 0; i < destinationLength; ++i) {
      let readIndex = (this._readIndex + i) % this._length;
      for (let channel = 0; channel < this._channelCount; ++channel) {
        arraySequence[channel][i] = transform(this._channelData, channel, readIndex);
      }
    }

    this._readIndex += destinationLength;
    if (this._readIndex >= this._length) {
      this._readIndex = this._readIndex - this._length;
    }

    this._framesAvailable -= destinationLength;
    if (this._framesAvailable < 0) {
      this._framesAvailable = 0;
    }
  }
};
/*
export {
  RingBuffer
};
*/