/**
 * buffer-output-switch.js
 *
 * Converts a buffer, received via messages interface
 * back to the output of an audio node (e.g destination).
 * Tracks pre-buffer, underruns, overruns and average fill.
 */

//ZeroPaddingRingBuffer - ring-buffer-zero-padding.min.js
class ZeroPaddingRingBuffer{constructor(t,e){this._readIndex=0,this._writeIndex=0,this._framesAvailable=0,this._length=t,this._channelData=[];for(let a=0;a<e;a++)this._channelData[a]=new Float32Array(t)}get framesAvailable(){return this._framesAvailable}get length(){return this._length}get channelCount(){return this._channelData.length}push(t){const e=t[0].length,a=Math.max(0,this._framesAvailable+e-this._length);a>0&&(this._readIndex=(this._readIndex+a)%this._length,this._framesAvailable-=a);const h=Math.min(e,this._length-this._writeIndex),n=e-h;for(let e=0;e<this._channelData.length;e++)this._channelData[e].set(t[e].subarray(0,h),this._writeIndex),n>0&&this._channelData[e].set(t[e].subarray(h),0);this._writeIndex=(this._writeIndex+e)%this._length,this._framesAvailable=Math.min(this._framesAvailable+e,this._length)}pull(t,e){const a=Math.min(e,this._framesAvailable),h=Math.min(a,this._length-this._readIndex),n=a-h;for(let s=0;s<this._channelData.length;s++)t[s].set(this._channelData[s].subarray(this._readIndex,this._readIndex+h),0),n>0&&t[s].set(this._channelData[s].subarray(0,n),h),t[s].fill(0,a,e);return this._readIndex=(this._readIndex+a)%this._length,this._framesAvailable-=a,a}clear(){this._readIndex=0,this._writeIndex=0,this._framesAvailable=0;for(let t=0;t<this._channelData.length;t++)this._channelData[t].fill(0)}};

//Module class
class BufferOutputProcessor extends AudioWorkletProcessor {

	constructor(options) {
		super();

		let that = this;
		const opts = options.processorOptions;

		this.moduleId = 'buffer-output-switch-' + Math.round(Math.random() * 1000000) + '-' + Date.now();
		this.isReadyForProcessing = false;
		this.abortProcessingReason = null;

		this.WORKLET_BLOCK = 128;  //fixed AudioWorklet block size
		this.sourceSamplerate = opts.ctxInfo?.sampleRate || sampleRate;
		this._frameTimeMs = (this.WORKLET_BLOCK / this.sourceSamplerate) * 1000;

		this.channelCount = opts.channelCount || 1;  //MONO by default
		this.inputBufferSize = opts.inputBufferSize || 1024;	//NOTE: we have to assume these are filled with 128 samples/frame
		this.jitterMs = opts.jitterMs || 12;  //expected jitter between main and audio thread (postMessage related)
		//this.jitterBuffer = this.WORKLET_BLOCK * Math.ceil(this.jitterMs / this._frameTimeMs);
		this.disableJitterMeasurement = !!opts.disableJitterMeasurement;
		this._lastInputTs = 0;	//last input (currentTime in [s])

		//Below this threshold process() outputs silence to avoid underruns.
		this.prebufferThreshold = opts.prebufferThreshold;
		if (!this.prebufferThreshold){
			let framesToInput = Math.ceil(this.inputBufferSize / this.WORKLET_BLOCK);
			let framesJitter = Math.ceil(this.jitterMs / this._frameTimeMs);
			this.prebufferThreshold = this.WORKLET_BLOCK * (framesToInput + framesJitter + 1);
			//this.prebufferThreshold = Math.max(this.inputBufferSize, this.WORKLET_BLOCK * 2) + this.jitterBuffer;
		}
		this._prebuffering = true;     //true until threshold is first reached

		this._ringSize = 4 * Math.max(this.inputBufferSize, this.prebufferThreshold);
		this._ringBuffer = null;
		this._outputBlock = null;
		//performance tweak for int16 to float32:
		this._scratchBuffers = Array.from({length: this.channelCount}, () => new Float32Array(this.inputBufferSize));
		this._inv16 = 1 / 32768;

		this._expectedLatency = ((Math.ceil(this.prebufferThreshold / this.inputBufferSize) * this.inputBufferSize) 
			/ this.sourceSamplerate) * 1000;

		//Health monitoring
		this._healthTargetMin = this.WORKLET_BLOCK * 2;
		this._healthTargetMax = this._ringSize - Math.max(this.inputBufferSize, this.prebufferThreshold);
		this._prebufferCount = 0;       // ticks in pre-buffering mode
		this._underrunCount = 0;        // too few frames during pull()
		this._overrunCount = 0;         // buffer exceeded target max
		this._reportInterval = opts.healthReportInterval || 200;   // report every N process() calls (~1s) - TODO: make an option
		this._processCount = 0;
		this._fillSamples = [];         // fill level samples for averaging
		this._inputJitterRec = [];		// postMessage jitter values for averaging

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
					inputBufferSize: that.inputBufferSize,
					ringSize: that._ringSize,
					prebufferThreshold: that.prebufferThreshold,
					expectedLatencyMs: that._expectedLatency,
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
			that._processCount = 0;
			that._prebufferCount = 0;
			that._underrunCount = 0;
			that._overrunCount = 0;
			that._fillSamples = [];
			that._inputJitterRec = [];
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
		if (this.abortProcessingReason || !data?.samples) return;

		const samples = data.samples;
		const channelCount = samples.length;

		//fail due to wrong channels
		if (channelCount !== this.channelCount) {
			console.error("[BufferOutputProcessor] Channel count expected", this.channelCount, "but was", channelCount);
			this.abortProcessingReason = "Wrong channelCount";
			return;
		}

		// Overrun check before pushing
		const sampleCount = samples[0].length;
		if (!sampleCount){
			//TODO: report error?
			return;
		}else{
			//pseudo-jitter measurement
			if (this._lastInputTs){
				let inputFramesN = Math.ceil(sampleCount / this.WORKLET_BLOCK);
				let expectedTimeMs = inputFramesN * this._frameTimeMs;
				let jitter = Math.abs(((currentTime - this._lastInputTs) * 1000) - expectedTimeMs);
				//TODO: use data to warn user?
				if (!this.disableJitterMeasurement)	this._inputJitterRec.push(jitter);
			}
			this._lastInputTs = currentTime;
		}
		if ((this._ringSize - this._ringBuffer.framesAvailable) < sampleCount) {
			this._overrunCount++;
			//reset to prevent more errors
			this._ringBuffer.clear();
		}

		//convert int16 to float32
		if (data.type === 'Int16Array' || samples[0] instanceof Int16Array) {
			for (let c = 0; c < channelCount; c++) {
				const src = samples[c];
				const dst = this._scratchBuffers[c];
				for (let i = 0; i < sampleCount; i++) {
					dst[i] = src[i] * this._inv16;
				}
			}
			this._ringBuffer.push(this._scratchBuffers);
		} else {
			this._ringBuffer.push(samples);
		}
	}

	//report health of buffers etc.
	reportHealth() {
		//NOTE: fill level is only counting frames that are NOT in prebuffer state
		const avgFill = this._fillSamples.reduce((a, b) => a + b, 0) / this._fillSamples.length;
		const minFill = Math.min(...this._fillSamples);
		const maxFill = Math.max(...this._fillSamples);

		let avgJitter = null;
		let minJitter = null;
		let maxJitter = null;
		if (!this.disableJitterMeasurement){
			avgJitter = this._inputJitterRec.reduce((a, b) => a + b, 0) / this._inputJitterRec.length;
			minJitter = Math.min(...this._inputJitterRec);
			maxJitter = Math.max(...this._inputJitterRec);
		}

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
				prebuffering: this._prebuffering,
				avgFill: Math.round(avgFill),
				minFill,
				maxFill,
				avgJitter,
				minJitter,
				maxJitter,
				prebufferCount: this._prebufferCount,
				underruns: this._underrunCount,
				overruns: this._overrunCount
			}
		});

		// Reset counters for next interval
		this._prebufferCount = 0;
		this._underrunCount = 0;
		this._overrunCount = 0;
		this._fillSamples = [];
		this._inputJitterRec = [];
	}

	//pushes buffered data into the output of the audio node
	process(inputs, outputs) {
		if (this.abortProcessingReason){
			throw new Error(this.abortProcessingReason);
		}
		if (!this.isReadyForProcessing || !this._ringBuffer) return true;

		const output = outputs[0];
				
		// Health report every _reportInterval calls
		this._processCount++;
		if (this._processCount % this._reportInterval === 0) {
			this.reportHealth();
		}
		//console.log("framesAvailable:", this._ringBuffer.framesAvailable, "underruns:", this._underrunCount);	//DEBUG

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
				this._prebufferCount++;
				//fill with silence
				for (let c = 0; c < output.length; c++) output[c].fill(0);
				return true;
			}
		
		//if buffer runs dry, re-enter prebuffering to avoid sustained underruns
		}else if (this._ringBuffer.framesAvailable < this.WORKLET_BLOCK) {
			this._prebuffering = true;
			this._prebufferCount++;
			this._underrunCount++;
			//fill with silence
			for (let c = 0; c < output.length; c++) output[c].fill(0);
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
		this._ringBuffer.pull(this._outputBlock, this.WORKLET_BLOCK);	//returns: actualReadN
		for (let c = 0; c < this._outputBlock.length; c++) {
			output[c].set(this._outputBlock[c]);
		}

		return true;
	}
}

registerProcessor('buffer-output-switch', BufferOutputProcessor);
