//import { RingBuffer } from './shared/ring-buffer.js';		//not yet supported by FF :-( (Dec 2020)
class RingBuffer{constructor(a,b,c){this._readIndex=0,this._writeIndex=0,this._framesAvailable=0,this._channelCount=b,this._length=a,this._channelData=[];for(let d=0;d<this._channelCount;++d)this._channelData[d]="Uint16"==c?new Uint16Array(a):"Int16"==c?new Int16Array(a):"Uint8"==c?new Uint8Array(a):"Int8"==c?new Int8Array(a):new Float32Array(a)}get framesAvailable(){return this._framesAvailable}push(a){let b=a[0].length;for(let c,d=0;d<b;++d){c=(this._writeIndex+d)%this._length;for(let b=0;b<this._channelCount;++b)this._channelData[b][c]=a[b][d]}this._writeIndex+=b,this._writeIndex>=this._length&&(this._writeIndex=0),this._framesAvailable+=b,this._framesAvailable>this._length&&(this._framesAvailable=this._length)}pull(a){if(0!==this._framesAvailable){let b=a[0].length;for(let c,d=0;d<b;++d){c=(this._readIndex+d)%this._length;for(let b=0;b<this._channelCount;++b)a[b][d]=this._channelData[b][c]}this._readIndex+=b,this._readIndex>=this._length&&(this._readIndex=0),this._framesAvailable-=b,0>this._framesAvailable&&(this._framesAvailable=0)}}};

class BufferProcessor extends AudioWorkletProcessor {
	
	get SampleSizeException() {
		return function(message){
			this.message = message;
			this.name = "SampleSizeException";
		};
	}
	  
	constructor(options) {
		super();
		
		let that = this;
		this.EXPECTED_SAMPLE_SIZE = 128;	//currently 128, but might change in future ... and even become variable! (I hope not)
		this.sourceSamplerate = options.processorOptions.ctxInfo.sampleRate;	//INFO: should be same as global scope 'sampleRate'
		
		this.emitterBufferSize = options.processorOptions.bufferSize || 512;
		this.channelCount = 1; //options.processorOptions.channels || 1;		//TODO: supports ONLY MONO atm
		
		this.passThroughMode = (options.processorOptions.passThroughMode != undefined)? options.processorOptions.passThroughMode : 1;	//0: nothing, 1: original
		
		function init(){
			//RingBuffers
			that._outputRingBuffer = new RingBuffer(that.emitterBufferSize + that.EXPECTED_SAMPLE_SIZE, that.channelCount, "Float32");
			that._newOutputBuffer = [new Float32Array(that.emitterBufferSize)];
			
			that._isFirstValidProcess = true;
			//that._lastEmit = 0;
		}
		init();
		
		function ready(){
			that.port.postMessage({
				moduleState: 1,
				moduleInfo: {
					sourceSampleRate: that.sourceSamplerate,
					emitterBufferSize: that.emitterBufferSize,
					channelCount: that.channelCount,
					inputPassThrough: that.inputPassThrough
				}
			});
		}
		//start
		function start(options){
			//TODO: anything?
			//NOTE: timing of this signal is not very well defined
		}
		//stop
		function stop(options){
			//send out the remaining buffer data here
			if (that._outputRingBuffer.framesAvailable){
				//pull last samples
				var lastSamples = [new Float32Array(that._outputRingBuffer.framesAvailable)];
				that._outputRingBuffer.pull(lastSamples);

				//Send info
				that.port.postMessage({
					samples: lastSamples,
					sampleRate: that.sourceSamplerate,
					channels: that.channelCount,
					type: lastSamples[0].constructor.name,
					isLast: true
				});
			}
			//NOTE: timing of this signal is not very well defined
		}
		function reset(options){
			//TODO: implement
			init();
		}
		
		//Control messages
		this.port.onmessage = function(e){
			if (e.data.ctrl){
				console.error("Controls", e.data.ctrl);			//DEBUG
				switch (e.data.ctrl.action) {
					//common interface
					case "start":
						start(e.data.ctrl.options);
						break;
					case "stop":
						stop(e.data.ctrl.options);
						break;
					case "reset":
						reset(e.data.ctrl.options);
						break;
					default:
						console.log("Unknown control message:", e.data);
						break;
				}
			}
        }
		
		//prepare
		ready();
	}

	process(inputs, outputs, parameters) {
		//Use 1st input and output only
		let input = inputs[0];
		let output = outputs[0];

		//NOTE: AudioWorkletProcessor always gets input[0].length frames (typically 128, might change in future)
		if (input.length > 0){
			let inputSampleSize = input[0].length;
			
			if (this._isFirstValidProcess){
				this._isFirstValidProcess = false;
				//check inputSampleSize
				if (inputSampleSize != this.EXPECTED_SAMPLE_SIZE){
					let msg = "Sample size is: " + inputSampleSize + ", expected: " + this.EXPECTED_SAMPLE_SIZE + ". Need code adjustments!";
					console.error("AudioWorkletProcessor sample size exception - Msg.: " + msg);
					throw new this.SampleSizeException(msg);
				}
			}
			
			//pass through
			if (this.passThroughMode == 1){
				for (let i = 0; i < inputSampleSize; ++i){
					output[0][i] = input[0][i];
				}
			}
			this._outputRingBuffer.push([input[0]]);	//TODO: is MONO
						
			//Process if we have enough frames for the kernel.
			if (this._outputRingBuffer.framesAvailable >= this.emitterBufferSize) {
				//pull samples
				this._outputRingBuffer.pull(this._newOutputBuffer);

				//Send info
				this.port.postMessage({
					samples: this._newOutputBuffer,
					sampleRate: this.sourceSamplerate,
					channels: this.channelCount,
					type: this._newOutputBuffer[0].constructor.name
				});
			}
		}
		return true;
	}
}

registerProcessor('buffer-switch', BufferProcessor);
