/**
 * buffer-output-switch.js
 *
 * Converts a buffer, received via messages interface
 * back to the output of an audio node (e.g destination).
 * Tracks pre-buffer, underruns, overruns and average fill.
 */

//ZeroPaddingRingBuffer - ring-buffer-zero-padding.min.js
class ZeroPaddingRingBuffer{constructor(t,e){this._readIndex=0,this._writeIndex=0,this._framesAvailable=0,this._channelCount=e,this._length=t,this._channelData=[];for(let n=0;n<e;n++)this._channelData[n]=new Float32Array(t)}get framesAvailable(){return this._framesAvailable}get length(){return this._length}push(t){const e=t[0].length;for(let n=0;n<e;n++){const e=(this._writeIndex+n)%this._length;for(let h=0;h<this._channelCount;h++)this._channelData[h][e]=t[h][n]}this._writeIndex=(this._writeIndex+e)%this._length,this._framesAvailable=Math.min(this._framesAvailable+e,this._length)}pull(t,e){const n=Math.min(e,this._framesAvailable);for(let e=0;e<n;e++){const n=(this._readIndex+e)%this._length;for(let h=0;h<this._channelCount;h++)t[h][e]=this._channelData[h][n]}for(let h=0;h<this._channelCount;h++)t[h].fill(0,n,e);return this._readIndex=(this._readIndex+n)%this._length,this._framesAvailable-=n,n}};

//Module class
class BufferOutputProcessor extends AudioWorkletProcessor {

	constructor(options) {
		super();

		let that = this;
		const opts = options.processorOptions || {};

		this.moduleId = 'buffer-output-switch-' + Math.round(Math.random() * 1000000) + '-' + Date.now();
		this.isReadyForProcessing = false;
		this.abortProcessingReason = null;

		this.WORKLET_BLOCK = 128;  //fixed AudioWorklet block size
		this.bufferSize = opts.bufferSize || 512;
		this.channelCount = opts.channelCount || 1;  //MONO by default

		//Below this threshold process() outputs silence to avoid underruns.
		this.prebufferThreshold = opts.prebufferThreshold || (this.WORKLET_BLOCK * 2);
		this._prebuffering = true;     //true until threshold is first reached

		this._ringSize = Math.max(this.bufferSize * 4, this.WORKLET_BLOCK * 8);
		this._ringBuffer = null;
		this._outputBlock = null;

		//Health monitoring
		this._healthTargetMin = Math.floor(this.bufferSize / 2);
		this._healthTargetMax = this.bufferSize * 2;
		this._underrunCount = 0;        // too few frames during pull()
		this._overrunCount = 0;         // buffer exceeded target max
		this._reportInterval = opts.healthReportInterval || 200;   // report every N process() calls (~1s) - TODO: make an option
		this._processCount = 0;
		this._fillSamples = [];         // fill level samples for averaging

		this.skipPrebufferStateEvents = opts.skipPrebufferStateEvents || false; //if you need to skip the buffer info events

		function createRingBuffer() {
			that._ringBuffer = new ZeroPaddingRingBuffer(that._ringSize, that.channelCount);
			that._outputBlock = Array.from({ length: that.channelCount },
				() => new Float32Array(that.WORKLET_BLOCK));
			that._prebuffering = true;
		}
		createRingBuffer();

		//ready
		function ready() {
			//send ready event
			that.isReadyForProcessing = true;
			that.port.postMessage({
				moduleState: 1,
				moduleInfo: {
					moduleId: that.moduleId,
					channelCount: that.channelCount,
					bufferSize: that.bufferSize,
					ringSize: that._ringSize,
					prebufferThreshold: that.prebufferThreshold,
					targetMinFill: that._healthTargetMin,
					targetMaxFill: that._healthTargetMax,
					healthReportInterval: that._reportInterval,
					skipPrebufferStateEvents: that.skipPrebufferStateEvents
				}
			});
		}
		//start
		function start(options) {
			//NOOP
			that.abortProcessingReason = null;
		}
		//stop
		function stop(options) {
			//TODO: reset buffer or keep remaining data for resume?
			createRingBuffer();
		}
		//reset
		function reset(options) {
			createRingBuffer();
			that._underrunCount = 0;
			that._overrunCount = 0;
			that._fillSamples = [];
		}
		//release (alias: close)
		function release(options) {
			//clean-up processor
			that._ringBuffer = null;
			that._outputBlock = null;

			//notify processor that we can terminate now
			that.port.postMessage({
				moduleState: 9
			});
		}

		//Messages and control interface
		this.port.onmessage = (e) => {
			if (e.data.ctrl) {
				switch (e.data.ctrl.action) {
					case 'start':
						start(e.data.ctrl.options);
						break;
					case 'stop':
						stop(e.data.ctrl.options);
						break;
					case 'reset':
						reset(e.data.ctrl.options);
						break;
					case 'process':
						//fill the buffer
						this.fillBuffer(e.data.ctrl.data);
						break;
					case 'release':
					case 'close':
						release(e.data.ctrl.options);
						break;
				}
			}
		};

		//we don't have to wait for anything else atm
		ready();
	}

	//Fill the ring buffer with incoming samples from the upstream module.
	//Converts Int16 -> Float32 if needed, supports multiple channels.
	fillBuffer(data) {
		if (this.abortProcessingReason) return;
		if (!data?.samples) return;

		const channelCount = data.samples.length;
		const sampleCount = data.samples[0].length;
		const float32Channels = [];

		//fail due to wrong channels
		if (channelCount !== this.channelCount) {
			console.error("[BufferOutputProcessor] Channel count expected", this.channelCount, "but was", channelCount);
			this.abortProcessingReason = "Wrong channelCount";
			return;
		}

		for (let c = 0; c < channelCount; c++) {
			const src = data.samples[c];
			if (src instanceof Int16Array || data.type === 'Int16Array') {
				// Convert Int16 (-32768..32767) to Float32 (-1.0..1.0)
				const f32 = new Float32Array(sampleCount);
				for (let i = 0; i < sampleCount; i++) f32[i] = src[i] / 32768;
				float32Channels.push(f32);
			} else if (src instanceof Float32Array) {
				float32Channels.push(src); // no conversion needed
			} else {
				console.warn('[BufferOutputProcessor] Unknown sample format:', src?.constructor?.name);
				return;
			}
		}

		// Overrun check before pushing
		if (this._ringBuffer.framesAvailable > this._healthTargetMax) {
			this._overrunCount++;
		}
		this._ringBuffer.push(float32Channels);
	}

	//pushes buffered data into the output of the audio node
	process(inputs, outputs) {
		if (this.abortProcessingReason){
			throw new Error(this.abortProcessingReason);
		}
		if (!this.isReadyForProcessing || !this._ringBuffer) return true;

		const output = outputs[0];
		this._processCount++;

		//prebuffering: fill output with silence while waiting for more data
		if (this._prebuffering) {
			if (this._ringBuffer.framesAvailable >= this.prebufferThreshold) {
				//ready for playback
				this._prebuffering = false;
				if (!this.skipPrebufferStateEvents) {
					this.port.postMessage({
						moduleEvent: true,
						eventName: "prebufferState",
						framesAvailable: this._ringBuffer.framesAvailable,
						prebuffering: this._prebuffering
					});
					//console.log('[BufferOutputProcessor] Prebuffer threshold reached, starting playback');
				}
			} else {
				//fill with silence
				for (let c = 0; c < output.length; c++) output[c].fill(0);
				return true;
			}
		}

		//if buffer runs dry, re-enter prebuffering to avoid sustained underruns
		if (this._ringBuffer.framesAvailable === 0) {
			this._prebuffering = true;
			for (let c = 0; c < output.length; c++) output[c].fill(0);
			this._underrunCount++;
			if (!this.skipPrebufferStateEvents) {
				this.port.postMessage({
					moduleEvent: true,
					eventName: "prebufferState",
					framesAvailable: this._ringBuffer.framesAvailable,
					prebuffering: this._prebuffering
				});
				//console.log('[BufferOutputProcessor] Prebuffer ran dry, filling with silence');
			}
			return true;
		}

		//measure fill level before pull()
		const fillBefore = this._ringBuffer.framesAvailable;
		this._fillSamples.push(fillBefore);

		//write samples from ring buffer into audio node output (+zero padding)
		const actualReadN = this._ringBuffer.pull(this._outputBlock, this.WORKLET_BLOCK);
		if (actualReadN < this.WORKLET_BLOCK) {
			//underrun: not enough data -- silence already inserted by pull()
			this._underrunCount++;
		}
		//copy to all output channels to data stream
		for (let c = 0; c < this._outputBlock.length; c++) {
			output[c].set(this._outputBlock[c]);
		}

		// Health report every _reportInterval calls
		if (this._processCount % this._reportInterval === 0) {
			const avgFill = this._fillSamples.reduce((a, b) => a + b, 0) / this._fillSamples.length;
			const minFill = Math.min(...this._fillSamples);
			const maxFill = Math.max(...this._fillSamples);

			let status = 'ok';
			if (this._underrunCount > 0) status = 'underrun';
			else if (this._overrunCount > 0) status = 'overrun';
			else if (avgFill < this._healthTargetMin) status = 'low';
			else if (avgFill > this._healthTargetMax) status = 'high';

			this.port.postMessage({
				moduleEvent: true,
				eventName: "bufferHealthReport",
				bufferHealth: {
					status,
					avgFill: Math.round(avgFill),
					minFill,
					maxFill,
					underruns: this._underrunCount,
					overruns: this._overrunCount,
					ringSize: this._ringBuffer.length,
					targetMin: this._healthTargetMin,
					targetMax: this._healthTargetMax,
				}
			});

			// Reset counters for next interval
			this._underrunCount = 0;
			this._overrunCount = 0;
			this._fillSamples = [];
		}

		return true;
	}
}

registerProcessor('buffer-output-switch', BufferOutputProcessor);
