var msg_box = document.getElementById('msg_box'),
    recordBtn = document.getElementById('button'),
    resetBtn = document.getElementById('reset'),
    replayBtn = document.getElementById('replay'),
    registerBtn = document.getElementById('register'),
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
var password_text = "Hello"; //這個是最後要存進資料庫的的密碼

var this_text = 'init';
var last_text = 'init';
var detect_result = '初始';
var start_time;
var end_time;


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

    //---------------------- google api 需要的變數 ------------------------
    var final_transcript = ''; // 最終的辨識訊息的變數
    var recognizing = false; // 是否辨識中
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
        //detect_result = '辨識結束';
        console.log('結束api文字辨識...');

    };

    recognition.onresult = function (event) { //有辨識結果時
        var text = event.results[0][0].transcript;

        last_text = this_text;
        final_transcript = text;
        this_text = final_transcript;

        console.log("有結果" + "last:" + last_text + " this:" + this_text);

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
        console.error(event);
        console.log("結果出error");
        detect_result = '辨識錯誤';

    }


    // recognition.lang = "zh-TW"; //語言設定中文
    recognition.lang = "en-US"; //英文
    recognition.continuous = false;
    //----------------------------------------------------------------




    recordBtn.onclick = () => {

        if (recognizing) { // 如果正在辨識，則停止。
            recognition.stop();
            start_time = new Date().getTime();
        } else { // 否則就開始辨識
            if (record_times >= 3) {
                console.log("超過三個音檔不呼叫api");
            } else {
                final_transcript = ''; // 最終的辨識訊息變數

                recognition.start(); // 開始辨識
            }
        }
        //----------------------------------------------------------------

        if ($scope.recording === true) {
            console.log("錄音结束");

            if (record_times < 3) {
                check[record_times].classList.remove('notRec');
                check[record_times].classList.add('Rec');
                console.log('record_times = ' + record_times);
                record_times++;
                msg_box.innerHTML = hint[record_times];

                if (record_times == 3) {
                    registerBtn.classList.remove('uncompleted');
                    registerBtn.classList.add('completed');
                    registerBtn.removeAttribute('disabled');
                }
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

                            setTimeout(function () {
                                while (detect_result == '等待辨識' || detect_result == '辨識錯誤' || detect_result == '辨識結果') {
                                    //console.log("狀態:" + detect_result + (end_time - start_time));

                                    if (detect_result == '等待辨識') {
                                        alert("唉呦，不小心沒錄到，麻煩再錄一次~ (●’ω`●）");
                                        $.ajax({
                                            url: "/delete/" + people_num + '/' + record_times,
                                            type: 'POST',
                                            processData: false,
                                            contentType: false,
                                            success: function (result) {
                                                console.log(result);
                                                if (result == 'delete success') { // 避免還沒加入到目錄中就被 reset 而造成 error
                                                    if (record_times == 3) {
                                                        registerBtn.classList.remove('completed');
                                                        registerBtn.classList.add('uncompleted');
                                                        registerBtn.disabled = true;
                                                    }
                                                    record_times--;

                                                    check[record_times].classList.remove('Rec');
                                                    check[record_times].classList.add('notRec');
                                                    msg_box.innerHTML = hint[record_times];
                                                } else {
                                                    alert('Reset mistake! Please try it later.');
                                                }
                                            }
                                        });
                                        this_text = last_text;
                                        detect_result = '錯誤解決';
                                    }


                                    if (detect_result == '辨識錯誤') {
                                        alert("Fail to recongnize text,please record again!");
                                        //reset 這個音檔
                                        $.ajax({
                                            url: "/delete/" + people_num + '/' + record_times,
                                            type: 'POST',
                                            processData: false,
                                            contentType: false,
                                            success: function (result) {
                                                console.log(result);
                                                if (result == 'delete success') { // 避免還沒加入到目錄中就被 reset 而造成 error
                                                    if (record_times == 3) {
                                                        registerBtn.classList.remove('completed');
                                                        registerBtn.classList.add('uncompleted');
                                                        registerBtn.disabled = true;
                                                    }
                                                    record_times--;

                                                    check[record_times].classList.remove('Rec');
                                                    check[record_times].classList.add('notRec');
                                                    msg_box.innerHTML = hint[record_times];
                                                } else {
                                                    alert('Reset mistake! Please try it later.');
                                                }
                                            }
                                        });
                                        this_text = last_text;
                                        detect_result = '錯誤已解決';

                                    } else if (detect_result == '辨識結果') {

                                        if (record_times > 1) {
                                            if (check_text(last_text, this_text) == '0') {
                                                //reset，this_text=last_text
                                                
                                                console.log("people:"+people_num+"record_times:"+record_times);
                                                setTimeout(function() { 
                                                    $.ajax({
                                                        url: "/delete/" + people_num + '/' + record_times,
                                                        type: 'POST',
                                                        processData: false,
                                                        contentType: false,
                                                        success: function (result) {
                                                            console.log(result);
    
                                                            if (result == 'delete success') { // 避免還沒加入到目錄中就被 reset 而造成 error
                                                                if (record_times == 3) {
                                                                    registerBtn.classList.remove('completed');
                                                                    registerBtn.classList.add('uncompleted');
                                                                    registerBtn.disabled = true;
                                                                }
                                                                record_times--;
    
    
                                                                check[record_times].classList.remove('Rec');
                                                                check[record_times].classList.add('notRec');
                                                                msg_box.innerHTML = hint[record_times];
                                                            } else {
                                                                alert('Reset mistake! Please try it later.');
                                                            }
                                                        }
                                                    });
                                                    
                                                }, 1000)
                                                
                                                this_text = last_text;
                                                detect_result = '已判斷';
                                                alert("欸抖，你這一次錄是不是跟上一次不一樣壓 ( ・◇・)？ 再一次!");
                                            }
                                            else
                                            {
                                                detect_result = '已判斷';
                                            }
                                        } else {
                                            if (this_text != '' || this_text != 'init') {
                                                detect_result = '已判斷';
                                            } else {
                                                
                                                setTimeout(function() { 
                                                    $.ajax({
                                                        url: "/delete/" + people_num + '/' + record_times,
                                                        type: 'POST',
                                                        processData: false,
                                                        contentType: false,
                                                        success: function (result) {
                                                            console.log(result);
    
                                                            if (result == 'delete success') { // 避免還沒加入到目錄中就被 reset 而造成 error
                                                                if (record_times == 3) {
                                                                    registerBtn.classList.remove('completed');
                                                                    registerBtn.classList.add('uncompleted');
                                                                    registerBtn.disabled = true;
                                                                }
                                                                record_times--;
    
    
                                                                check[record_times].classList.remove('Rec');
                                                                check[record_times].classList.add('notRec');
                                                                msg_box.innerHTML = hint[record_times];
                                                            } else {
                                                                alert('Reset mistake! Please try it later.');
                                                            }
                                                        }
                                                    });
                                                    
                                                }, 1000)

                                                this_text = last_text;
                                                detect_result = '已判斷';
                                                alert("Fail to recongnize text ,Please record agin!");
                                            }
                                        }


                                    }

                                }

                            }, 2000);





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

    function check_text(last_t, this_t) {
        
        if (last_t == this_t && last_t != 'init' && this_t != '') {
            console.log('check correct' + 'last:' + last_t + ' this:' + this_t);
            password_text=this_t;
            return '1';
        } else {
            console.log('check error' + 'last:' + last_t + ' this:' + this_t);
            return '0';
        }
    }


    resetBtn.onclick = () => {
        $.ajax({
            url: "/delete/" + people_num + '/' + record_times,
            type: 'POST',
            processData: false,
            contentType: false,
            success: function (result) {
                console.log(result);

                if (result == 'delete success') { // 避免還沒加入到目錄中就被 reset 而造成 error
                    if (record_times == 3) {
                        registerBtn.classList.remove('completed');
                        registerBtn.classList.add('uncompleted');
                        registerBtn.disabled = true;
                    }
                    record_times--;

                    this_text = last_text;

                    check[record_times].classList.remove('Rec');
                    check[record_times].classList.add('notRec');
                    msg_box.innerHTML = hint[record_times];
                } else {
                    alert('Reset mistake! Please try it later.');
                }
            }
        });
    }

    replayBtn.onclick = () => {
        if (record_times > 0) {
            const audio = document.createElement("audio");
            audio.src = "speech_file/recording/flac/" + people_num + '/train' + record_times + '.flac';
            console.log('record_times = ' + record_times);
            audio.play().catch(function () {
                alert('等我一下下! 一下下就好 ٩(●˙▿˙●)۶…⋆ฺ');
            });
        } else {
            alert('No data. Please record first!');
        }
    }


    registerBtn.onclick = () => {
        var acc_num=$('#account').val();
        console.log("acc_num="+acc_num);
        if (record_times >= 3) {
            $.ajax({
                url: "/register/" + people_num + '/' + password_text+'/'+acc_num,
                type: 'POST',
                processData: false,
                contentType: false,
                success: function (result) {
                    console.log(result);

                    if (result == 'register success') {
                        alert('Register Success! Redirect to login page in few sec');
                        setTimeout("location.href='http://127.0.0.1:5000'", 0); // 跳轉回登入頁面
                    } else {
                        alert('Register Error! Please submit again later!');
                    }
                }
            });
        } else {
            alert('Please record enough data first!');
        }


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
}]);