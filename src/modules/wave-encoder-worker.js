//imports
importScripts('./shared/ring-buffer.min.js');

onmessage = function(e) {
    //Audio worker interface
	if (e.data.ctrl){
		switch (e.data.ctrl.action){
			//common interface
			case "construct":
				constructWorker(e.data.ctrl.options);
				break;
			case "process":
				process(e.data.ctrl.data);
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
				console.error("Unknown control message:", e.data);
				break;
		}
	}
	//custom interface
	if (e.data.gate != undefined){
		console.error("Message", e.data);			//DEBUG
		gateControl(e.data.gate && e.data.gate == "open");
	}
	if (e.data.request){
		console.error("Message", e.data);			//DEBUG
		switch (e.data.request.get){
			case "buffer":
				getBuffer(e.data.request.start, e.data.request.end);
				break;
			case "wave":
				getWave(e.data.request.start, e.data.request.end);
				break;
			default:
				console.log("Unknown request message:", e.data);
				break;
		}
	}else if (e.data.encode && e.data.encode.data){
		encodeInterface(e.data.encode);
	}
};

let inputSampleRate;
let inputSampleSize;
let channelCount;
let encoderBitDepth = 16;
let _bytesPerSample = encoderBitDepth/8;

let lookbackBufferMs;
let lookbackBufferNeedsReset;
let _lookbackBufferSize;
let _lookbackRingBuffer;
let recordedBuffers;
let recordBufferMaxN;

let gateIsOpen = false;
let _gateOpenTS = 0;
let _gateCloseTS = 0;
let _isFirstValidProcess = true;

function init(){
	recordedBuffers = null;
	_lookbackRingBuffer = null;
	lookbackBufferNeedsReset = false;
	if (lookbackBufferMs){
		_lookbackBufferSize = Math.round((lookbackBufferMs/1000) * inputSampleRate);
		_lookbackRingBuffer = new RingBuffer(_lookbackBufferSize, channelCount, "Int16");	//TODO: test for Float32
	}else{
		_lookbackBufferSize = 0;
	}
	recordedBuffers = [];
	_isFirstValidProcess = true;
	gateIsOpen = false;
	_gateOpenTS = 0;
	_gateCloseTS = 0;
}

//Requests

function getBuffer(start, end){
	//TODO: use start, end
	var res = buildBuffer(start, end);
	postMessage({
		output: {
			buffer: res.buffer
		}
	});
}
function getWave(start, end){
	//TODO: use start, end
	var res = buildBuffer(start, end);
	var view = encodeWAV(res.buffer, inputSampleRate, channelCount, res.isFloat32);

	postMessage({
		output: {
			wav: view,
			sampleRate: inputSampleRate,
			totalSamples: (view.byteLength - 44)/_bytesPerSample),
			channels: channelCount
		}
	});
}

function gateControl(open){
	var msg = {gate: {}};
	if (open){
		//TODO: we should reset some stuff here, for now:
		if (recordBufferMaxN && recordedBuffers.length >= recordBufferMaxN){
			recordedBuffers = [];		//TODO: should this happen always? only when full? never? leave to getBuffer?
		}
		_gateOpenTS = Date.now();
		gateIsOpen = true;
		msg.gate.openedAt = _gateOpenTS;
	}else{
		_gateCloseTS = Date.now();
		gateIsOpen = false;
		msg.gate.openedAt = _gateOpenTS;
		msg.gate.closedAt = _gateCloseTS;
	}
	msg.gate.isOpen = gateIsOpen;
	postMessage(msg);
}

//Interface

function constructWorker(options){
	inputSampleRate = options.setup.inputSampleRate || options.setup.ctxInfo.targetSampleRate || options.setup.ctxInfo.sampleRate;
	inputSampleSize = options.setup.inputSampleSize || 512;
	channelCount = 1;	//options.setup.channelCount || 1;		//TODO: only MONO atm
	lookbackBufferMs = (options.setup.lookbackBufferMs != undefined)? options.setup.lookbackBufferMs : 0;
	
	if (options.setup.recordBufferLimitMs != undefined){
		recordBufferMaxN = (inputSampleRate * options.setup.recordBufferLimitMs/1000) / inputSampleSize;
	}else if (options.setup.recordBufferLimitKb != undefined){
		recordBufferMaxN = (options.setup.recordBufferLimitKb * 1024) / (2 * inputSampleSize);
	}else{
		recordBufferMaxN = 5242880 / (2 * inputSampleSize);	//max 5MB = (5242880[bytes]/(bytesPerSample * sampleSize))
	}
	recordBufferMaxN = Math.ceil(recordBufferMaxN);
	if (recordBufferMaxN < 0) recordBufferMaxN = 0;
	
	//TODO: add stream output option
	//TODO: lookback audio gets mixed with record sometimes O_o
	
	init();
    	
	postMessage({
		moduleState: 1,
		moduleInfo: {
			inputSampleRate: inputSampleRate,
			inputSampleSize: inputSampleSize,
			channelCount: channelCount,
			lookbackBufferSizeKb: Math.ceil((_lookbackBufferSize * 2)/1024),	//1 sample = 2 bytes
			lookbackLimitMs: lookbackBufferMs,
			recordLimitMs: Math.ceil((recordBufferMaxN * inputSampleSize * 1000)/inputSampleRate)
		}
	});
}

function process(data){
	//expected: data.samples, data.sampleRate, data.targetSampleRate, data.channels, data.type
	//TODO: check process values against constructor values (sampleSize etc.)
	if (data && data.samples){
		if (_isFirstValidProcess){
			_isFirstValidProcess = false;
			console.error("data info", data);		//DEBUG
			if (data.sampleRate != inputSampleRate){
				var msg = "Sample-rate mismatch! Should be '" + inputSampleRate + "' is '" + data.sampleRate + "'";
				console.error("Audio Worker sample-rate exception - Msg.: " + msg);
				throw new SampleRateException(msg);
				return;
			}
			//check: inputSampleRate, inputSampleSize, channelCount
		}
		if (gateIsOpen){
			//TODO: this will always be one channel ONLY since the signal is interleaved
			recordedBuffers.push(data.samples[0]);
			//max length
			if (recordBufferMaxN && recordedBuffers.length >= recordBufferMaxN){
				gateControl(false);
				//TODO: after this has triggered the nex record sounds distorted???
			}
			if (!lookbackBufferNeedsReset) lookbackBufferNeedsReset = true;
			
		}else if (lookbackBufferMs && !lookbackBufferNeedsReset){
			//do this only until gate was opened .. then wait for buffer export/clear
			_lookbackRingBuffer.push(data.samples);
		}
	}
}

function start(options){
    //TODO: anything to do?
	//NOTE: timing of this signal is not very well defined
}
function stop(options){
    //TODO: anything to do?
	//NOTE: timing of this signal is not very well defined
}
function reset(options){
    //TODO: clean up worker
	init();
}
function release(options){
	//clean up worker and close
	_lookbackRingBuffer = null;
	recordedBuffers = null;
	gateIsOpen = false;
	_gateOpenTS = 0;
	_gateCloseTS = 0;
}

//--- helpers ---

function SampleRateException(message) {
	this.message = message;
	this.name = "SampleRateException";
}

function buildBuffer(start, end){
	//TODO: use start, end
	var isFloat32;
	if (recordedBuffers[0]){
		isFloat32 = (recordedBuffers[0] && recordedBuffers[0].constructor.name.indexOf("Float32") >= 0);
		console.error("isFloat32", isFloat32, recordedBuffers[0].constructor.name);
	}
	var lookbackSamples;
	if (_lookbackRingBuffer && _lookbackRingBuffer.framesAvailable){
		lookbackSamples = [new Int16Array(_lookbackRingBuffer.framesAvailable)];
		_lookbackRingBuffer.pull(lookbackSamples);
	}
	var dataLength = recordedBuffers.length * inputSampleSize + (lookbackSamples? lookbackSamples[0].length : 0);
	var collectBuffer = isFloat32? new Float32Array(dataLength) : new Int16Array(dataLength); 	//TODO: this is usually too big because the last buffer is not full ...
	var n = 0;
	if (lookbackSamples){
		for (let i = 0; i < lookbackSamples[0].length; i++) {
			collectBuffer[n] = lookbackSamples[0][i];
			n++;
		}
	}
	for (let j = 0; j < recordedBuffers.length; j++) {
		for (let i = 0; i < recordedBuffers[j].length; i++) {
			collectBuffer[n] = recordedBuffers[j][i];
			n++;
		}
	}
	console.error("buffer mismatch", n, dataLength);	//TODO: why does this always match?
	
	return {
		buffer: collectBuffer,
		isFloat32: isFloat32
	}
	//TODO: we clear lookback buffer here ... so we should clear everything
}

function encodeWAV(samples, sampleRate, numChannels, convertFromFloat32){
	if (!samples || !sampleRate || !numChannels){
		console.error("Wave Encoder Worker - encodeWAV - Missing parameters");
		return;
	}
	//Format description: http://soundfile.sapp.org/doc/WaveFormat/
	var buffer = new ArrayBuffer(44 + samples.length * 2);
	var view = new DataView(buffer);
	var bitDepth = encoderBitDepth;
	var bytesPerSample = _bytesPerSample;
	var sampleSize = samples.length;
	//RIFF identifier
	wavWriteString(view, 0, 'RIFF');
	view.setUint32(4, 36 + (sampleSize * numChannels * bytesPerSample), true);	//TODO: was (samples.length * 2)
	wavWriteString(view, 8, 'WAVE');
	wavWriteString(view, 12, 'fmt ');
	view.setUint32(16, 16, true);	//16 for PCM
	view.setUint16(20, 1, true);	//1 for PCM
	view.setUint16(22, numChannels, true);
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, sampleRate * bytesPerSample * numChannels, true);	//TODO: was (sampleRate * 4)
	view.setUint16(32, numChannels * bytesPerSample, true);
	view.setUint16(34, bitDepth, true);
	wavWriteString(view, 36, 'data');
	view.setUint32(40, (sampleSize * numChannels * bytesPerSample), true);
	if (convertFromFloat32){
		wavFloatTo16BitPCM(view, 44, samples);
	}else{
		let offset = 44;
		for (let i = 0; i < sampleSize; i++, offset += 2) {
			view.setInt16(offset, samples[i], true);
		}
	}
	return view;
}
function wavFloatTo16BitPCM(view, offset, input) {
	for (let i = 0; i < input.length; i++, offset += 2) {
		let s = Math.max(-1, Math.min(1, input[i]));
		view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
	}
}
function wavWriteString(view, offset, string) {
	for (let i = 0; i < string.length; i++) {
		view.setUint8(offset + i, string.charCodeAt(i));
	}
}
function encodeInterface(e){
	var format = e.format;
	if (format == "wave"){
		var samples = e.data.samples[0];		//TODO: MONO only or interleaved stereo in channel 1
		var view = encodeWAV(samples, e.data.sampleRate, e.data.channels, e.data.isFloat32);
		postMessage({
			encoderResult: {
				wav: view,
				sampleRate: inputSampleRate,
				channels: channelCount
			}
		});
	}else{
		postMessage({encoderResult: {}, error: "format not supported"});
	}
}