//Cordova Audio Input Plugin support

//--- UNDER CONSTRUCTION ---
	
var isCordovaAudioinputSupported = (window.cordova && window.audioinput);
var audioInputPluginIsSet = false;
var audioInputPluginHasPermission = false;

var audioInputPluginErrorCallback = undefined;
var audioInputPluginData = undefined;

//Errors
function onAudioInputError(error){
	//console.error("CordovaAudioInputPlugin error: " + JSON.stringify(error));
	if (audioInputPluginErrorCallback) audioInputPluginErrorCallback(error);
}
//Audio signal
function onAudioInputData(data){
	if (audioInputPluginData) audioInputPluginData(data);
}

//Init
function initAudioinputPlugin(){
	if (isCordovaAudioinputSupported && !audioInputPluginIsSet){
		window.addEventListener('audioinputerror', onAudioInputError, false);
		window.addEventListener("audioinput", onAudioInputData, false);
		audioInputPluginIsSet = true;
		return true;
	}else if (audioInputPluginIsSet){
		return true;
	}else{
		return false;
	}
}

//Check permission
function checkAudioinputPermission(successCallback, errorCallback){
	//First check whether we already have permission to access the microphone.
	window.audioinput.checkMicrophonePermission(function(hasPermission) {
		if (hasPermission){
			audioInputPluginHasPermission = true;
			if (successCallback) successCallback();
		}else{
			// Ask the user for permission to access the microphone
			window.audioinput.getMicrophonePermission(function(hasPermission, message){
				if (hasPermission) {
					//console.log("CordovaAudioInputPlugin: User granted access to microphone :-)");
					audioInputPluginHasPermission = true;
					if (successCallback) successCallback();
				}else{
					//console.error("CordovaAudioInputPlugin error: User refused access to microphone :-(");
					audioInputPluginHasPermission = false;
					if (errorCallback) errorCallback({name: "AudioInputPermission", message: "User refused access to microphone :-("});
				}
			});
		}
	});
}

//Start / Stop
function startRecording(onDataCallback, onErrorCallback){
	audioInputPluginErrorCallback = onErrorCallback;
	audioInputPluginData = onDataCallback;
	
	if (!audioInputPluginHasPermission){
		var errMsg = {name: "AudioInputPermission", message: "Not allowed to access microphone :-("};
		onAudioInputError(errMsg);
		return;
	}
	if (!initAudioinputPlugin()){
		var errMsg = {name: "AudioInputSupport", message: "Could not initialize audio input plugin :-("};
		onAudioInputError(errMsg);
		return;
	}
	/* ------ Alternative ------
	if (recorderAudioContext){
		window.audioinput.start({
			streamToWebAudio: true,
			audioContext: recorderAudioContext
		});
	}else{
		window.audioinput.start({ 
			streamToWebAudio: true
		});
		recorderAudioContext = window.audioinput.getAudioContext();
	}
	//Get input for the recorder
	var inputPoint = recorderAudioContext.createGain();
	window.audioinput.connect(inputPoint);
	*/
	var sourceConfig = {
		sampleRate: 16000,
		bufferSize: 2048,
		channels: 1,
		format: window.audioinput.FORMAT.PCM_16BIT,
		audioSourceType: window.audioinput.AUDIOSOURCE_TYPE.VOICE_COMMUNICATION,	//VOICE_COMMUNICATION UNPROCESSED DEFAULT
		normalize: true,
		streamToWebAudio: false
	}
	window.audioinput.start(sourceConfig);
}
function stopRecording(){
	if (window.audioinput && window.audioinput.isCapturing()){
		window.audioinput.stop();
	}else{
		//console.error("CordovaAudioInputPlugin error: Tried to capture audio but was already running!");
		onAudioInputError({name: "AudioInputRunning", message: "Audio capture was already running."});
	}
}

//Module export
export { checkAudioinputPermission, startRecording, stopRecording };
