if (!(typeof SepiaFW == "object")){
	SepiaFW = {};
}
(function (parentModule){
	var WebAudio = parentModule.webAudio || {};
	
	//Preparations
	var AudioContext = window.AudioContext || window.webkitAudioContext;
	var isMediaDevicesSupported = undefined;
	var isCordovaAudioinputSupported = undefined;

	function testStreamRecorderSupport(){
		isMediaDevicesSupported = (!!AudioContext && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
		isCordovaAudioinputSupported = (window.cordova && window.audioinput);
		return !!isMediaDevicesSupported || isCordovaAudioinputSupported;
	}
	
	WebAudio.isStreamRecorderSupported = testStreamRecorderSupport(); 		//set once at start
	WebAudio.isNativeStreamResamplingSupported = true; 	//will be tested on first media-stream creation
	
	WebAudio.defaultProcessorOptions = {
		moduleFolder: "modules",
		initSuccessCallback: console.log,
		initErrorCallback: console.error,
		//modules: [],
		//onaudiostart: console.log,
		//onaudioend: console.log,
		//onrelease: console.log,
		onerror: console.error
		//debugLog: console.log
	}

	//Media constraints
	WebAudio.getSupportedAudioConstraints = function(){
		var sc = navigator.mediaDevices.getSupportedConstraints();
		var c = {}, owc = WebAudio.overwriteSupportedAudioConstraints;
		if (sc.channelCount) c.channelCount = (owc.channelCount != undefined)? owc.channelCount : 1;
		if (sc.noiseSuppression) c.noiseSuppression = (owc.noiseSuppression != undefined)? owc.noiseSuppression : true;
		if (sc.autoGainControl) c.autoGainControl = (owc.autoGainControl != undefined)? owc.autoGainControl : false;
		if (sc.echoCancellation) c.echoCancellation = (owc.echoCancellation != undefined)? owc.echoCancellation : false;
		if (sc.sampleRate) c.sampleRate = (owc.sampleRate != undefined)? owc.sampleRate : 48000;
		//other options: latency: double, sampleSize: 16
		return c;
	};
	WebAudio.overwriteSupportedAudioConstraints = {};
	
	//Processor class
	
	WebAudio.Processor = function(options, initSuccessCallback, initErrorCallback){
		var thisProcessor = this;
		if (!initErrorCallback) initErrorCallback = WebAudio.defaultProcessorOptions.initErrorCallback;
		if (!initSuccessCallback) initSuccessCallback = WebAudio.defaultProcessorOptions.initSuccessCallback;
		if (!options) options = {};
		//TODO: add mic sinkId option
		
		var onProcessorError = options.onerror || WebAudio.defaultProcessorOptions.onerror;
		var moduleFolder = (options.moduleFolder || WebAudio.defaultProcessorOptions.moduleFolder).replace(/\/$/, "") + "/";
		
		var inputSampleRate;
		var sampleRateMismatch = 0;
		
		var mainAudioContext;
		var startFun;
		var stopFun;
		var releaseFun;
		var isProcessing = false;
		
		//Internal functions
		
		var isInitialized = false;
		var isInitPending = false;
		var initTimeout = options.initializerTimeout || 3000;
		var initTimeoutTimer;
		var initConditions = {};
		var sourceInitInfo = {};
		var modulesInitInfo = [];
		function addInitCondition(tag){
			if (options.debugLog) options.debugLog("Started init. condition: " + tag);
			initConditions[tag] = 1;
		}
		function completeInitCondition(tag){
			if (initConditions[tag]){
				delete initConditions[tag];
				if (options.debugLog) options.debugLog("Completed init. condition: " + tag);
				if (Object.keys(initConditions).length == 0){
					if (!isInitialized){
						clearTimeout(initTimeoutTimer);
						initSuccessCallback({
							name: "ProcessorReady", 
							message: "Processor is ready for action",
							inputSampleRate: inputSampleRate, 
							targetSampleRate: (options.targetSampleRate || inputSampleRate),
							sourceInfo: sourceInitInfo,
							modulesInfo: modulesInitInfo
						});
						isInitialized = true;
						isInitPending = false;
					}
				}
			}
		}
		function resetInitializer(){
			clearTimeout(initTimeoutTimer);
			isInitialized = false;
			isInitPending = false;
			//Define some conditions in advance
			initConditions = {};
			addInitCondition("sourceSetup");
			addInitCondition("modulesSetup");
		}
		function initializerError(err){
			//TODO: trigger 'thisProcessor.release' ?
			resetInitializer();
			initErrorCallback(err);
		}
		resetInitializer();		//make sure we start clean
		isInitPending = true;
		initTimeoutTimer = setTimeout(function(){
			initializerError({message: "Initialization took too long! If you expect long running init. process use option 'initializerTimeout' (ms).", name: "ProcessorInitTimeout"});
		}, initTimeout);
		
		async function createOrUpdateAudioContext(forceNew, ignoreOptions){
			if (mainAudioContext && forceNew){
				if (mainAudioContext.state != "closed"){
					await mainAudioContext.close();
				}
				mainAudioContext = null;
			}
			if (!mainAudioContext || mainAudioContext.state == "closed"){
				//TODO: clean up old context and sources?
				var contextOptions = {};
				if (!ignoreOptions && options.targetSampleRate){
					//NOTE: currently (Dec 2020) only Chromium can do this:
					contextOptions.sampleRate = options.targetSampleRate;
				}
				mainAudioContext = new AudioContext(contextOptions);
				if (options.startSuspended){
					await mainAudioContext.suspend();
				}else{
					await mainAudioContext.resume();
				}
				await createModules();
			}
			return mainAudioContext;
		}
		async function createModules(){
			if (!options.modules){
				return;
			}
			for (let i=0; i<options.modules.length; i++){
				let module = options.modules[i];
				let moduleType, moduleName;
				if (typeof module == "object"){
					moduleType = ((module.type && module.type == "worker") || module.isWorker)? 2 : 1; 	//1: AudioWorklet, 2: Web Worker
					moduleName = module.name;
				}else{
					moduleType = 1;
					moduleName = module;
				}
				if (moduleType == 1){
					//TODO: add option "pathUrl"?
					let modulePath = moduleFolder + moduleName + ".js";
					if (options.debugLog) options.debugLog("Adding audioWorklet module: " + modulePath);
					try {
						await mainAudioContext.audioWorklet.addModule(modulePath);
					}catch(e){
						console.error(e);
						if (options.debugLog) options.debugLog("FAILED to add audioWorklet module: " + modulePath + " - Msg.: " + e.name + ", " + e.message);
					}
				}else{
					let modulePath = moduleFolder + moduleName.replace(/-worker$/, "") + '-worker.js';
					if (options.debugLog) options.debugLog("Adding worker module: " + modulePath);
				}
			}
		}
		
		//States
		
		function setStateProcessing(){
			isProcessing = true;
		}
		function setStateProcessingStop(){
			isProcessing = false;
		}
		function setStateProcessorReleased(){
			//anythinig?
		}
			
		//Supported?
		if (!WebAudio.isStreamRecorderSupported && !options.customSourceTest && !options.customSource){
			var err = {name: "NotSupportedError", message: "Cannot create audio stream recorder because there are no compatible interfaces!"};
			initializerError(err);
			return;
		}
		
		//Add audio worklets
		function addModules(processNodes, completeCallback){
			if (options.modules && options.modules.length){
				var initInfo = new Array(options.modules.length);
				var n = options.modules.length;
				options.modules.forEach(function(module, i){
					addInitCondition("module-" + i);
					//supports "string" (name) or "object" with options
					var moduleType, moduleName, moduleSetup;
					if (typeof module == "object"){
						moduleType = ((module.type && module.type == "worker") || module.isWorker)? 2 : 1; 	//1: AudioWorklet, 2: Web Worker
						moduleName = module.name;
						moduleSetup = module.setup || module.settings;
					}else{
						moduleType = 1;
						moduleName = module;
						moduleSetup = {};
					}
					//add some context info
					var fullOptions =  moduleSetup.options || {};
					var thisProcessNode;
					function onMessage(event){
						if (event && event.data && event.data.moduleState == 1){
							completeInitCondition("module-" + i);
							if (event.data.moduleInfo) thisProcessNode.moduleInfo = event.data.moduleInfo;
							initInfo[i] = {
								moduleName: thisProcessNode.moduleName,
								moduleInfo: thisProcessNode.moduleInfo
							};
							if (--n == 0){
								completeCallback(initInfo);
							}
						}else if (moduleSetup.sendToModules){
							moduleSetup.sendToModules.forEach(function(n){
								processNodes[n].sendToModule({ctrl: {action: "process", data: event.data}});
							});
						}
						if (moduleSetup.onmessage){
							moduleSetup.onmessage(event.data, processNodes);
						}
					};
					function onError(err){
						//TODO: do something with 'completeInitCondition("module-" + i)' or abort whole processor?
						onProcessorError({
							name: "AudioModuleProcessorException",
							message: ("Error in module: " + err.target.moduleName + " - Check console for details.")
						});
						if (isInitPending && !isInitialized){
							completeInitCondition("module-" + i);
							initializerError({message: "Error during setup of module: " + thisProcessNode.moduleName, name: "ProcessorInitError"});
						}
					}
					
					//AudioWorkletProcessor
					if (moduleType == 1){
						if (!fullOptions.processorOptions) fullOptions.processorOptions = fullOptions.setup || {};	//common field is "setup"
						if (!fullOptions.processorOptions.ctxInfo){
							fullOptions.processorOptions.ctxInfo = {
								sampleRate: mainAudioContext.sampleRate,
								targetSampleRate: options.targetSampleRate
							}
						}
						thisProcessNode = new AudioWorkletNode(mainAudioContext, moduleName, fullOptions);
						thisProcessNode.moduleName = moduleName;
						thisProcessNode.port.onmessage = onMessage;
						thisProcessNode.onprocessorerror = onError;
						thisProcessNode.sendToModule = function(msg){ thisProcessNode.port.postMessage(msg); };
					
					//Web Worker
					}else{
						if (!fullOptions.setup) fullOptions.setup = {};
						if (!fullOptions.setup.ctxInfo){
							fullOptions.setup.ctxInfo = {
								sampleRate: mainAudioContext.sampleRate,
								targetSampleRate: options.targetSampleRate
							}
						}
						thisProcessNode = new Worker(moduleFolder + moduleName.replace(/-worker$/, "") + '-worker.js'); //NOTE: a worker has to be named "-worker.js"!
						thisProcessNode.moduleName = moduleName;
						thisProcessNode.onmessage = onMessage;
						thisProcessNode.onerror = onError;
						thisProcessNode.sendToModule = function(msg){ thisProcessNode.postMessage(msg); };
						thisProcessNode.sendToModule({ctrl: {action: "construct", options: fullOptions}});
					}
					thisProcessNode.moduleType = moduleType;
					module.handle = thisProcessNode;
					
					processNodes.push(thisProcessNode);
				});
			}else{
				completeCallback([]);
			}
		}			

		//AUDIO SOURCE HANDLER
		
		function sourceHandler(source, controls, metaInfo){
			inputSampleRate = mainAudioContext.sampleRate;
			if (!metaInfo) metaInfo = {};
			if (options.targetSampleRate && options.targetSampleRate != inputSampleRate){
				WebAudio.isNativeStreamResamplingSupported = false;
				sampleRateMismatch = inputSampleRate - options.targetSampleRate;
			}
									
			//Primary node
			var processNodes = [source];	//TODO: handle this for workers as well
			var audioWorkletNodes = [];		//all worklets will be connected in row
			
			//Connect other nodes?
			addModules(processNodes, function(info){
				modulesInitInfo = info;
				completeInitCondition("modulesSetup");
				thisProcessor.processNodes = processNodes;
				
				let hasResampler = false;
				processNodes.forEach(function(node){
					if (!node.moduleType || node.moduleType == 1){
						audioWorkletNodes.push(node);
					}
					if (node.moduleInfo && node.moduleInfo["resamplingMode"]) hasResampler = true;
				});

				if (sampleRateMismatch && !hasResampler){
					initializerError({message: "Samplerate mismatch and no resampler found!", name: "ProcessorInitError"});
					return;
				}
			});
			
			//Destination node?
			var destinationNode = options.destinationNode || mainAudioContext.destination;
			
			//source info
			thisProcessor.mainAudioContext = mainAudioContext;
			thisProcessor.source = source;
			thisProcessor.sourceInfo = metaInfo;
			sourceInitInfo = metaInfo;
			
			//controls
			if (!controls) controls = {};	//e.g.: onBeforeStart, onAfterStart, onBeforeStop, onAfterStop, onBeforeRelease, onAfterRelease
			
			//START
			startFun = function(callback){
				Promise.resolve((controls.onBeforeStart || noop)())
				.then(function(){
					return mainAudioContext.resume();
				})
				.then(function(){
					//connect worklets
					if (audioWorkletNodes.length > 1){
						for (var i=1; i<audioWorkletNodes.length; i++){
							audioWorkletNodes[i-1].connect(audioWorkletNodes[i]);
						}
						audioWorkletNodes[i-1].connect(destinationNode);
					}else{
						audioWorkletNodes[0].connect(destinationNode);
					}
					//signal
					processNodes.forEach(function(node){
						if (node.sendToModule) node.sendToModule({ctrl: {action: "start", options: {}}});	//TODO: add options from moduleOptions?
					});
					if (controls.onAfterStart){
						return Promise.resolve(controls.onAfterStart());
					}
				})
				.then(callback)
				.catch(function(err){onProcessorError({name: "ProcessorStartError", message: (err.name + " - Message: " + (err.message || err))});});
			}
			//STOP
			stopFun = function(callback){
				Promise.resolve((controls.onBeforeStop || noop)())
				.then(function(){
					//disconnect and signal
					processNodes.forEach(function(node){
						if (!node.moduleType || node.moduleType == 1) node.disconnect();
						if (node.sendToModule) node.sendToModule({ctrl: {action: "stop", options: {}}});	//TODO: add options from moduleOptions?
					});
					return mainAudioContext.suspend();
				})
				.then(function(){
					if (controls.onAfterStop){
						return Promise.resolve(controls.onAfterStop());
					}
				})
				.then(callback)
				.catch(function(err){onProcessorError({name: "ProcessorStopError", message: (err.name + " - Message: " + (err.message || err))});});
			}
			//RELEASE
			releaseFun = function(callback){
				Promise.resolve((controls.onBeforeRelease || noop)())
				.then(function(){
					//signal
					processNodes.forEach(function(node, i){
						if (node.sendToModule) node.sendToModule({ctrl: {action: "release", options: {}}});		//TODO: add options from moduleOptions?
						processNodes[i] = null;
						//TODO: wait for result, confirm?
					});
					thisProcessor.processNodes = null;
					thisProcessor.source = null;
					//TODO: check state before calling close?
					return mainAudioContext.close();
				})
				.then(function(){
					if (controls.onAfterRelease){
						return Promise.resolve(controls.onAfterRelease());
					}
				})
				.then(function(){
					return Promise.resolve(resetInitializer());
				})
				.then(callback)
				.catch(function(err){onProcessorError({name: "ProcessorReleaseError", message: (err.name + " - Message: " + (err.message || err))});});
			}
			
			completeInitCondition("sourceSetup");
		}
		
		//SOURCE(S)
		
		//Custom source test
		if (options.customSourceTest){
			//NOTE: This is just for testing!
			var thisProcessNode;
			WebAudio.createWhiteNoiseGeneratorNode(0.1, {
				targetSampleRate: options.targetSampleRate
			})
			.then(function(processNode){
				//Audio context and source node
				thisProcessNode = processNode;
				mainAudioContext = processNode.context;
				return createModules();
				
			}).then(function(){
				//continue with source handler
				sourceHandler(thisProcessNode, {}, {
					type: "whiteNoiseGenerator"		//TODO: add more?
				});
				
			}).catch(function(err){
				initializerError(err);
				return;
			});
			
		//Custom source node
		}else if (options.customSource){
			//Get audio context and source node then add modules
			var thisProcessNode = options.customSource.node;
			mainAudioContext = thisProcessNode.context;
			createModules().then(function(){
				//continue with source handler
				sourceHandler(thisProcessNode, {
					onBeforeStart: options.customSource.beforeStart,
					onAfterStart: options.customSource.start,
					onBeforeStop: options.customSource.stop, 
					onAfterRelease: options.customSource.release
				}, {
					type: "custom"		//TODO: add more
				});
				
			}).catch(function(err){
				initializerError(err);
				return;
			});
			
		//Cordova Audioinput plugin
		}else if (isCordovaAudioinputSupported){
			//TODO: implement?
		
		//Official MediaDevices interface using microphone
		}else{
			let constraints = JSON.parse(JSON.stringify(WebAudio.getSupportedAudioConstraints()));
			if (constraints.sampleRate && options.targetSampleRate) constraints.sampleRate = options.targetSampleRate;
			//other options: latency: double, sampleSize: 16
			let audioVideoConstraints = { 
				video : false, audio: (Object.keys(constraints).length? constraints : true)
			};
			//'getUserMedia' can be empty in unsecure context!
			if (!navigator.mediaDevices.getUserMedia){
				initializerError({message: "'getUserMedia' is not available! Check if context is secure (SSL, HTTPS, etc.).", name: "ProcessorInitError"});
				return;
			}
			navigator.mediaDevices.getUserMedia(audioVideoConstraints).then(async function(stream){
				//Audio context and source node
				if (WebAudio.isNativeStreamResamplingSupported){
					mainAudioContext = await createOrUpdateAudioContext(false, false);		//Try native resampling first
				}else{
					mainAudioContext = await createOrUpdateAudioContext(false, true);
				}
				
				var source;
				try {
					source = mainAudioContext.createMediaStreamSource(stream);
				}catch(e){
					mainAudioContext = await createOrUpdateAudioContext(true, true);
					source = mainAudioContext.createMediaStreamSource(stream);
					if (e && e.name && e.name == "NotSupportedError"){
						WebAudio.isNativeStreamResamplingSupported = false;
						if (options.debugLog) options.debugLog("Native stream resampling has been deactivated - Info: " + e.message);
					}
				}
				
				if (!options.destinationNode){
					options.destinationNode = mainAudioContext.createMediaStreamDestination();
				}
				
				var metaInfo = { type: "mic" };
				if (source.mediaStream && source.mediaStream.getAudioTracks){
					try {
						var track0 = source.mediaStream.getAudioTracks()[0];
						metaInfo.label = track0.label;
						if (track0.getSettings) metaInfo.settings = track0.getSettings();
					} catch(e) {};
				}
				//continue with source handler
				sourceHandler(source, {}, metaInfo);
				
			}).catch(function(err){
				if (typeof err == "string"){
					initializerError({message: err, name: "ProcessorInitError"});
				}else{
					initializerError({message: err.message, name: err.name, ref: err});	//should be err.name = "NotAllowedError", "NotFoundError"
				}
				return;
			});
			//NOTE: if the user does not answer the permission request at all this procedure will simply end here
		}
		
		//INTERFACE
		
		thisProcessor.start = function(){
			if (!isProcessing){
				startFun(function(){
					var startTime = new Date().getTime();	//TODO: is this maybe already too late?
					setStateProcessing();
					if (options.onaudiostart) options.onaudiostart({
						startTime: startTime
					});
				});
			}
		}
		
		thisProcessor.stop = function(){
			if (isProcessing){
				stopFun(function(){ 
					var endTime = new Date().getTime();		//TODO: is this maybe already too late?
					setStateProcessingStop();
					if (options.onaudioend) options.onaudioend({
						endTime: endTime
					});
				});
			}
		}
		
		thisProcessor.release = function(){
			releaseFun(function(){ 
				setStateProcessorReleased();
				if (options.onrelease) options.onrelease();
			});
		}
	}
	
	//Builders
	
	//White-noise-generator node for testing
	WebAudio.createWhiteNoiseGeneratorNode = function(noiseGain, options){
		if (!options) options = {};		//e.g. 'onMessageCallback' and 'targetSampleRate'
		var moduleFolder = (options.moduleFolder || WebAudio.defaultProcessorOptions.moduleFolder).replace(/\/$/, "") + "/";
		return new Promise(function(resolve, reject){
			(async function(){
				try {
					//Audio context and source node
					var contextOptions = {};
					if (options.targetSampleRate) contextOptions.sampleRate = options.targetSampleRate;	//NOTE: might not work on all browsers
					var audioContext = new AudioContext(contextOptions);
					await audioContext.resume();
					
					var modulePath = moduleFolder + "white-noise-generator.js";
					await audioContext.audioWorklet.addModule(modulePath);

					var thisProcessNode = new AudioWorkletNode(audioContext, "white-noise-generator", {
						//settings
						processorOptions: {
							gain: (noiseGain || 0.1)
						}
					});
					if (options.onMessageCallback){
						//just in case
						thisProcessNode.port.onmessage = options.onMessageCallback;
					}
					resolve(thisProcessNode);
					
				}catch (err){
					reject(err);
				}
			})();
		});
	};
	
	//File AudioBufferSourceNode with start/stop/release
	WebAudio.createFileSource = function(fileUrl, options){
		if (!options) options = {};		//e.g.: 'targetSampleRate'
		return new Promise(function(resolve, reject){
			(async function(){
				try {
					//AudioContext and AudioBufferSourceNode
					var contextOptions = {};
					if (options.targetSampleRate) contextOptions.sampleRate = options.targetSampleRate;	//NOTE: might not work on all browsers
					var audioContext = new AudioContext(contextOptions);		//NOTE: maybe useful: new OfflineAudioContext(1, 128, 16000);
					await audioContext.resume();
					var audioBufferSourceNode = audioContext.createBufferSource();
					
					function successCallback(arrayBuffer){
						audioContext.decodeAudioData(arrayBuffer, function(buffer){
							audioBufferSourceNode.buffer = buffer;
							//audioBufferSourceNode.connect(audioContext.destination);
							audioBufferSourceNode.loop = true;
							resolve({
								node: audioBufferSourceNode,
								start: function(){ audioBufferSourceNode.start(); },
								stop: function(){ audioBufferSourceNode.stop(); },
								release: function(){}	//TODO: ?!?
							});
						
						}, function(err){ 
							reject(err);
						});
					}
					function errorCallback(err){
						reject(err);
					}
					WebAudio.readFileAsBuffer(fileUrl, successCallback, errorCallback);
					
				}catch (err){
					reject(err);
				}
			})();
		});
	}
	
	//Encode buffer to wave
	WebAudio.encodeWaveBuffer = function(buffer, sampleRate, channels, isFloat32, successCallback, errorCallback){
		var moduleFolder = WebAudio.defaultProcessorOptions.moduleFolder.replace(/\/$/, "") + "/";
		var encoderWorker = new Worker(moduleFolder + 'wave-encoder' + '-worker.js');
		if (!successCallback) successCallback = console.log;
		if (!errorCallback) errorCallback = console.error;
		var options = {
			setup: {
				inputSampleRate: sampleRate,
				inputSampleSize: buffer.length,
				lookbackBufferMs: 0
			}
		};
		encoderWorker.onmessage = function(e){
			if (e.data.moduleState == 1){
				encoderWorker.postMessage({encode: {format: "wave", data: {
					samples: [buffer],		//MONO or interleaved in channel 1
					sampleRate: sampleRate, 
					channels: channels, 
					isFloat32: isFloat32
				}}});
			}else if (e.data.encoderResult){
				encoderWorker.terminate();
				if (e.data.error){
					errorCallback({name: "EncoderError", message: e.data.error});
				}else{
					successCallback(e.data.encoderResult);
				}
			}
		};
		encoderWorker.onerror = function(err){
			encoderWorker.terminate();
			errorCallback(err);
		}
		encoderWorker.postMessage({ctrl: {action: "construct", options: options}});
	}
	
	//WASM resampler
	WebAudio.resampleBufferWasm = function(buffer, inputSampleRate, targetSampleRate, channels, quality, successCallback, errorCallback){
		if (!successCallback) successCallback = console.log;
		if (!errorCallback) errorCallback = console.error;
		try {
			var offlineAudioContext = new OfflineAudioContext(channels, buffer.length, inputSampleRate);	//we just need this to setup the module
			var moduleFolder = WebAudio.defaultProcessorOptions.moduleFolder.replace(/\/$/, "") + "/";
			var moduleName = "resample-switch";
			offlineAudioContext.audioWorklet.addModule(moduleFolder + moduleName + ".js").then(function(){
				var options = {
					processorOptions: {
						ctxInfo: {
							sampleRate: inputSampleRate
						},
						targetSampleRate: targetSampleRate,
						resampleQuality: quality, 		//1-10
						bufferSize: buffer.length
						//passThroughMode: 1,
						//calculateRmsVolume: true
					}
				};
				var processNode = new AudioWorkletNode(offlineAudioContext, moduleName, options);
				processNode.port.onmessage = function(e){
					if (e.data.moduleState == 1){
						processNode.port.postMessage({resample: {
							samples: [buffer],
							isInt16: true
						}});
					}else if (e.data.resampleResult){
						offlineAudioContext = null;
						if (e.data.error){
							errorCallback({name: "ResampleError", message: e.data.error});
						}else{
							successCallback(e.data.resampleResult);
						}
					}
				};
				processNode.onprocessorerror = function(err){
					offlineAudioContext = null;
					errorCallback(err);
				};
			});
		}catch(err){
			errorCallback(err);
		}
	}
	
	//Commons
	
	//File reader
	WebAudio.readFileAsBuffer = function(fileUrl, successCallback, errorCallback){
		if (SepiaFW && SepiaFW.files){
			//more robust method
			SepiaFW.files.fetch(fileUrl, successCallback, errorCallback, "arraybuffer");
		}else{
			//fallback
			xmlHttpCallForArrayBuffer(fileUrl, successCallback, errorCallback);
		}
	}
	
	//fallback for: SepiaFW.files.fetch(fileUrl, successCallback, errorCallback, "arraybuffer");
	function xmlHttpCallForArrayBuffer(fileUrl, successCallback, errorCallback){
		var request = new XMLHttpRequest();
		request.open('GET', fileUrl);
		request.responseType = 'arraybuffer';
		request.timeout = 8000;
		request.onload = function(e){
			if (request.status >= 200 && request.status < 300){
				successCallback(request.response); 	//the arraybuffer is in request.response
			}else{
				errorCallback({
					status: request.status,
					message: request.statusText
				});
			}
		};
		request.onerror = function(e){
			errorCallback(e);
		};
		request.send();
	}
	
	//used to keep Promise structure, e.g.: Promise.resolve((optionalFun || noop)()).then(...)
	function noop(){};
	
	//END
	parentModule.webAudio = WebAudio;	//--> SepiaFW.webAudio
}(SepiaFW));
