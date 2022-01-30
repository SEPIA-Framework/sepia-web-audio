//TODO: not yet supported by FF :-( (Dec 2020)
//import { SampleSizeException } from './shared/common.js';
//import { RingBuffer } from './shared/ring-buffer.js';
class RingBuffer{constructor(a,b,c){this._readIndex=0,this._writeIndex=0,this._framesAvailable=0,this._channelCount=b,this._length=a,this._channelData=[];for(let d=0;d<this._channelCount;++d)this._channelData[d]="Uint16"==c?new Uint16Array(a):"Int16"==c?new Int16Array(a):"Uint8"==c?new Uint8Array(a):"Int8"==c?new Int8Array(a):new Float32Array(a)}get framesAvailable(){return this._framesAvailable}push(a,b){let c=a[0].length,d=b||function(a,b,c){return a[b][c]};for(let e,f=0;f<c;++f){e=(this._writeIndex+f)%this._length;for(let b=0;b<this._channelCount;++b)this._channelData[b][e]=d(a,b,f)}this._writeIndex+=c,this._writeIndex>=this._length&&(this._writeIndex-=this._length),this._framesAvailable+=c,this._framesAvailable>this._length&&(this._framesAvailable=this._length)}pull(a,b){if(0===this._framesAvailable)return;let c=a[0].length,d=this,e=b||function(a,b,c){return a[b][c]};for(let d,f=0;f<c;++f){d=(this._readIndex+f)%this._length;for(let b=0;b<this._channelCount;++b)a[b][f]=e(this._channelData,b,d)}this._readIndex+=c,this._readIndex>=this._length&&(this._readIndex-=this._length),this._framesAvailable-=c,0>this._framesAvailable&&(this._framesAvailable=0)}};

var someExampleVar;

class ExampleProcessor extends AudioWorkletProcessor {
	  
	constructor(options) {
		super();
		
		let that = this;
		this.EXPECTED_SAMPLE_SIZE = 128;	//currently 128, but might change in future ... and even become variable! (I hope not)
		
		//read ctxInfo and optional processor options
		this.sourceSamplerate = options.processorOptions.ctxInfo.sampleRate;	//INFO: should be same as global scope 'sampleRate'
		this.targetSamplerate = options.processorOptions.targetSamplerate || options.processorOptions.ctxInfo.targetSampleRate || 16000;
		
		this.emitterBufferSize = options.processorOptions.bufferSize || 512;
		this.channelCount = options.processorOptions.channels || 1;
		
		this.passThroughMode = (options.processorOptions.passThroughMode != undefined)? options.processorOptions.passThroughMode : 1;	//0: nothing, 1: original
		
		//ready
		function ready(){
			//do some stuff...
			
			//... then send ready message
			that.port.postMessage({
				//Default message type is "processing result", but it can be 'moduleState', 'moduleEvent' and 'moduleResponse' ("on-demand" requests) as well
				//NOTE: only default processing (no tag) and 'moduleEvent' will be forwarded automatically
				moduleState: 1,		//1=ready, 2=changed, 9=ready for termination, 10=custom error
				moduleInfo: {
					sourceSamplerate: that.sourceSamplerate,
					targetSamplerate: that.targetSamplerate,
					emitterBufferSize: that.emitterBufferSize,
					channelCount: that.channelCount,
					passThroughMode: that.passThroughMode
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
			
			//notify processor that we can terminate now
			that.port.postMessage({
				moduleState: 9
			});
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
				let sampleVal = input[0][i];	//often used: MONO
				
				//... do something with sampleVal ...
				
				//pass through input to output?
				if (this.passThroughMode == 1){
					output[0][i] = input[0][i];
				}
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
