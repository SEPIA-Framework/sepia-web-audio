//Register the AudioWorkletProcessor
registerProcessor('volume-meter', class extends AudioWorkletProcessor {

    constructor(options) {
        super();
		this._sourceSamplerate = options.processorOptions.ctxInfo.sampleRate;
		
        this._volume = 0;
        this._updateIntervalInMS = 25;
        this._nextUpdateFrame = this._updateIntervalInMS;
		
		//0: no smoothing, 1: keep at max (known) value
		this.smoothingFactor = (options.processorOptions.smoothingFactor != undefined)? options.processorOptions.smoothingFactor : 0.0;
		        
		this.port.onmessage = event => {
            if (event.data.updateIntervalInMS){
                this._updateIntervalInMS = event.data.updateIntervalInMS;
			}
        }
		this.port.postMessage({
			moduleState: 1,
			moduleInfo: {
				intervalInFrames: this.intervalInFrames
			}
		});
    }

    get intervalInFrames() {
        return this._updateIntervalInMS / 1000 * this._sourceSamplerate;
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
		const output = outputs[0];

        // Note that the input will be down-mixed to mono; however, if no inputs are
        // connected then zero channels will be passed in.
        if (input.length > 0) {
            const samples = input[0];
            let sum = 0;
            let rms = 0;

            // Calculated the squared-sum.
            for (let i = 0; i < samples.length; ++i){
                sum += samples[i] ** 2;
				output[0][i] = samples[i];		//TODO: check the channels properly here!
			}

            // Calculate the RMS level and update the volume.
            rms = Math.sqrt(sum / samples.length);
            this._volume = Math.max(rms, this._volume * this.smoothingFactor);

            // Update and sync the volume property with the main thread.
            this._nextUpdateFrame -= samples.length;
            if (this._nextUpdateFrame < 0) {
                this._nextUpdateFrame += this.intervalInFrames;
                this.port.postMessage({
                    volume: this._volume
                });
            }
        }

        return true;
    }
});
