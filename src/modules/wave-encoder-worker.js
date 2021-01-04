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
			default:
				console.log("Unknown control message:", e.data);
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
	}
};

let inputSampleRate;
let inputSampleSize;
let channelCount;

let lookbackBufferMs;
let _lookbackBufferSize;
let _lookbackRingBuffer;
let recordedBuffers;

let gateIsOpen = false;

function init(){
	if (lookbackBufferMs){
		_lookbackBufferSize = Math.round((lookbackBufferMs/1000) * inputSampleRate);
		_lookbackRingBuffer = new RingBuffer(_lookbackBufferSize, channelCount, "Uint8");	//TODO: test for Float32
	}
	recordedBuffers = [];
}

//Requests

function buildBuffer(start, end){
	//TODO: use start, end
	var isFloat32;
	if (recordedBuffers[0]){
		isFloat32 = (recordedBuffers[0] && recordedBuffers[0].constructor.name.indexOf("Float32") >= 0);
		console.error("isFloat32", isFloat32, recordedBuffers[0].constructor.name);
	}
	var lookbackSamples;
	if (_lookbackRingBuffer && _lookbackRingBuffer.framesAvailable){
		lookbackSamples = [new Uint8Array(_lookbackRingBuffer.framesAvailable)];
		_lookbackRingBuffer.pull(lookbackSamples);
	}
	var dataLength = recordedBuffers.length * inputSampleSize + (lookbackSamples? lookbackSamples[0].length : 0);
	var collectBuffer = isFloat32? new Float32Array(dataLength) : new Uint8Array(dataLength); 	//TODO: this is usually too big because the last buffer is not full ...
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
	console.error("buffer mismatch", n, dataLength);
	
	return {
		buffer: collectBuffer,
		isFloat32: isFloat32
	}
}

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
	/*
	var dataLength = res.buffer.length;
	var bitDepth = 16;
	var bytesPerSample = bitDepth/8;
	
	var headerLength = 44;
	var wav = new Uint8Array(headerLength + dataLength);		//TODO: ... and due to size mismatch the rest will be zeros
	var view = new DataView(wav.buffer);

	view.setUint32(0, 1380533830, false); 		//RIFF identifier 'RIFF'
	view.setUint32(4, 36 + dataLength, true); 	//file length minus RIFF identifier length and file description length
	view.setUint32(8, 1463899717, false); 		//RIFF type 'WAVE'
	view.setUint32(12, 1718449184, false); 		//format chunk identifier 'fmt '
	view.setUint32(16, 16, true); 				//format chunk length
	view.setUint16(20, 1, true); 				//sample format (raw)
	view.setUint16(22, channelCount, true); 	//channel count
	view.setUint32(24, inputSampleRate, true); 	//sample rate
	view.setUint32(28, inputSampleRate * bytesPerSample * channelCount, true);	//byte rate (sample rate * block align)
	view.setUint16(32, bytesPerSample * channelCount, true); 	//block align (channel count * bytes per sample)
	view.setUint16(34, bitDepth, true); 		//bits per sample
	view.setUint32(36, 1684108385, false); 		//data chunk identifier 'data'
	view.setUint32(40, dataLength, true); 		//data chunk length	- TODO: what does this do and do we need to change it?

	for (let i = 0; i < dataLength; i++) {
		wav.set(recordedBuffers[i], i * recordedBuffers[i].length + headerLength);
	}
	*/
	var view = encodeWAV(res.buffer, inputSampleRate, channelCount, res.isFloat32);

	postMessage({
		output: {
			wav: view
		}
	});
}

function encodeWAV(samples, sampleRate, numChannels, convertFromFloat32){
	var buffer = new ArrayBuffer(44 + samples.length * 2);
	var view = new DataView(buffer);
	var bitDepth = 16;
	var bytesPerSample = bitDepth/8;
	//RIFF identifier
	wavWriteString(view, 0, 'RIFF');
	view.setUint32(4, 36 + samples.length * 2, true);	//TODO: should be this??? samples.length
	wavWriteString(view, 8, 'WAVE');
	wavWriteString(view, 12, 'fmt ');
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true);
	view.setUint16(22, numChannels, true);
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, sampleRate * 4, true);			//TODO: should be this??? sampleRate * bytesPerSample * numChannels
	view.setUint16(32, numChannels * bytesPerSample, true);
	view.setUint16(34, bitDepth, true);
	wavWriteString(view, 36, 'data');
	view.setUint32(40, samples.length * 2, true);
	if (convertFromFloat32){
		wavFloatTo16BitPCM(view, 44, samples);
	}else{
		let offset = 44;
		for (let i = 0; i < samples.length; i++, offset += 2) {
			view.setUint8(offset, samples[i], true);
		}
	}
	return view;
}
function wavFloatTo16BitPCM(output, offset, input) {
	for (let i = 0; i < input.length; i++, offset += 2) {
		let s = Math.max(-1, Math.min(1, input[i]));
		output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
	}
}
function wavWriteString(view, offset, string) {
	for (let i = 0; i < string.length; i++) {
		view.setUint8(offset + i, string.charCodeAt(i));
	}
}

function gateControl(open){
	gateIsOpen = open;
	postMessage({
		gateIsOpen: gateIsOpen
	});
}

//Interface

function constructWorker(options){
	inputSampleRate = options.setup.inputSampleRate || options.setup.ctxInfo.targetSampleRate || 16000;
	inputSampleSize = options.setup.inputSampleSize || 512;
	channelCount = 1;	//options.setup.channelCount || 1;		//TODO: only MONO atm
	lookbackBufferMs = (options.setup.lookbackBufferMs != undefined)? options.setup.lookbackBufferMs : 0;
	
	init();
    	
	postMessage({
		moduleState: 1,
		moduleInfo: {
			inputSampleRate: inputSampleRate,
			inputSampleSize: inputSampleSize,
			channelCount: channelCount,
			lookbackBufferSize: _lookbackBufferSize
		}
	});
}

function process(data){
	//expected: data.samples, data.sampleRate, data.targetSampleRate, data.channels, data.type
	//TODO: check process values against constructor values (sampleSize etc.)
	if (data && data.samples){
		if (gateIsOpen){
			//TODO: this will always be one channel ONLY since the signal is interleaved
			recordedBuffers.push(data.samples[0]);
			//TODO: add max length
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
