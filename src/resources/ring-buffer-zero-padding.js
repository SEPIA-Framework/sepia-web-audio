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
		const frames = data[0].length;

		//overrun: move read-index
		const overflow = Math.max(0, (this._framesAvailable + frames) - this._length);
		if (overflow > 0) {
			this._readIndex = (this._readIndex + overflow) % this._length;
			this._framesAvailable -= overflow;
		}

		//split parts for faster assign
		const part1 = Math.min(frames, this._length - this._writeIndex);
		const part2 = frames - part1;
		for (let c = 0; c < this._channelData.length; c++) {
			this._channelData[c].set(data[c].subarray(0, part1), this._writeIndex);
			if (part2 > 0) {
				this._channelData[c].set(data[c].subarray(part1), 0);
			}
		}
		this._writeIndex = (this._writeIndex + frames) % this._length;
		this._framesAvailable = Math.min(this._framesAvailable + frames, this._length);
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