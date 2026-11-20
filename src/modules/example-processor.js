//TODO: 'import' wasn't fully supported yet by FF (Dec 2020) when this lib was first created. To use it, we need to add exports to the shared libs
//import { SampleSizeException } from './shared/common.js';
//import { RingBuffer } from './shared/ring-buffer.min.js';
class RingBuffer{constructor(t,e,n){this._readIndex=0,this._writeIndex=0,this._framesAvailable=0,this._channelCount=e,this._length=t,this._channelData=[];for(let e=0;e<this._channelCount;++e)this._channelData[e]="Uint16"==n?new Uint16Array(t):"Int16"==n?new Int16Array(t):"Uint8"==n?new Uint8Array(t):"Int8"==n?new Int8Array(t):new Float32Array(t)}get framesAvailable(){return this._framesAvailable}push(t,e){let n=t[0].length;if(!n)return;let a=Math.max(0,n-this._length),i=n-a,h=(this._writeIndex+a)%this._length,r=Math.min(i,this._length-h),s=i-r;for(let n=0;n<this._channelCount;++n){let l=t[n],_=this._channelData[n];if(!e&&ArrayBuffer.isView(l))_.set(l.subarray(a,a+r),h),s>0&&_.set(l.subarray(a+r,a+i),0);else{let r=e||function(t,e,n){return t[e][n]};for(let e=0;e<i;++e)_[(h+e)%this._length]=r(t,n,a+e)}}this._writeIndex=(h+i)%this._length,this._framesAvailable+n>=this._length?(this._framesAvailable=this._length,this._readIndex=this._writeIndex):this._framesAvailable+=n}pull(t,e){let n=t[0].length,a=Math.min(n,this._framesAvailable),i=Math.min(a,this._length-this._readIndex),h=a-i;for(let r=0;r<this._channelCount;++r){let s=this._channelData[r],l=t[r];if(!e&&ArrayBuffer.isView(l))l.set(s.subarray(this._readIndex,this._readIndex+i),0),h>0&&l.set(s.subarray(0,h),i),l.fill(0,a,n);else{let t=e||function(t,e,n){return t[e][n]};for(let e=0;e<a;++e)l[e]=t(this._channelData,r,(this._readIndex+e)%this._length);for(let t=a;t<n;++t)l[t]=0}}return this._readIndex=(this._readIndex+a)%this._length,this._framesAvailable-=a,a}};

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
