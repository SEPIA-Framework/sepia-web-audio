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

function addWaveToPage(wavAudio, targetEle){
	var audioEle = document.createElement("audio");
	audioEle.src = window.URL.createObjectURL((wavAudio.constructor.name == "Blob")? wavAudio : (new Blob([wavAudio], { type: "audio/wav" })));
	audioEle.setAttribute("controls", "controls");
	var audioBox = document.createElement("div");
	audioBox.appendChild(audioEle);
	if (!targetEle) targetEle = document.getElementById("mainView") || document.body;
	targetEle.appendChild(audioBox);
}

uPlot.lazy.colorPalette[0] = "#ceff1a";		//default color for first line in graph
var fixedPlots = {
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
function usePlot(index, ele){
	var p = fixedPlots[index];
	if (p){
		p.use = ele.checked;
		var container = document.getElementById("chart" + index);
		if (container) container.style.display = p.use? "" : "none";
	}
}
function useHeatmap(index, ele){
	useHeatmaps[index] = ele.checked;
	if (heatmaps[index]) heatmaps[index].resetMax();
}
var useHeatmaps = {};
var heatmaps = {};

function addChartContainerToPage(){
	var ele = document.createElement("div");
	ele.className = "chart";
	(document.getElementById("mainView") || document.body).appendChild(ele);
	return ele;
}
function plotData(data, plotIndex, expandData){
	var p = fixedPlots[plotIndex];
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
		var ele = addChartContainerToPage();
		var x = uPlot.lazy.createSequence(0, data.length);
		uPlot.lazy.plot({
			targetElement: ele,
			showPoints: false,
			strokeWidth: 1,
			data: [x, data]
		});
	}
}