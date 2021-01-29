var WebRtcVoiceActivityDetector = function(options, initCallback){
	this.vadModule = {};

	WebRtcVad({
		preRun: [],
		postRun: [],
		print: function(text){
			console.log("print", text);
		},
		printErr: function(text){
			if (arguments.length > 1) text = Array.prototype.slice.call(arguments).join(' ');
			console.error("printErr", text);
		},
		setStatus: function(text){
			if (arguments.length > 1) text = Array.prototype.slice.call(arguments).join(' ');
			console.log("setStatus", text);
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
		
		console.log('setup webrtc vad');
		var main = Module.cwrap('main');
		main();
		
		var vadMode = 3; 	//modes: 0=Quality mode, 1=Low bitrate mode, 2=Aggressive mode, 3=Very aggressive mode
		Vad.setMode = Module.cwrap('setmode', 'number', ['number']);
		Vad.getMode = function(){ return vadMode; };
		
		if (Vad.setMode(vadMode) != 0){
			console.error("VAD setMode error");
		}
		console.log("vad mode:", vadMode);
		
		Vad.process = Module.cwrap('process_data', 'number', ['number', 'number', 'number', 'number', 'number', 'number']);
		//arguments: (dataHeap.byteOffset, sampleLength, sampleRate, samples[0], samples[100], samples[2000])
		
		Vad.isSilence = function(sampleRate, samplesInt16){
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
			return result;
		};
		
		return Vad;
	})
	.then(function(vad){
		this.vadModule = vad;
		if (initCallback) initCallback();
	});
	//Module.setStatus('Downloading...');
}
