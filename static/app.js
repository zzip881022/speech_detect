var recorderApp = angular.module('recorder', []);
var modal = document.getElementsByClassName("modal")[0];
var modal_status = document.querySelector("#modal_status");
var modal_icon = document.querySelector("#modal_icon");
const recordBtn = document.querySelector("#record-btn");
const icon_not_rec = document.querySelector("#icon_not_rec");
const icon_rec = document.querySelector("#icon_rec");
const failed_reason = document.querySelector("#failed_reason");

recordBtn.classList.add("notRec");

recorderApp.controller('RecorderController', ['$scope', function ($scope) {
	$scope.audio_context = null;
	$scope.stream = null;
	$scope.recording = false;
	$scope.encoder = null;
	$scope.ws = null;
	$scope.input = null;
	$scope.node = null;
	$scope.samplerate = 44100;
	$scope.autoSelectSamplerate = true;
	$scope.samplerates = [8000, 11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000];
	$scope.compression = 5;
	$scope.compressions = [0, 1, 2, 3, 4, 5, 6, 7, 8];
	// $scope.bitrate = 16;
	// $scope.bitrates = [ 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 192, 224, 256, 320 ];
	$scope.recordButtonStyle = "red-btn";
	$scope.flacdata = {};
	$scope.flacdata.bps = 16;
	$scope.flacdata.channels = 1;
	$scope.flacdata.compression = 5;
	$scope.wav_format = false;
	$scope.outfilename_flac = "output.flac";
	$scope.outfilename_wav = "output.wav";

	//ASR-related settings (using Google Cloud Speech service)

	$scope.languages = ['af-ZA', 'am-ET', 'hy-AM', 'az-AZ', 'id-ID', 'ms-MY', 'bn-BD', 'bn-IN', 'ca-ES', 'cs-CZ', 'da-DK', 'de-DE', 'en-AU', 'en-CA', 'en-GH', 'en-GB', 'en-IN', 'en-IE', 'en-KE', 'en-NZ', 'en-NG', 'en-PH', 'en-ZA', 'en-TZ', 'en-US', 'es-AR', 'es-BO', 'es-CL', 'es-CO', 'es-CR', 'es-EC', 'es-SV', 'es-ES', 'es-US', 'es-GT', 'es-HN', 'es-MX', 'es-NI', 'es-PA', 'es-PY', 'es-PE', 'es-PR', 'es-DO', 'es-UY', 'es-VE', 'eu-ES', 'fil-PH', 'fr-CA', 'fr-FR', 'gl-ES', 'ka-GE', 'gu-IN', 'hr-HR', 'zu-ZA', 'is-IS', 'it-IT', 'jv-ID', 'kn-IN', 'km-KH', 'lo-LA', 'lv-LV', 'lt-LT', 'hu-HU', 'ml-IN', 'mr-IN', 'nl-NL', 'ne-NP', 'nb-NO', 'pl-PL', 'pt-BR', 'pt-PT', 'ro-RO', 'si-LK', 'sk-SK', 'sl-SI', 'su-ID', 'sw-TZ', 'sw-KE', 'fi-FI', 'sv-SE', 'ta-IN', 'ta-SG', 'ta-LK', 'ta-MY', 'te-IN', 'vi-VN', 'tr-TR', 'ur-PK', 'ur-IN', 'el-GR', 'bg-BG', 'ru-RU', 'sr-RS', 'uk-UA', 'he-IL', 'ar-IL', 'ar-JO', 'ar-AE', 'ar-BH', 'ar-DZ', 'ar-SA', 'ar-IQ', 'ar-KW', 'ar-MA', 'ar-TN', 'ar-OM', 'ar-PS', 'ar-QA', 'ar-LB', 'ar-EG', 'fa-IR', 'hi-IN', 'th-TH', 'ko-KR', 'cmn-Hant-TW', 'yue-Hant-HK', 'ja-JP', 'cmn-Hans-HK', 'cmn-Hans-CN'];

	var __language = /\blanguage=([^&]*)/.exec(document.location.search); //<- for testing: set pre-selected language code via search-param in URL: ...?language=<language code>
	$scope.language = __language ? __language[1] : 'en-US';

	$scope.result_mode = "file"; //values: "asr" | "file" | TODO: "asr&file"
	$scope.asr_result = {
		text: ""
	};
	$scope._asr_alternatives = 20;


	//your API key from Google Console for Google Cloud Speech service (secret!!!)
	//  for more details on how to obtain an API key see e.g. 
	// WARNING: for security reasons, it's recommended to use service API auth instead of an app key
	//          ... in any case: only use this for test, NEVER publish your secret key!

	var __key = /\bkey=([^&]*)/.exec(document.location.search); //<- for testing: set app key via search-param in URL: ...?key=<API key>
	$scope._google_api_key = __key ? __key[1] : 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

	var __authMethod = /\bauth=([^&]*)/.exec(document.location.search); //<- for testing: set auth-method via search-param in URL: ...?auth=<authentification method>
	$scope.auth = __authMethod ? __authMethod[1] : null; //values: "apiKey" | "serviceKey" (DEFAULT: "apiKey")

	//do not changes these: this "detects" if a key for the Google Speech API is set or not
	// (and updates page accordingly, i.e. enable/disable check-box for sending audio to ASR service):
	var __def_key = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
	$scope.isNotASRCapable = $scope._google_api_key === __def_key;

	$scope.recordaswave = function (isUseWavFormat) {
		$scope.wav_format = isUseWavFormat;
	};

	$scope.setResultMode = function (isEnableASR) {

		$scope.result_mode = isEnableASR ? 'asr' : 'file';

	};



	//---------------------- google api 需要的變數 ------------------------
	var final_transcript = ''; // 最終的辨識訊息的變數
	var recognizing = false; // 是否辨識中
	var detect_result = '初始';

	//-------------- speech-to-text function setting -----------------
	var recognition = new webkitSpeechRecognition();

	//--------------------------------------------------------------------

	recognition.onstart = function () { // 設定開始辨識時會執行的code
		recognizing = true; // 狀態設定為辨識中
		console.log('開始api文字辨識...');
		detect_result = '等待辨識';

	};

	recognition.onend = function () { // 設定辨識完成時執行的code
		recognizing = false; // 狀態設定為「非辨識中」
		console.log('結束api文字辨識...');

	};

	recognition.onresult = function (event) { //有辨識結果時
		var text = event.results[0][0].transcript;
		final_transcript = text;


		console.log("有結果 " + final_transcript);

		detect_result = '辨識結果';

	}

	recognition.onerror = function (event) {
		console.error(event);
		console.log("結果出error");
		detect_result = '辨識錯誤';
		recognition.stop()

		recognizing = false;

	}

	recognition.onnomatch = () => function (event) {
		console.log("結果出error");
		detect_result = '辨識錯誤';

	}


	// recognition.lang = "zh-TW"; //語言設定中文
	recognition.lang = "en-US"; //英文
	recognition.continuous = false;
	//----------------------------------------------------------------

	recordBtn.onclick = () => {

		//----------------------------------------------------------------

		if ($scope.recording === true) {

			// show the modal
			modal.style.visibility = "visible";
			modal.style.opacity = "1";
			modal_status.innerHTML = "Identifying...";

			// show backdrop effect
			var backdrop = document.getElementsByClassName("backdrop")[0];
			backdrop.style.opacity = "1";
			backdrop.style.visibility = "visible";

			recordBtn.classList.remove("Rec");
			recordBtn.classList.add("notRec");
			console.log("錄音结束");
			icon_not_rec.style.display = "inline-block";
			icon_rec.style.display = "none";

			if (!$scope.recording) {
				return;
			}
			$scope.recordButtonStyle = "red-btn";
			console.log('stop recording');
			var tracks = $scope.stream.getAudioTracks()
			for (var i = tracks.length - 1; i >= 0; --i) {
				tracks[i].stop();
			}
			$scope.recording = false;
			$scope.encoder.postMessage({
				cmd: 'finish'
			});

			$scope.input.disconnect();
			$scope.node.disconnect();
			$scope.input = $scope.node = null;
		} else {
			// 開始辨識密碼
			final_transcript = ''; // 最終的辨識訊息變數
			recognition.start(); // 開始辨識

			// // 開始錄之前先檢查有沒有 output.flac、transfer.flac，有的話就刪除
			// $.ajax({
			// 	url: "/check_before_record",
			// 	type: 'POST',
			// 	processData: false,
			// 	contentType: false,
			// 	success: function (result) {
			// 		console.log(result);
			// 	}
			// });

			console.log("錄音中...");
			recordBtn.classList.remove("notRec");
			recordBtn.classList.add("Rec");
			icon_not_rec.style.display = "none";
			icon_rec.style.display = "inline-block";

			if ($scope.recording)
				return;

			console.log('start recording'); //DEBUG

			$scope.encoder = new Worker('static/encoder.js?dwdwffrf');

			if ($scope.wav_format == true) {
				$scope.encoder.postMessage({
					cmd: 'save_as_wavfile'
				});
			}

			$scope.encoder.onmessage = function (e) {

				if (e.data.cmd == 'end') {

					var resultMode = $scope.result_mode;

					if (resultMode === 'file') {

						var fname = $scope.wav_format ? $scope.outfilename_wav : $scope.outfilename_flac;
						$scope.forceDownload(e.data.buf, fname);
						console.log('here');

					} else if (resultMode === 'asr') {

						if ($scope.wav_format) {
							//can only use FLAC format (not WAVE)!
							alert('Can only use FLAC format for speech recognition!');
						} else {
							$scope.sendASRRequest(e.data.buf);
						}

					} else {

						console.error('Unknown mode for processing STOP RECORDING event: "' + resultMode + '"!');
					}


					$scope.encoder.terminate();
					$scope.encoder = null;

				} else if (e.data.cmd == 'debug') {

					console.log(e.data);

				} else if (e.data.cmd === 'not-init') {

					// show the modal
					modal.style.visibility = "hidden";
					modal.style.opacity = "0";

					// show backdrop effect
					var backdrop = document.getElementsByClassName("backdrop")[0];
					backdrop.style.opacity = "0";
					backdrop.style.visibility = "hidden";

					alert('Error! Try it again');

				} else {

					console.error('Unknown event from encoder (WebWorker): "' + e.data.cmd + '"!');
				}
			};

			if (navigator.webkitGetUserMedia)
				navigator.webkitGetUserMedia({
					video: false,
					audio: true
				}, $scope.gotUserMedia, $scope.userMediaFailed);
			else if (navigator.mozGetUserMedia)
				navigator.mozGetUserMedia({
					video: false,
					audio: true
				}, $scope.gotUserMedia, $scope.userMediaFailed);
			else
				navigator.getUserMedia({
					video: false,
					audio: true
				}, $scope.gotUserMedia, $scope.userMediaFailed);

		}
	};


	$scope.userMediaFailed = function (code) {
		console.log('grabbing microphone failed: ' + code);
	};


	$scope.gotUserMedia = function (localMediaStream) {
		$scope.recording = true;
		$scope.recordButtonStyle = '';

		console.log('success grabbing microphone');
		$scope.stream = localMediaStream;

		var audio_context;
		if (typeof webkitAudioContext !== 'undefined') {
			audio_context = new webkitAudioContext;
		} else if (typeof AudioContext !== 'undefined') {
			audio_context = new AudioContext;
		} else {
			console.error('JavaScript execution environment (Browser) does not support AudioContext interface.');
			alert('Could not start recording audio:\n Web Audio is not supported by your browser!');

			return;
		}
		$scope.audio_context = audio_context;
		$scope.input = audio_context.createMediaStreamSource($scope.stream);

		if ($scope.input.context.createJavaScriptNode)
			$scope.node = $scope.input.context.createJavaScriptNode(4096, 1, 1);
		else if ($scope.input.context.createScriptProcessor)
			$scope.node = $scope.input.context.createScriptProcessor(4096, 1, 1);
		else
			console.error('Could not create audio node for JavaScript based Audio Processing.');


		var sampleRate = $scope.audio_context.sampleRate;
		console.log('audioContext.sampleRate: ' + sampleRate); //DEBUG
		if ($scope.autoSelectSamplerate) {
			$scope.samplerate = sampleRate;
		}

		console.log('initializing encoder with:'); //DEBUG
		console.log(' bits-per-sample = ' + $scope.flacdata.bps); //DEBUG
		console.log(' channels        = ' + $scope.flacdata.channels); //DEBUG
		console.log(' sample rate     = ' + $scope.samplerate); //DEBUG
		console.log(' compression     = ' + $scope.compression); //DEBUG
		$scope.encoder.postMessage({
			cmd: 'init',
			config: {
				samplerate: $scope.samplerate,
				bps: $scope.flacdata.bps,
				channels: $scope.flacdata.channels,
				compression: $scope.compression
			}
		});

		$scope.node.onaudioprocess = function (e) {
			if (!$scope.recording)
				return;
			// see also: http://typedarray.org/from-microphone-to-wav-with-getusermedia-and-web-audio/
			var channelLeft = e.inputBuffer.getChannelData(0);
			// var channelRight = e.inputBuffer.getChannelData(1);
			$scope.encoder.postMessage({
				cmd: 'encode',
				buf: channelLeft
			});
		};

		$scope.input.connect($scope.node);
		$scope.node.connect(audio_context.destination);

		$scope.$apply();
	};


	//create A-element for data BLOB and trigger download
	$scope.forceDownload = function (blob, filename) {
		var url = (window.URL || window.webkitURL).createObjectURL(blob);
		var link = window.document.createElement('a');
		link.href = url;
		link.download = filename || 'output.flac';
		//NOTE: FireFox requires a MouseEvent (in Chrome a simple Event would do the trick)
		var click = document.createEvent("MouseEvent");
		click.initMouseEvent("click", true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
		link.dispatchEvent(click);

		// test
		var formData = new FormData();
		formData.append('verify_model', 'transfer_cnn_noEMD_1120.pt');
		// formData.append('audio_file', blob);
		formData.append('audio_file', 'output.flac');

		check_session = 0;


		// $.ajax({
		// 	url: "/predict",
		// 	type: 'POST',
		// 	data: formData,
		// 	processData: false,
		// 	contentType: false,
		// 	success: function (result) {
		// 		console.log(result);
		// 		var resultArray = new Array(); //用來接收真假語音判斷和密碼的結果
		// 		resultArray = result.split("/"); //resultArray[0]是真假音判斷，resultArray[1]是密碼文字，resultArray[2]是語者編號
		// 		if (resultArray[0] == '1' && resultArray[1].toUpperCase() == final_transcript.toUpperCase()) {
		// 			// show the success modal
		// 			modal.classList.remove("verifying");
		// 			modal.classList.add("verify_success");
		// 			modal_icon.classList.remove("fa-spinner", "fa-spin");
		// 			modal_icon.classList.add("fa-check-circle");
		// 			modal_icon.style.color = 'white';
		// 			modal_status.innerHTML = "Success";
		// 			modal_status.style.color = 'white';


		// 			//------ 設定session保存語者編號 ------------
		// 			$.ajax({
		// 				url: "/login/" + resultArray[2],
		// 				type: 'POST',
		// 				processData: false,
		// 				contentType: false,
		// 				success: function (result) {

		// 					console.log("login success");
		// 					setTimeout("location.href='http://127.0.0.1:5000/chat'", 2000); // 2秒後跳轉頁面

		// 				}

		// 			});
		// 			//------------------------------------------



		// 		} else if (resultArray[0] == '0' || resultArray[1].toUpperCase() != final_transcript.toUpperCase()) {
		// 			// show the failed modal
		// 			modal.classList.remove("verifying");
		// 			modal.classList.add("verify_failed");
		// 			modal_icon.classList.remove("fa-spinner", "fa-spin");
		// 			modal_icon.classList.add("fa-times");
		// 			modal_icon.style.color = 'white';
		// 			modal_status.innerHTML = "Failed";
		// 			modal_status.style.color = 'white';
		// 			failed_reason.style.visibility = 'visible';   
					
		// 			let reason = '';
		// 			if (resultArray[0] == '0') {
		// 				reason = reason.concat(' 側錄');
		// 				console.log('reason: ' + reason);
		// 			}
		// 			if (resultArray[1].toUpperCase() != final_transcript.toUpperCase()) {
		// 				reason = reason.concat(' 密碼');
		// 				console.log('reason: ' + reason);
		// 			}
		// 			reason = reason.concat('驗證錯誤');
		// 			console.log('reason: ' + reason);
		// 			failed_reason.innerHTML = reason;

		// 			setTimeout("location.href='http://127.0.0.1:5000'", 2000); // 2秒後跳轉頁面
		// 		}
		// 	}
		// });
	};
}]);