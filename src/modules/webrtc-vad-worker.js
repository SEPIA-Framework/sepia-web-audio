//imports
importScripts('./shared/common.js');
importScripts('./shared/ring-buffer.min.js');
importScripts('./shared/webrtc-vad-interface.min.js');
importScripts('./shared/webrtc-vad-wasm.js');

var vadModule;

onmessage = function(e) {
    //Audio worker interface
	//console.log("WebRtcVadWorker onmessage", e.data);		//DEBUG
	if (e.data.ctrl){
		switch (e.data.ctrl.action){
			case "construct":
				constructWorker(e.data.ctrl.options);
				break;
			case "process":
				process(e.data.ctrl.data);
				break;
			case "handle":
				handleEvent(e.data.ctrl.data);
				break;
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
			default:
				console.log("Unknown control message:", e.data);
				break;
		}
	}
};

let inputSampleRate;
let channelCount;
let inputSampleSize;
let processBufferSize;
let vadMode;
let isFloat32Input;		//default false

let _processRingBuffer;
let _vadFrames;
let _vadBufferSize;
let _vadBuffer;
let _int16InputBuffer;	//used if input is float32

let _isFirstValidProcess;

function init(){
	if (inputSampleSize > processBufferSize){
		throw JSON.stringify(new BufferSizeException("Processor 'bufferSize' has to be bigger than 'inputSampleSize'! Currently: " + inputSampleSize + " > " + processBufferSize));
		//NOTE: this needs to be a string to show up in worker.onerror properly :-/
	}
	//requirements for sampleRate: 8000, 16000, 32000, 48000 - sampleLength: sampleRate/1000 * (10|20|30) => 48k - 480, 960, 1440 ; 16k - 160, 320, 480;
	if (![8000, 16000, 32000, 48000].includes(inputSampleRate)){
		throw JSON.stringify(new SampleRateException("For this module sample-rate has to be one of: 8000, 16000, 32000, 48000"));
	}
	var allowedBufferSizes = [inputSampleRate/1000 * 30, inputSampleRate/1000 * 20, inputSampleRate/1000 * 10];		//10, 20 and 30ms frames
	_vadBufferSize = 0;
	for (let i=0; i<allowedBufferSizes.length; i++){
		if (processBufferSize == allowedBufferSizes[i] || processBufferSize % allowedBufferSizes[i] == 0){
			_vadFrames = processBufferSize / allowedBufferSizes[i];
			_vadBufferSize = allowedBufferSizes[i];
			break;
		}
	}
	if (_vadBufferSize == 0){
		throw JSON.stringify(new BufferSizeException("For sample-rate '" + inputSampleRate + "' the 'bufferSize' has to be equal or a multiple of: " + allowedBufferSizes.join(", ")));
	}
	var ringBufferSize = processBufferSize + inputSampleSize;		//TODO: check size again
	_processRingBuffer = new RingBuffer(ringBufferSize, channelCount, "Int16");
	_vadBuffer = [new Int16Array(_vadBufferSize)];
	if (isFloat32Input){
		_int16InputBuffer = [new Int16Array(inputSampleSize)];
	}
	
	_isFirstValidProcess = true;
}
function ready(skipResampler){
	postMessage({
		moduleState: 1,
		moduleInfo: {
			inputSampleRate: inputSampleRate,
			channelCount: channelCount,
			inputSampleSize: inputSampleSize,
			inputIsFloat32: isFloat32Input,
			processBufferSize: processBufferSize,
			vadMode: vadModule.getMode(),
			vadFramesMax: _vadFrames,
			vadBufferSize: _vadBufferSize
		}
	});
}

function constructWorker(options) {
	inputSampleRate = options.setup.inputSampleRate || options.setup.ctxInfo.targetSampleRate || options.setup.ctxInfo.sampleRate;
	channelCount = 1;	//options.setup.channelCount || 1;		//TODO: only MONO atm
	inputSampleSize = options.setup.inputSampleSize || 512;
	processBufferSize = options.setup.bufferSize || inputSampleSize;
	vadMode = (options.setup.vadMode != undefined)? options.setup.vadMode : 3;
	isFloat32Input = (options.setup.isFloat32 != undefined)? options.setup.isFloat32 : false;
	init();
	
	function onVadLog(msg){
		console.error("VadModuleLog -", msg);			//DEBUG (use postMessage?)
	}
	function onVadError(msg){
		console.error("VadModuleError -", msg);
		throw {name: "VadModuleError", message: msg};	//TODO: this probably needs to be a string to show up in worker.onerror properly :-/
	}
	
	//prepare
	if (!vadModule){
		onVadLog("Init. WebRTC VAD WASM module");		//DEBUG
		new WebRtcVoiceActivityDetector({
			onInfo: onVadLog,
			onError: onVadError,
			onStatusMessage: onVadLog,
			mode: vadMode
		}, function(v){
			onVadLog("WebRTC VAD ready");				//DEBUG
			vadModule = v;
			ready();
		});
	}else{
		onVadLog("WebRTC VAD module already loaded");		//DEBUG
		ready();
	}
}

function process(data) {
	//expected: data.samples, data.sampleRate, data.channels, data.type
	//might have: data.rms	-	TODO: make use of?
	if (data && data.samples){
		//Use 1st input and output only
		let input = data.samples;
		let thisInputSampleSize = input[0].length;
		
		if (_isFirstValidProcess){
			_isFirstValidProcess = false;
			//check: inputSampleRate, inputSampleSize, channelCount, float32
			if (data.sampleRate != inputSampleRate){
				var msg = "Sample-rate mismatch! Should be '" + inputSampleRate + "' is '" + data.sampleRate + "'";
				console.error("Audio Worker sample-rate exception - Msg.: " + msg);
				throw JSON.stringify(new SampleRateException(msg));			//NOTE: this needs to be a string to show up in worker.onerror properly :-/
				return;
			}
			var inputArrayType = data.type || data.samples[0].constructor.name;
			var isFloat32 = (inputArrayType.indexOf("Float32") >= 0);
			if (isFloat32 != isFloat32Input){
				var msg = "Array type mismatch! Input samples are of type '" + inputArrayType + "' but expected: " + (isFloat32Input? "Float32" : "Int16");
				console.error("Audio Worker type exception - Msg.: " + msg);
				throw JSON.stringify(new ArrayTypeException(msg));			//NOTE: this needs to be a string to show up in worker.onerror properly :-/
				return;
			}
			//TODO: should we re-init. instead of fail?
		}
		
		//TODO: is MONO
		if (isFloat32Input){
			CommonConverters.floatTo16BitPCM(_int16InputBuffer[0], input[0]);
			_processRingBuffer.push([_int16InputBuffer[0]]);
		}else{
			_processRingBuffer.push(input);
		}
		
		//Process if we have enough frames
		var vadResults = [];
		while (_processRingBuffer.framesAvailable >= _vadBufferSize) {
			//pull samples
			_processRingBuffer.pull(_vadBuffer);
			
			//activity check
			var voiceActivity = vadModule.getVoiceActivity(inputSampleRate, _vadBuffer[0]);		//TODO: is MONO
			vadResults.push(voiceActivity);
		}
		if (vadResults.length > 0){
			//Send info
			postMessage({
				voiceActivity: vadResults,
			});
		}
	}
	return true;
}

function handleEvent(data){
	//data that should not be processed but might trigger an event
}

function start(options) {
    //TODO: anything to do?
	//NOTE: timing of this signal is not very well defined, use only for gating or similar stuff!
}
function stop(options) {
	//TODO: anything to do?
	//NOTE: timing of this signal is not very well defined
}
function reset(options) {
    //TODO: clean up worker and prep. for restart
	init();
}
function release(options){
	//destroy
	_processRingBuffer = null;
	_vadBuffer = null;
	_int16InputBuffer = null;
	vadModule = null;
}

//--- helpers ---
//...
