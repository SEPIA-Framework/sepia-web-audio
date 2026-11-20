// DIFFERENCES from original ring-buffer:
// - No support for multiple types, uses only 'Float32' as default.
// - Zero-padding will fill missing output with silence to prevent artifacts.
class ZeroPaddingRingBuffer {
	constructor(length, channelCount) {
		this._readIndex = 0;
		this._writeIndex = 0;
		this._framesAvailable = 0;
		this._length = length;
		this._channelData = [];
		for (let i = 0; i < channelCount; i++) {
			this._channelData[i] = new Float32Array(length);
		}
	}

	get framesAvailable() { return this._framesAvailable; }
	get length() { return this._length; }
	get channelCount() { return this._channelData.length; }

	push(data) {
		//of a chunk longer than the buffer only the last frames are kept
		const total = data[0].length;
		if (!total) return;
		const skip = Math.max(0, total - this._length);
		const frames = total - skip;
		const start = (this._writeIndex + skip) % this._length;

		//split parts for faster assign
		const part1 = Math.min(frames, this._length - start);
		const part2 = frames - part1;
		for (let c = 0; c < this._channelData.length; c++) {
			this._channelData[c].set(data[c].subarray(skip, skip + part1), start);
			if (part2 > 0) {
				this._channelData[c].set(data[c].subarray(skip + part1, skip + frames), 0);
			}
		}
		this._writeIndex = (start + frames) % this._length;

		//overrun: the oldest frames were overwritten, read from the oldest one left
		if (this._framesAvailable + total >= this._length) {
			this._framesAvailable = this._length;
			this._readIndex = this._writeIndex;
		} else {
			this._framesAvailable += total;
		}
	}

	pull(output, frames) {
		// NOTE: remaining output is filled with silence on underrun.
		// This prevents stale samples from lingering in the WebAudio output.
		const available = Math.min(frames, this._framesAvailable);

		//split parts for faster assign
		const part1 = Math.min(available, this._length - this._readIndex);
		const part2 = available - part1;
		for (let c = 0; c < this._channelData.length; c++) {
			output[c].set(this._channelData[c].subarray(this._readIndex, this._readIndex + part1), 0);
			if (part2 > 0) {
				output[c].set(this._channelData[c].subarray(0, part2), part1);
			}
			// Fill missing frames with silence (underrun)
			output[c].fill(0, available, frames);
		}
		
		this._readIndex = (this._readIndex + available) % this._length;
		this._framesAvailable -= available;
		return available; // actually read frames
	}

	clear() {
		this._readIndex = 0;
		this._writeIndex = 0;
		this._framesAvailable = 0;
		for (let i = 0; i < this._channelData.length; i++) {
			this._channelData[i].fill(0);
		}
	}
}