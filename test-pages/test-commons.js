//NOTE: load this after DOM or with ready-state check

function debugInfo(source, data){
	console.log(source, data);
}

function showLogMessage(msg, data){
	var info = (typeof data == "object")? (data.name && data.message? (data.name + " - " + data.message) : JSON.stringify(data)) : data;
	logElement.textContent += "\n" + (new Date().toLocaleTimeString()) + " - " + (msg + " - " + info);
	logElement.scrollTo(0, logElement.scrollHeight);
}

function vibrate(pattern){
	if (typeof window.navigator.vibrate == "function"){
		window.navigator.vibrate(pattern);
	}
}

function addWaveToPage(wavAudio){
	var targetElement = document.getElementById("mainView") || document.body;
	var audioType = "audio/wav";
	SepiaFW.webAudio.addAudioElementToPage(targetElement, wavAudio, audioType);
}

var fixedPlots = {};
if (window.uPlot && uPlot.lazy){
	uPlot.lazy.colorPalette[0] = "#ceff1a";		//default color for first line in graph
	fixedPlots = {
		1: {
			graph: (new uPlot.lazy.AutoSeries(document.getElementById('chart1'), 150, {
				rememberMax: true
			})), 
			use: (document.getElementById("usePlot1")? document.getElementById("usePlot1").checked : true)
		},
		2: {
			graph: (new uPlot.lazy.AutoSeries(document.getElementById('chart2'), 150, {
				rememberMax: true
			}, {
				showAxisX: false
			})),
			use: (document.getElementById("usePlot2")? document.getElementById("usePlot2").checked : true)
		},
		3: {
			graph: (new uPlot.lazy.AutoSeries(document.getElementById('chart3'), 150, {
				//rememberMax: true
			}, {
				showAxisX: false
				//yRange: [-0.1, 1.1]
			})),
			use: (document.getElementById("usePlot3")? document.getElementById("usePlot3").checked : true)
		},
		4: {
			graph: (new uPlot.lazy.AutoSeries(document.getElementById('chart4'), 150, {
				rememberMax: true
			}, {
				fill: ["#ceff1a1a"]
			})), 
			use: (document.getElementById("usePlot4")? document.getElementById("usePlot4").checked : true)
		},
	}
}
function usePlot(index, ele){
	if (!ele) return;
	var p = fixedPlots[index];
	if (p){
		p.use = ele.checked;
		var container = document.getElementById("chart" + index);
		if (container) container.style.display = p.use? "" : "none";
	}
}
function useHeatmap(index, ele){
	if (!ele) return;
	useHeatmaps[index] = ele.checked;
	if (heatmaps[index]) heatmaps[index].resetMax();
	if (ele.checked){
	}
	var container = document.getElementById("heatmap" + index);
	if (container) container.style.display = ele.checked? "" : "none";
}
var useHeatmaps = {};
var heatmaps = {};
if (window.uPlot && uPlot.lazy && uPlot.lazy.Heatmap){
	if (document.getElementById('heatmap1')){
		heatmaps = {
			1: new uPlot.lazy.Heatmap(document.getElementById('heatmap1'), {
				dataPixelWidth: 4,
				dataPixelHeight: 4,
				colorIndex: 4,
				maxDataPoints: 150
			})
		};
	}
}
usePlot(1, document.getElementById('usePlot1'));
usePlot(2, document.getElementById('usePlot2'));
usePlot(3, document.getElementById('usePlot3'));
usePlot(4, document.getElementById('usePlot4'));
useHeatmap(1, document.getElementById('useHeatmap1'));

function addTitleToPage(titleText){
	var ele = document.createElement("p");
	ele.textContent = titleText;
	(document.getElementById("mainView") || document.body).appendChild(ele);
	return ele;
}
function addChartContainerToPage(myParentEle){
	var ele = document.createElement("div");
	ele.className = "chart";
	(myParentEle ||document.getElementById("mainView") || document.body).appendChild(ele);
	return ele;
}
function plotData(data, plotIndexOrParent, expandData){
	var plotParentEle = undefined;
	var plotIndex = undefined;
	if (typeof plotIndexOrParent == "number"){
		plotIndex = plotIndexOrParent;
	}else if (plotIndexOrParent){
		plotParentEle = plotIndexOrParent;
	}
	var p = (plotIndex != undefined)? fixedPlots[plotIndex] : undefined;
	if (p){
		if (p.use){
			if (expandData){
				p.graph.addValues(...data);
			}else{
				p.graph.addValues(data);
			}
			p.graph.draw();
		}
	}else{
		plotToParent(data, plotParentEle, undefined, expandData);
	}
}
function plotToParent(data, parentEle, config, expandData){
	var ele = addChartContainerToPage(parentEle);
	var conf = config || {
		showPoints: false,
		strokeWidth: 1
	}
	conf.targetElement = ele;
	if (expandData){
		var x = uPlot.lazy.createSequence(0, data[0].length);
		conf.data = [x, ...data];
	}else{
		var x = uPlot.lazy.createSequence(0, data.length);
		conf.data = [x, data];
	}
	return uPlot.lazy.plot(conf);
}
function drawHeatmap(data, hmIndex, maxPoints){
	var heatmap = (hmIndex != undefined)? heatmaps[hmIndex] : undefined;
	if (!heatmap){
		var ele = addChartContainerToPage();
		let colorIndex = 4;
		heatmap = new uPlot.lazy.Heatmap(ele, {
			dataPixelWidth: 4,
			dataPixelHeight: 4,
			colorIndex: colorIndex,
			maxDataPoints: maxPoints || 150
		});
		if (hmIndex != undefined) heatmaps[hmIndex] = heatmap;
	}
	data.forEach(function(d, i){
		heatmap.addDataArray(d);
	});
	heatmap.draw();
}
function createArrayWithStartValue(n, startValue){
	if (startValue == undefined) startValue = 0;
	var array = new Array(n);
	for (let i=0; i<n; i++){
		array[i] = startValue;
	}
	return array;
}

function createModal(content, width, maxWidth){
	var layer = document.createElement("div");
	layer.className = "modal-layer";
	var modal = document.createElement("div");
	modal.className = "modal-box";
	if (width) modal.style.width = width;
	if (maxWidth) modal.style.maxWidth = maxWidth;
	if (typeof content == "string"){
		modal.innerHTML = content;
	}else{
		modal.appendChild(content);
	}
	document.body.appendChild(layer);
	layer.appendChild(modal);
	modal.closeModal = function(){
		layer.parentNode.removeChild(layer);
	}
	layer.addEventListener("click", function(e){
		if (e.target == layer){
			modal.closeModal();
		}
	});
	return modal;
}