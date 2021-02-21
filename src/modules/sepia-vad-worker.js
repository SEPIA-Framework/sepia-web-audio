//imports
importScripts('./shared/common.js');
importScripts('./shared/ring-buffer.min.js');
importScripts('./shared/meyda.min.compressed.js');

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
let processBufferSize;	//defines '_processRingBuffer' size together with 'inputSampleSize'
let vadMode;
let isFloat32Input;		//default false

let voiceEnergy;
let voiceEnergyCap = 50;
let voiceEnergyDropRate = 2;
let _samplesToTimeMsFactor;

let _processRingBuffer;		//holds multiple vadFrames
let _vadFrames;				//each frame processes one chunk of '_vadBufferSize' as long as '_processRingBuffer' has enough samples
let _vadFrameTimeMs;		//real time (ms) of one vadFrame (defined by sample-rate and buffer size)
let _vadBufferSize;			//size of a single vadFrame (restrictions apply)
let _vadBuffer;
let _previousVadBuffer;
let _transferFun;

//parameters to calculate vad
let _movingAvgLoudness;
let _maxLoudness = 0;
let _movingAvgLoudnessWeight = 800;		//TODO: make variable and normalize with sample-rate

//sequence control
let useSequenceAnalyzer = false;
let voiceActivationTime;
let voiceResetTime;
let silenceActivationTime;
let maxSequenceTime;
let minSequenceTime;

let _sequenceVoiceTime;
let _sequenceSilenceTime;
let _sequenceSawVoice, _sequenceSawSilenceAfterVoice, _sequenceFinishedVoice;
let _sequenceIsActive, _sequenceIsDone, _sequenceStartedAt;

let _isFirstValidProcess;

function init(){
	if (inputSampleSize > processBufferSize){
		throw JSON.stringify(new BufferSizeException("Processor 'bufferSize' has to be bigger than 'inputSampleSize'! Currently: " + inputSampleSize + " > " + processBufferSize));
		//NOTE: this needs to be a string to show up in worker.onerror properly :-/
	}
	//requirements for sampleRate: 8000-48000 - sampleLength: sampleRate/1000 * (10|20|30) => 48k - 480, 960, 1440 ; 16k - 160, 320, 480;
	if (inputSampleRate < 8000 || inputSampleRate > 48000){
		throw JSON.stringify(new SampleRateException("For this module sample-rate has to be between 8000 and 48000 Hz."));
	}
	var allowedBufferSizes = [8192, 4096, 2048, 1024, 512, 256, 128];		//recommended: 10-30ms frame length, e.g. 256/16000 = 16ms
	_vadBufferSize = 0;
	for (let i=0; i<allowedBufferSizes.length; i++){
		if (processBufferSize == allowedBufferSizes[i] || processBufferSize % allowedBufferSizes[i] == 0){
			_vadFrames = processBufferSize / allowedBufferSizes[i];
			_vadBufferSize = allowedBufferSizes[i];
			break;
		}
	}
	if (_vadBufferSize == 0){
		throw JSON.stringify(new BufferSizeException("The 'bufferSize' has to be equal or a multiple of: " + allowedBufferSizes.join(", ")));
	}else{
		_samplesToTimeMsFactor = 1000/inputSampleRate;
		_vadFrameTimeMs = Math.round(_vadBufferSize * _samplesToTimeMsFactor);
		if (_vadFrameTimeMs < 5 || _vadFrameTimeMs > 86){
			throw JSON.stringify(new BufferSizeException("Frame length (bufferSize/sampleRate * 1000) is '" + _vadFrameTimeMs + "ms' but should be in the range of 10-30ms and cannot be below 5ms or above 86ms)."));
		}
	}
	var ringBufferSize = processBufferSize + inputSampleSize;		//TODO: check size again
	_processRingBuffer = new RingBuffer(ringBufferSize, channelCount, "Float32");
	_vadBuffer = [new Float32Array(_vadBufferSize)];
	_previousVadBuffer = [new Float32Array(_vadBufferSize)];
	if (isFloat32Input){
		//we need flot32 for Meyda so this is all good
		_transferFun = function(thisArray, channel, i){
			return thisArray[channel][i];
		}
	}else{
		//... but here we need to transform (NOTE: exprects Int16Array)
		_transferFun = function(thisArray, channel, i){
			return CommonConverters.singleSampleInt16ToFloat32BitAudio(thisArray[channel][i]);
		}
	}
	
	resetSequence();
	
	_isFirstValidProcess = true;
}
function ready(){
	postMessage({
		moduleState: 1,
		moduleInfo: {
			inputSampleRate: inputSampleRate,
			channelCount: channelCount,
			inputSampleSize: inputSampleSize,
			inputIsFloat32: isFloat32Input,
			processBufferSize: processBufferSize,
			vadMode: vadMode,
			vadFramesMax: _vadFrames,
			vadBufferSize: _vadBufferSize,
			vadFrameTimeMs: _vadFrameTimeMs,
			voiceEnergyCap: voiceEnergyCap,
			voiceEnergyDropRate: voiceEnergyDropRate,
			useSequenceAnalyzer: useSequenceAnalyzer
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
	
	if (options.setup.voiceEnergyCap != undefined) voiceEnergyCap = options.setup.voiceEnergyCap;
	if (options.setup.voiceEnergyDropRate) voiceEnergyDropRate = options.setup.voiceEnergyDropRate;
	if (options.setup.sequence){
		useSequenceAnalyzer = true;
		voiceActivationTime = options.setup.sequence.voiceActivationTime || 250;
		voiceResetTime = options.setup.sequence.voiceResetTime || 1500;
		silenceActivationTime = options.setup.sequence.silenceActivationTime || 250;
		maxSequenceTime = options.setup.sequence.maxSequenceTime || 6000;
		minSequenceTime = options.setup.sequence.minSequenceTime || 600;
	}else{
		useSequenceAnalyzer = false;
	}
	
	//Meyda options and defaults
	Meyda.melBands = 26;
	Meyda.numberOfMFCCCoefficients = 13;
	Meyda.windowingFunction = "hanning";	//"hamming"
	var meydaRequiredFeatures = ["mfcc", "loudness"];		
	//https://meyda.js.org/audio-features.html: "spectralCentroid", "spectralFlatness", "spectralFlux" (requires previous spec.)
	var meydaAnalyzer = options.setup.meydaAnalyzer || {};
	var meydaFeatures = [];
	var meydaSettingsKeys = Object.keys(meydaAnalyzer);
	if (meydaSettingsKeys.length > 0){
		//setup
		meydaSettingsKeys.forEach(function(k, i){
			if (k == "features"){
				meydaFeatures = meydaAnalyzer[k];
			}else{
				Meyda[k] = meydaAnalyzer[k];
			}
		});
	}
	//Meyda requirements
	Meyda.sampleRate = inputSampleRate;
	Meyda.bufferSize = inputSampleSize;
	if (!Meyda.bufferSize || (Meyda.bufferSize & (Meyda.bufferSize -1) != 0)){
		throw {name: "VadModuleMeydaError", message: "Meyda buffer-size must be power of 2, e.g. 128, 256, 512, 1024, ..."};
	}
	if (!meydaFeatures){
		Meyda.features = meydaRequiredFeatures;
	}else{
		Meyda.features = meydaFeatures;
		meydaRequiredFeatures.forEach(function(f, i){
			if (!Meyda.features.includes(f)){
				Meyda.features.push(f);
			}
		});
	}
	
	init();
	ready();
}

//averages
function getWeightedMovingAverage(prevAvg, nextValue, weight){
	if (prevAvg == undefined){
		return nextValue;
	}else{
		return (prevAvg + (nextValue - prevAvg)/weight);
	}
} 

//sequence block
function sequenceDetector(voiceActivity){
	if (voiceActivity == 0){
		if (_sequenceSawVoice){
			_sequenceSilenceTime += _vadFrameTimeMs;
			if (_sequenceSilenceTime > voiceResetTime){
				_sequenceSawSilenceAfterVoice = true;
			}else if (_sequenceSilenceTime > silenceActivationTime){
				_sequenceVoiceTime = 0;
			}
		}
	}else{
		_sequenceVoiceTime += _vadFrameTimeMs;
		if (!_sequenceSawVoice && _sequenceVoiceTime > voiceActivationTime){
			_sequenceSawVoice = true;
			registerEvent(1, 'voice_start');
		}else if (_sequenceVoiceTime > voiceActivationTime){
			_sequenceSilenceTime = 0;
		}
	}
	
	if (_sequenceSawVoice && _sequenceSawSilenceAfterVoice){
		_sequenceFinishedVoice = true;
	}else if (_sequenceSawVoice && (_sequenceVoiceTime > minSequenceTime)){
		if (!_sequenceIsActive){
			_sequenceIsActive = true;
			_sequenceStartedAt = Date.now();
			registerEvent(2, 'sequence_started');
		}
	}

	if (_sequenceFinishedVoice){
		_sequenceIsDone = true;
		registerEvent(3, 'finished_voice');

	}else if (_sequenceSawVoice){
		if (_sequenceIsActive && ((Date.now() - _sequenceStartedAt) > maxSequenceTime)) {
			_sequenceIsDone = true;
			registerEvent(4, 'finished_voice_maxtime');
		}
	}
		
	if (_sequenceIsDone){
		if (_sequenceIsActive) registerEvent(5, 'sequence_complete');
		resetSequence();
	}
}
function resetSequence(){
	//vad
	voiceEnergy = 0;
	_sequenceSawVoice = false;
	_sequenceFinishedVoice = false;
	_sequenceSawSilenceAfterVoice = false;
	_sequenceVoiceTime = 0;
	_sequenceSilenceTime = 0;
	_sequenceIsActive = false;
	_sequenceStartedAt = 0;
	_sequenceIsDone = false;
}
function registerEvent(code, msg, data){
	var msg = {
		vadSequenceCode: code,
		vadSequenceMsg: msg
	};
	switch (code){
		//case 1: voice start
		//case 2: sequence start
		//case 3: case 4: finished voice
		case 5:
			//sequence complete
			msg.vadSequenceStarted = _sequenceStartedAt;
			msg.vadSequenceEnded = Date.now();
			break;
		default:
			break;
	}
	//Send info
	postMessage(msg);
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
			let inputArrayType = data.type || data.samples[0].constructor.name;
			let isFloat32 = (inputArrayType.indexOf("Float32") == 0);
			let isInt16 = (inputArrayType.indexOf("Int16") == 0)
			if ((isFloat32 != isFloat32Input) || (!isFloat32Input && !isInt16)){
				var msg = "Array type mismatch! Input samples are of type '" + inputArrayType + "' but expected: " + (isFloat32Input? "Float32" : "Int16");
				console.error("Audio Worker type exception - Msg.: " + msg);
				throw JSON.stringify(new ArrayTypeException(msg));			//NOTE: this needs to be a string to show up in worker.onerror properly :-/
				return;
			}
		}
		
		//TODO: is MONO
		_processRingBuffer.push(input, _transferFun);
		
		//Process if we have enough frames
		var vadResults = [];
		var loudnessResults = [];
		var mfcc = [];
		while (_processRingBuffer.framesAvailable >= _vadBufferSize) {
			//pull samples
			_processRingBuffer.pull(_vadBuffer);
			
			//Meyda features
			let features = Meyda.extract(Meyda.features, _vadBuffer[0], _previousVadBuffer[0]);
			//console.log("features_meyda", features);
			_previousVadBuffer = _vadBuffer;
			
			//let loudness = (features.loudness.specific[1] + features.loudness.specific[2] + features.loudness.specific[3]); //'specific' shows each loudness on bark scale, 'total' is the sum
			//let loudness = features.loudness.total;
			let loudness = features.loudness.specific.slice(1, 5).reduce(function(a, b){ return a + b; });
			_maxLoudness = Math.max(_maxLoudness, loudness);
			_movingAvgLoudness = getWeightedMovingAverage(_movingAvgLoudness, loudness, _movingAvgLoudnessWeight);
			
			mfcc.push(features.mfcc);
			
			//activity check
			var voiceActivity = (loudness/_movingAvgLoudness) > (1 + vadMode/10)? 1 : 0;
			vadResults.push(voiceActivity);
			loudnessResults.push(loudness);
			
			//voice energy and sequence check
			if (voiceActivity){
				voiceEnergy++;
				if (voiceEnergyCap && voiceEnergy > voiceEnergyCap) voiceEnergy = voiceEnergyCap;
			}else{
				voiceEnergy = voiceEnergy - voiceEnergyDropRate;
				if (voiceEnergy < 0) voiceEnergy = 0;
			}
			if (useSequenceAnalyzer){
				sequenceDetector(voiceActivity);
			}
		}
		if (vadResults.length > 0){
			//Send info
			//console.log("features", vadResults, loudnessResults, _movingAvgLoudness, _maxLoudness);
			postMessage({
				voiceActivity: vadResults,
				voiceEnergy: voiceEnergy,
				voiceLoudness: loudnessResults,
				mfcc: mfcc,
				movingAvgLoudness: _movingAvgLoudness,
				maxLoudness: _maxLoudness
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
	resetSequence();
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
	_previousVadBuffer = null;
	_movingAvgLoudness = undefined;
	_maxLoudness = 0;
}

//--- helpers ---
//...
