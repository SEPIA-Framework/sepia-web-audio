//TODO: not yet supported by FF :-( (Dec 2020)
//import { SampleSizeException } from './shared/common.js';
//import { RingBuffer } from './shared/ring-buffer.js';
class RingBuffer{constructor(a,b,c){this._readIndex=0,this._writeIndex=0,this._framesAvailable=0,this._channelCount=b,this._length=a,this._channelData=[];for(let d=0;d<this._channelCount;++d)this._channelData[d]="Uint16"==c?new Uint16Array(a):"Int16"==c?new Int16Array(a):"Uint8"==c?new Uint8Array(a):"Int8"==c?new Int8Array(a):new Float32Array(a)}get framesAvailable(){return this._framesAvailable}push(a){let b=a[0].length;for(let c,d=0;d<b;++d){c=(this._writeIndex+d)%this._length;for(let b=0;b<this._channelCount;++b)this._channelData[b][c]=a[b][d]}this._writeIndex+=b,this._writeIndex>=this._length&&(this._writeIndex-=this._length),this._framesAvailable+=b,this._framesAvailable>this._length&&(this._framesAvailable=this._length)}pull(a){if(0!==this._framesAvailable){let b=a[0].length;for(let c,d=0;d<b;++d){c=(this._readIndex+d)%this._length;for(let b=0;b<this._channelCount;++b)a[b][d]=this._channelData[b][c]}this._readIndex+=b,this._readIndex>=this._length&&(this._readIndex-=this._length),this._framesAvailable-=b,0>this._framesAvailable&&(this._framesAvailable=0)}}};

var someExampleVar;

class ExampleProcessor extends AudioWorkletProcessor {
	  
	constructor(options) {
		super();
		
		let that = this;
		this.EXPECTED_SAMPLE_SIZE = 128;	//currently 128, but might change in future ... and even become variable! (I hope not)
		
		//read ctxInfo and optional processor options
		this.sourceSamplerate = options.processorOptions.ctxInfo.sampleRate;	//INFO: should be same as global scope 'sampleRate'
		this.targetSamplerate = options.processorOptions.targetSamplerate || options.processorOptions.ctxInfo.targetSampleRate || 16000;
		
		//ready
		function ready(){
			//do some stuff...
			
			//... then send ready message
			that.port.postMessage({
				//Default message type is "processing result", but it can be 'moduleState', 'moduleEvent' and 'moduleResponse' ("on-demand" requests) as well
				//NOTE: only default processing (no tag) and 'moduleEvent' will be forwarded automatically
				moduleState: 1,		//1=ready, 2=changed
				moduleInfo: {
					sourceSamplerate: that.sourceSamplerate,
					targetSamplerate: that.targetSamplerate,
					emitterBufferSize: that.emitterBufferSize,
					calculateRmsVolume: that.calculateRmsVolume,
					channelCount: that.channelCount,
					resamplingMode: that.resamplingMode,
					inputPassThrough: that.inputPassThrough
				}
			});
		}
		//start
		function start(options){
			//anything to do?
			//NOTE: timing of this signal is not very well defined, use only for gating or similar stuff!
		}
		//stop
		function stop(options){
			//anything to do?
			//NOTE: timing of this signal is not very well defined, use only for gating or similar stuff!
		}
		//reset
		function reset(options){
			//reset processor
		}
		//release (alias: close)
		function release(options){
			//clean-up processor
		}
		
		//Control interface
		this.port.onmessage = function(e){
            console.log("ExampleProcessor onmessage", e.data);		//DEBUG
			if (e.data.ctrl){
				switch (e.data.ctrl.action) {
					case "start":
						start(e.data.ctrl.options);
						break;
					case "stop":
						stop(e.data.ctrl.options);
						break;
					case "reset":
						reset(e.data.ctrl.options);
						break;
					case "release":
					case "close":
						release(e.data.ctrl.options);
						break;
					case "process":
						//customProcess(e.data.ctrl.data);		//custom processing? (better use workers here)
						break;
					case "handle":
						//handleEvent(e.data.ctrl.data);		//custom events that could trigger specific actions
						break;
					default:
						console.error("Unknown control message:", e.data);
						break;
				}
			}
        }
		
		//do something with a callback or call ready right away
		ready();
	}

	process(inputs, outputs, parameters) {
		//Use 1st input and output only - TODO: supports only mono atm
		let input = inputs[0];
		let output = outputs[0];

		//NOTE: AudioWorkletProcessor always gets input[0].length frames (typically 128, might change in future)
		if (input.length > 0){
			let inputSampleSize = input[0].length;		//should be this.EXPECTED_SAMPLE_SIZE
						
			//transfer input to output
			for (let i = 0; i < inputSampleSize; ++i){
				let sampleVal = input[0][i];	//TODO: ONLY MONO!
				
				//pass through
				output[0][i] = sampleVal;
			}
			
			//Send info
			/*
			this.port.postMessage({
				myData: stuff,
				samples: processResult
			});
			*/
		}
		return true;
	}
}

registerProcessor('example-processor', ExampleProcessor);
