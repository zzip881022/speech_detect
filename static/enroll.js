var msg_box = document.getElementById('msg_box'),
    recordBtn = document.getElementById('button'),
    resetBtn = document.getElementById('reset'),
    check = document.getElementsByClassName('circle'),
    hint = [
        '',
        'The second time',
        'The last time',
        'Finished setting'
    ],
    lang = {
        'recording': 'Recording...',
        'mic_error': 'Error accessing the microphone',
        'press_to_start': 'Press to set password',
        'play': 'Play',
        'stop': 'Stop',
        'download': 'Download',
        'use_https': 'This application in not working over insecure connection. Try to use HTTPS'
    };

var recorderApp = angular.module('recorder', []);
var record_times = 0; // 紀錄錄音到第幾次(共三次)
var people_num = 0; // 紀錄第幾個人
$.ajax({
    url: "/count_people_num",
    type: 'POST',
    processData: false,
    contentType: false,
    success: function (result) {
        console.log('共' + result + '人');
        people_num = result;
    }
});

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
    $scope.wav_format = true;
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

    recordBtn.onclick = () => {
        if ($scope.recording === true) {
            console.log("錄音结束");
            if (record_times < 3) {
                check[record_times].classList.remove('notRec');
                check[record_times].classList.add('Rec');
                record_times++;
                msg_box.innerHTML = hint[record_times];
            }

            recordBtn.classList.remove('recording');

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
            if (record_times >= 3) {
                alert('已完成註冊!');
            } else {
                console.log("錄音中...");
                button.classList.add('recording');
                msg_box.innerHTML = lang.recording;

                if ($scope.recording)
                    return;

                console.log('start recording'); //DEBUG

                $scope.encoder = new Worker('encoder.js?dwdw');

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
        }
    };

    resetBtn.onclick = () => {
        $.ajax({
            url: "/delete/" + people_num + '/' + record_times,
            type: 'POST',
            processData: false,
            contentType: false,
            success: function (result) {
                console.log(result);

                if (result == 'delete success') { // 避免還沒加入到目錄中就被 reset 而造成 error
                    record_times--;
                    check[record_times].classList.remove('Rec');
                    check[record_times].classList.add('notRec');
                    msg_box.innerHTML = hint[record_times];
                } else {
                    alert('Reset mistake! Please try it later.');
                }
            }
        });
    }

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
        link.download = 'train' + record_times + '.flac';
        //NOTE: FireFox requires a MouseEvent (in Chrome a simple Event would do the trick)
        var click = document.createEvent("MouseEvent");
        click.initMouseEvent("click", true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
        link.dispatchEvent(click);

        // 將錄音移到指定目錄下
        var formData = new FormData();
        formData.append('audio_file', 'train' + record_times + '.flac');
        $.ajax({
            url: "/moveto/" + people_num + '/' + record_times,
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function (result) {
                console.log(result);
            }
        });
    };

    $scope.num = 0;

    $scope.sendASRRequest = function (blob) {

        function ajaxSuccess() {

            var result = this.responseText;
            console.log("AJAXSubmit - Success!"); //DEBUG
            console.log(result);

            try {
                result = JSON.parse(result);
                //format the result
                result = JSON.stringify(result, null, 2);
            } catch (exc) {
                console.warn('Could not parse result into JSON object: "' + result + '"');
            }

            $scope.$apply(function () {
                $scope.asr_result.text = result;
            });
        }

        var data;
        var sample_rate = $scope.samplerate;
        var language = $scope.language;
        var key = $scope._google_api_key;
        var alternatives = $scope._asr_alternatives;


        // use FileReader to convert Blob to base64 encoded data-URL
        var reader = new window.FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = function () {
            //only use base64-encoded data, i.e. remove meta-data from beginning:
            var audioData = reader.result.replace(/^data:audio\/flac;base64,/, '');
            data = {
                config: {
                    encoding: "FLAC",
                    sampleRateHertz: sample_rate,
                    languageCode: language,
                    maxAlternatives: alternatives
                },
                audio: {
                    content: audioData
                }
            };

            var oAjaxReq = new XMLHttpRequest();

            oAjaxReq.onload = ajaxSuccess;

            //NOTE: instead of API, it is recommended to use service API authentification, 
            //      then create an access_token (on your server, retrieve it with the client)
            //		and set the token as access_token param
            //			?access_token=<access_token>
            //
            //      or set it in the header as
            //          Authorization: Bearer <access_token>
            //
            //      (see example code below)

            if (!$scope.auth) {
                $scope.auth = 'serviceKey';
            } else if ($scope.auth !== 'apiKey') {
                console.error('unknown authentification method: ', $scope.auth);
            }

            var params = $scope.auth === 'apiKey' ? '?key=' + key : ($scope.auth === 'serviceKey' ? '?access_token=' + key : '');
            //DISABLED: currently Google Cloud Speech does not support authorization (headers) in combination with CORS
            //		    if($scope.auth === 'serviceKey'){
            //			    oAjaxReq.setRequestHeader("Authorization", "Bearer "+key);
            //			    oAjaxReq.withCredentials = true;
            //		    }
            oAjaxReq.open("post", "http://127.0.0.1:5000/predict" + params, true);



            oAjaxReq.setRequestHeader("Content-Type", "application/json");
            oAjaxReq.send(JSON.stringify(data));
        };

        $scope.$apply(function () {
            $scope.asr_result.text = "Waiting for Recognition Result...";
        });

    };

}]);