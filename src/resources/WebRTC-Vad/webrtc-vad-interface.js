//WebRTC VAD Interface for SEPIA Web-Audio Processor
var WebRtcVoiceActivityDetector = function(options, initCallback){
	this.vadModule = {};
	this.options = options || {};
	
	var onPrint = this.options.onInfo || this.options.onPrint || function(text){ console.log("VAD print", text); };
	var onError = this.options.onError || this.options.onPrintErr || function(text){ console.error("VAD printErr", text); };
	var onStatus = this.options.onStatusMessage || this.options.onSetStatus || function(text){ console.log("VAD setStatus", text); };
	var vadMode = (this.options.mode != undefined)? this.options.mode : 3;	//modes: 0=Quality mode, 1=Low bitrate mode, 2=Aggressive mode, 3=Very aggressive mode

	WebRtcVad({
		preRun: [],
		postRun: [],
		print: function(text){
			if (arguments.length > 1) text = Array.prototype.slice.call(arguments).join(' ');
			onPrint(text);
		},
		printErr: function(text){
			if (arguments.length > 1) text = Array.prototype.slice.call(arguments).join(' ');
			onError(text);
		},
		setStatus: function(text){
			if (arguments.length > 1) text = Array.prototype.slice.call(arguments).join(' ');
			onStatus(text);
		},
		totalDependencies: 0,
		monitorRunDependencies: function(left){
			this.totalDependencies = Math.max(this.totalDependencies, left);
			this.setStatus(left ? 'Preparing... (' + (this.totalDependencies - left) + '/' + this.totalDependencies + ')' : 'All downloads complete.');
		},
		noInitialRun: true
	})
	.then(function(Module){
		var Vad = {
			wasmModule: Module
			//setMode: ...,
			//getMode: ...,
			//process: ...
		};
		
		//setup
		
		var main = Module.cwrap('main');
		if (main() != 1){
			onError("VAD 'main' error");
			throw {name: "VadModuleError", message: "Failed to initialize via 'main()'"};
		}

		Vad.setMode = Module.cwrap('setmode', 'number', ['number']);
		Vad.getMode = function(){ return vadMode; };
		
		if (Vad.setMode(vadMode) != 0){
			onError("VAD 'setMode' error");
			throw {name: "VadModuleError", message: "Failed to set mode"};
		}
		onPrint("VAD mode: " + vadMode);
		
		Vad.process = Module.cwrap('process_data', 'number', ['number', 'number', 'number', 'number', 'number', 'number']);
		//arguments: (dataHeap.byteOffset, sampleLength, sampleRate, samples[0], samples[100], samples[2000])
		//requirements for sampleRate: 8000, 16000, 32000, 48000 - sampleLength: sampleRate/1000 * (10|20|30) => 48k - 480, 960, 1440 ; 16k - 160, 320, 480 ; 
		
		Vad.getVoiceActivity = function(sampleRate, samplesInt16){
			//Get data byte size, allocate memory on Emscripten heap, and get pointer
			let nDataBytes = samplesInt16.length * samplesInt16.BYTES_PER_ELEMENT;
			let dataPtr = Module._malloc(nDataBytes);

			//Copy data to Emscripten heap (directly accessed from Module.HEAPU8)
			let dataHeap = new Uint8Array(Module.HEAPU8.buffer, dataPtr, nDataBytes);
			dataHeap.set(new Uint8Array(samplesInt16.buffer));

			//Call function and get result
			let result = Vad.process(dataHeap.byteOffset, samplesInt16.length, sampleRate, 
				samplesInt16[0], samplesInt16[100], samplesInt16[2000]);

			//Free memory
			Module._free(dataHeap.byteOffset);
			return result;		//-1: ERROR, 0: No active speech, 1: Active speech	(core function gives 1-6 but output here is 1 for all)
		};
		
		return Vad;
	})
	.then(function(vad){
		this.vadModule = vad;
		if (initCallback) initCallback(this.vadModule);
	});
	//Module.setStatus('Downloading...');
}
