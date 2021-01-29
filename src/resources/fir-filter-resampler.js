//Downsampling + FIR (finite impulse response) low-pass filter
//Inspired by this discussion: http://dsp.stackexchange.com/a/37475/26392
//Written for SEPIA Web Audio Processor module
var FirFilterResampler = function(){
	var Resampler = {};
	
	Resampler.getProcessor = function(inputSampleRate, targetSampleRate, minSampleSize){
		if (inputSampleRate === targetSampleRate){
			return new float32ToInt16();
		
		}else if (inputSampleRate > targetSampleRate){
			return new downSampler(inputSampleRate, targetSampleRate, minSampleSize);
		
		}else{
			throw {name: "NotSupportedError", message: "No processor for upsampling found!"};
		}
	};

	function float32ToInt16(){
		this.process = function(float32Input){
			var int16Output = new Int16Array(float32Input.length);
			for (let n = 0; n < float32Input.length; n++){
				int16Output[n] = float32Input[n] * (float32Input[n] < 0 ? 32768 : 32767);
			}
			return int16Output;
		};
	}

	function downSampler(inputSampleRate, targetSampleRate, minSampleSize){
		var remainingSamples = new Float32Array(0);
		var resampleRatio = inputSampleRate / targetSampleRate;
		
		function sinc(x) {
			if (0 === x) return 1;
			var t = Math.PI * x;
			return Math.sin(t) / t
		}
		var filterSize = (minSampleSize >= 127)? 127 : (minSampleSize % 2)? minSampleSize : (minSampleSize - 1);
		this.filterArray = (function(inputSampleRate, targetSampleRate, filterLength){
			if (!filterLength || filterLength < 0) return new Float32Array(0);
			if (filterLength % 2 === 0) throw Error("Filter length must be odd");
			var i = new Float32Array(filterLength);
			var o = 0;
			for (let a = 0; a < filterLength; a++){
				let u = sinc(targetSampleRate / inputSampleRate * (a - (filterLength - 1) / 2));
				i[a] = u;
				o += u;
			}
			for (let a = 0; a < filterLength; a++){
				i[a] = i[a] / o;
			}
			return i;
		})(inputSampleRate, targetSampleRate, filterSize);
		
		this.process = function(float32Input){
			var t = new Float32Array(remainingSamples.length + float32Input.length);
			t.set(remainingSamples, 0);
			t.set(float32Input, remainingSamples.length);
			
			var nOut = Math.ceil((t.length - this.filterArray.length) / resampleRatio);
			var int16Output = new Int16Array(nOut);
			
			if (this.filterArray.length){
				for (let i = 0; i < nOut; i++){
					let offset = Math.round(resampleRatio * i);
					let sample = 0;
					for (let j = 0; j < this.filterArray.length; j++){
						sample += t[offset + j] * this.filterArray[j];
					}
					int16Output[i] = sample * (sample < 0 ? 32768 : 32767);
				}
			}else{
				for (let i = 0; i < nOut; i++){
					let offset = Math.round(resampleRatio * i);
					let sample = t[offset];
					int16Output[i] = sample * (sample < 0 ? 32768 : 32767);
				}
			}
			
			var lastOffset = Math.round(resampleRatio * nOut);
			remainingSamples = (lastOffset < t.length)? t.subarray(lastOffset) : new Float32Array(0);
			
			return int16Output;
		};
	};
	
	return Resampler;
}
