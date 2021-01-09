//imports
importScripts('./shared/ring-buffer.min.js');

onmessage = function(e) {
    //Audio worker interface
	console.log("ExampleWorker onmessage", e.data);		//DEBUG
	if (e.data.ctrl){
		switch (e.data.ctrl.action){
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
				console.log("Unknown control message:", e.data);
				break;
		}
	}
};

let exampleInputBuffer;

function constructWorker(options) {
    exampleInputBuffer = [];
	
	postMessage({
		moduleState: 1,
		moduleInfo: {
			hello: "world"
		}
	});
}

function process(data) {
	//data, e.g.: samples, sampleRate, parameters
    //TODO: process data
	
	//postMessage(result);
}

function start(options) {
    //TODO: anything to do?
	//NOTE: timing of this signal is not very well defined, use only for gating or similar stuff!
}
function stop(options) {
    //TODO: anything to do?
	//NOTE: timing of this signal is not very well defined, use only for gating or similar stuff!
}
function reset(options) {
    //TODO: clean up worker and prep. for restart
	exampleInputBuffer = [];
}
function release(options){
	//TODO: clean up worker and close
	exampleInputBuffer = null;
}
