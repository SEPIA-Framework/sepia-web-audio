//imports
importScripts('./shared/ring-buffer.min.js');

onmessage = function(e) {
    //Audio worker interface
	if (e.data.ctrl){
		console.error("Controls", e.data.ctrl);			//DEBUG
		switch (e.data.ctrl.action){
			case "construct":
				constructWorker(e.data.ctrl.options);
				break;
			case "process":
				process(e.data.ctrl.samples, e.data.ctrl.sampleRate, e.data.ctrl.parameters);
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

function process(samples, sampleRate, parameters) {
    //TODO: process data
	
	//postMessage(result);
}

function start(options) {
    //TODO: anything to do?
	//NOTE: timing of this signal is not very well defined
}
function stop(options) {
    //TODO: anything to do?
	//NOTE: timing of this signal is not very well defined
}
function reset(options) {
    //TODO: clean up worker
	exampleInputBuffer = [];
}
