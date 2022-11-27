var recorderApp = angular.module('recorder', []);
var load_wrapp_microfone = document.getElementsByClassName("load-wrapp-3")[0];
var load_wrapp_identify = document.getElementsByClassName("load-wrapp-9")[0];
var account_total_money = document.getElementsByClassName("account_total_money")[0];
var account_available_balance = document.getElementsByClassName("account_available_balance")[0];
var agreed_wire_transfer = document.getElementsByClassName("agreed_wire_transfer")[0];
var regular_wire_transfer = document.getElementsByClassName("regular_wire_transfer")[0];
var account_transaction_record = document.getElementsByClassName("account_transaction_record")[0];
var share_account_imformation = document.getElementsByClassName("share_account_imformation")[0];

var tag = document.querySelector(".tag");
var startRecord = false;
var functions = ['帳戶餘額', '可用餘額', '約定轉帳', '非約定轉帳', '交易紀錄', '分享帳號'];
var command = ''; // 用來存使用者想要的 function
var password = ''; // 用來存使用者講出的密碼
var session_id = 'x'; //從session拿到登入時的id
//儲存帳戶資訊的變數
var acc_balance = 0;
var acc_total = 0;
var acc_name =

  $.ajax({
    url: "/getID",
    type: 'POST',
    processData: false,
    contentType: false,
    success: function (result) {
      session_id = result;
      console.log("session_id ajax:" + session_id)
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


  //Listen user voice
  $('#fab_listen').click(function () {

    var recognition = new webkitSpeechRecognition();

    loadBeat(true);
    recognition.onstart = function () {
      //開始辨識時
      console.log('開始辨識...');
    };
    recognition.onend = function () {
      //停止辨識時
      console.log('停止辨識!');

    };

    recognition.onresult = function (event) {
      var text = event.results[0][0].transcript;
      $('#chatSend').val(text);
    }
    recognition.onerror = function (event) {
      console.error(event);
      recognition.stop()

      loadBeat(false);

    }

    recognition.onsoundend = function () {
      recognition.stop()
      loadBeat(false);
    }

    // recognition.continuous = true;
    recognition.lang = "zh-TW";
    recognition.interimResults = true;
    recognition.start();

  });

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


    $.ajax({
      url: "/predict",
      type: 'POST',
      data: formData,
      processData: false,
      contentType: false,
      success: function (result) {
        console.log(result);
        // close load wrapp
        load_wrapp_identify.style.opacity = "0";
        load_wrapp_identify.style.visibility = "hidden";

        // close backdrop effect
        var backdrop = document.getElementsByClassName("backdrop")[0];
        backdrop.style.opacity = "0";
        backdrop.style.visibility = "hidden";

        var resultArray = new Array(); //用來接收真假語音判斷和密碼的結果
        resultArray = result.split("/"); //resultArray[0]是真假音判斷，resultArray[1]是密碼文字，resultArray[2]是語者辨識




        console.log('session_id:' + session_id + " resultArray[2]: " + resultArray[2] + " 真假音判斷:" + resultArray[0] + " password now:" + password);

        if (resultArray[0] == '1' && resultArray[1].toUpperCase() == password.toUpperCase() && session_id == resultArray[2]) {
          tag.classList.remove("rejected");
          tag.classList.add("approved");
          tag.innerHTML = 'Authorized   <i class="fa fa-unlock-alt" aria-hidden="true"></i>';
          adminSend(command);


        } else if (resultArray[0] == '0' || resultArray[1].toUpperCase() != password.toUpperCase() || session_id != resultArray[2]) {
          tag.classList.remove("approved");
          tag.classList.add("rejected");
          tag.innerHTML = 'Unauthorized <i class="fa fa-lock" aria-hidden="true"></i>';
          adminSend('權限不足');
        }
      }
    });
  };


  function recording() {
    //=====錄語音傳去側錄模型辨識結果========

    if (startRecord == false) {
      // 開始錄之前先檢查有沒有 output.flac、transfer.flac，有的話就刪除
      $.ajax({
        url: "/check_before_record",
        type: 'POST',
        processData: false,
        contentType: false,
        success: function (result) {
          console.log(result);
        }
      });

      // 開始錄音
      console.log("錄音中...");
      startRecord = true;
      console.log("startRecord: ", startRecord);

      $scope.encoder = new Worker('static/encoder.js?dwdw');

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

          // close load wrapp
          load_wrapp_identify.style.opacity = "0";
          load_wrapp_identify.style.visibility = "hidden";

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


      //==========密碼辨識===============================================================================

      var recognition = new webkitSpeechRecognition();

      loadBeat(true);
      recognition.onstart = function () {
        //開始辨識時
        console.log('開始辨識...1111');
      };
      recognition.onend = function () {
        //停止辨識時
        console.log('停止辨識!0000');

      };

      recognition.onresult = function (event) {
        var text = event.results[0][0].transcript;
        password = text;
        console.log('密碼: ', text);
      }
      recognition.onerror = function (event) {
        console.error(event);
        recognition.stop()

        loadBeat(false);

        // close load wrapp
        load_wrapp_microfone.style.opacity = "0";
        load_wrapp_microfone.style.visibility = "hidden";

        // close backdrop effect
        var backdrop = document.getElementsByClassName("backdrop")[0];
        backdrop.style.opacity = "0";
        backdrop.style.visibility = "hidden";

        alert('錯誤! 請再試一次')

      }

      recognition.onsoundend = function () {
        recognition.stop()
        loadBeat(false);

        // change load wrapp
        load_wrapp_microfone.style.opacity = "0";
        load_wrapp_microfone.style.visibility = "hidden";
        load_wrapp_identify.style.opacity = "1";
        load_wrapp_identify.style.visibility = "visible";

        recording();
      }

      // recognition.continuous = true;
      recognition.lang = "en-US";
      recognition.interimResults = true;
      recognition.start();

      //=========================================================================================

    } else {
      // 停止錄音
      console.log("停止錄音");
      startRecord = false;
      console.log("startRecord: ", startRecord);


      tag.classList.remove("rejected");
      tag.classList.remove("approved");
      tag.classList.add("uninitialiezed");
      tag.innerHTML = 'Checking...';

      var tracks = $scope.stream.getAudioTracks()
      for (var i = tracks.length - 1; i >= 0; --i) {
        tracks[i].stop();
      }
      $scope.encoder.postMessage({
        cmd: 'finish'
      });

      $scope.input.disconnect();
      $scope.node.disconnect();
      $scope.input = $scope.node = null;
    }
  }


  //Speak admin msg
  function botSpeak(text) {
    if ('speechSynthesis' in window) {
      var msg = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(msg);
    }
  }

  //User msg
  function userSend(text) {
    var functionExist = false;


    if (text != '') {
      // 跟快捷功能一樣才需要語音輸入密碼
      for (let i = 0; i < functions.length; i++) {
        if (text === functions[i]) {
          functionExist = true;
          command = text;
          // show load wrapp
          load_wrapp_microfone.style.opacity = "1";
          load_wrapp_microfone.style.visibility = "visible";

          // show backdrop effect
          var backdrop = document.getElementsByClassName("backdrop")[0];
          backdrop.style.opacity = "1";
          backdrop.style.visibility = "visible";
          break;
        }
      }

      var img = '<i class="zmdi zmdi-account"></i>';
      $('#chat_converse').append('<div class="chat_msg_item chat_msg_item_user"><div class="chat_avatar">' + img + '</div>' + text + '</div>');
      $('#chatSend').val('');
      if ($('.chat_converse').height() >= 256) {
        $('.chat_converse').addClass('is-max');
        $('.chat_converse').scrollTop($('.chat_converse')[0].scrollHeight);
      }

      if (functionExist) {
        recording();
      } else {
        if(message_status=='帳號輸入'||message_status=='金額輸入'){
          adminSend(text);
        }else{
          adminSend('功能不存在');
        }
        
      }

    } else {
      alert('輸入為空! 請重新輸入');
    }
  }

  function service_result(text) {

    $('#chat_converse').append('<div class="chat_msg_item chat_msg_item_admin"><div class="chat_avatar"><i class="zmdi zmdi-headset-mic"></i></div>' + text + '</div>');
    botSpeak(text);
    if ($('.chat_converse').height() >= 256) {
      $('.chat_converse').addClass('is-max');
    }
    $('.chat_converse').scrollTop($('.chat_converse')[0].scrollHeight);
  }

  function check_account_format(text) { //確認銀行帳號格式
    console.log("text"+text);
    if ( text[0]!='('||text[4]!=')'||text.length != 19) {

      return false;
    } else {

      if (Number(text.substring(1, 3)) == NaN) {
        return false;
      } else if (Number(text.substring(5, )) == NaN) {
        return false;
      } else{
        return true;
      }

    }

  }

  function check_amount_format(text) { //確認轉帳金額格式
    console.log("text"+text);
    if (Number(text) == NaN || Number(text) > acc_balance) {
      return false;
    } else {
      return true;
    }

  }

  var message_status = '無'; //status=無or帳號輸入or金額輸入



  //Admin msg
  function adminSend(text) {
    var response = '';
    console.log("!!!!!!!!!!!!!!!!");
    if (message_status == '帳號輸入') {

      if (check_account_format(text)) {
        service_result("請輸入轉帳金額");
        message_status = '金額輸入';
      } else {
        service_result("帳號資訊錯誤請重新操作");
        message_status = '無';
      }
      
    } else if (message_status == '金額輸入') {
      if (check_amount_format(text)) {
        service_result("轉帳成功");
        message_status = '無';
      } else {
        service_result("金額錯誤或餘額不足請重新操作");
        message_status = '無';
      }
    } else {
      if (text == '帳戶餘額') {

        response = '您的帳戶餘額為...';

        $.ajax({
          url: "/search/" + session_id,
          type: 'POST',
          processData: false,
          contentType: false,
          success: function (result) {
            var resultArray = new Array(); //用來接收帳號資訊
            resultArray = result.split("/");
            //resultArray[0]:speaker_id、resultArray[1]:可用餘額、resultArray[2]:帳面餘額、resultArray[3]:用戶名稱、resultArray[4]:用戶帳號

            service_result(resultArray[2] + " TWD");
          }
        });

      } else if (text == '可用餘額') {
        response = '您的可用餘額為...';
        $.ajax({
          url: "/search/" + session_id,
          type: 'POST',
          processData: false,
          contentType: false,
          success: function (result) {
            var resultArray = new Array(); //用來接收帳號資訊
            resultArray = result.split("/");
            //resultArray[0]:speaker_id、resultArray[1]:可用餘額、resultArray[2]:帳面餘額、resultArray[3]:用戶名稱、resultArray[4]:用戶帳號
            service_result(resultArray[1] + " TWD");
          }

        });

      } else if (text == '約定轉帳') {
        response = '約定轉帳給...';
        $.ajax({
          url: "/search/" + session_id,
          type: 'POST',
          processData: false,
          contentType: false,
          success: function (result) {
            var resultArray = new Array(); //用來接收帳號資訊
            resultArray = result.split("/");
            acc_balance = resultArray[1];
            //resultArray[0]:speaker_id、resultArray[1]:可用餘額、resultArray[2]:帳面餘額、resultArray[3]:用戶名稱、resultArray[4]:用戶帳號
          }
        });
        message_status = '帳號輸入';

      } else if (text == '非約定轉帳') {
        response = '非約定轉帳給...';

        $.ajax({
          url: "/search/" + session_id,
          type: 'POST',
          processData: false,
          contentType: false,
          success: function (result) {
            var resultArray = new Array(); //用來接收帳號資訊
            resultArray = result.split("/");
            acc_balance = resultArray[1];
            //resultArray[0]:speaker_id、resultArray[1]:可用餘額、resultArray[2]:帳面餘額、resultArray[3]:用戶名稱、resultArray[4]:用戶帳號
          }

        });

        message_status = '帳號輸入';

      } else if (text == '交易紀錄') {
        response = '您近期的交易紀錄為...';


      } else if (text == '分享帳號') {
        response = '本帳號資訊...';
        $.ajax({
          url: "/search/" + session_id,
          type: 'POST',
          processData: false,
          contentType: false,
          success: function (result) {
            var resultArray = new Array(); //用來接收帳號資訊
            resultArray = result.split("/");
            //resultArray[0]:speaker_id、resultArray[1]:可用餘額、resultArray[2]:帳面餘額、resultArray[3]:用戶名稱、resultArray[4]:用戶帳號
            var message = "戶名: " + resultArray[3] + "<br>銀行代碼: (000)" + "<br>用戶帳號: " + resultArray[4];
            service_result(message);
          }
        });



      } else if (text == '權限不足') {
        response = '很抱歉，您的權限未通過';
      } else if (text == '功能不存在') {
        response = '很抱歉目前沒有此功能，可以試試看其他功能優!';
      } else {
        response = '尼剛剛說的密碼為: ' + password;
      }

      $('#chat_converse').append('<div class="chat_msg_item chat_msg_item_admin"><div class="chat_avatar"><i class="zmdi zmdi-headset-mic"></i></div>' + response + '</div>');
      botSpeak(text);
      if ($('.chat_converse').height() >= 256) {
        $('.chat_converse').addClass('is-max');
      }
      $('.chat_converse').scrollTop($('.chat_converse')[0].scrollHeight);
    }



  }

  //Send input using enter and send key
  $('#chatSend').bind("enterChat", function (e) {
    userSend($('#chatSend').val());
    // adminSend($('#chatSend').val());
    command = $('#chatSend').val();
  });
  $('#fab_send').bind("enterChat", function (e) {
    userSend($('#chatSend').val());
    // adminSend($('#chatSend').val());
    command = $('#fab_send').val();
  });
  $('#chatSend').keypress(function (event) {
    if (event.keyCode === 13) {
      event.preventDefault();
      if (jQuery.trim($('#chatSend').val()) !== '') {
        $(this).trigger("enterChat");
      }
    }
  });

  $('#fab_send').click(function (e) {

    if (jQuery.trim($('#chatSend').val()) !== '') {
      $(this).trigger("enterChat");
    }
  });


  // Color options
  $(".chat_color").click(function (e) {
    $('.fabs').removeClass(localStorage.getItem("fab-color"));
    $('.fabs').addClass($(this).attr('color'));
    localStorage.setItem("fab-color", $(this).attr('color'));
  });

  $('.chat_option').click(function (e) {
    $(this).toggleClass('is-dropped');
  });

  //Loader effect
  function loadBeat(beat) {
    beat ? $('.chat_loader').addClass('is-loading') : $('.chat_loader').removeClass('is-loading');
  }

  // Ripple effect
  var target, ink, d, x, y;
  $(".fab").click(function (e) {
    target = $(this);
    //create .ink element if it doesn't exist
    if (target.find(".ink").length == 0)
      target.prepend("<span class='ink'></span>");

    ink = target.find(".ink");
    //incase of quick double clicks stop the previous animation
    ink.removeClass("animate");

    //set size of .ink
    if (!ink.height() && !ink.width()) {
      //use parent's width or height whichever is larger for the diameter to make a circle which can cover the entire element.
      d = Math.max(target.outerWidth(), target.outerHeight());
      ink.css({
        height: d,
        width: d
      });
    }

    //get click coordinates
    //logic = click coordinates relative to page - parent's position relative to page - half of self height/width to make it controllable from the center;
    x = e.pageX - target.offset().left - ink.width() / 2;
    y = e.pageY - target.offset().top - ink.height() / 2;

    //set the position and add class .animate
    ink.css({
      top: y + 'px',
      left: x + 'px'
    }).addClass("animate");
  });

  //Cookies handler
  function createCookie(name, value, days) {
    var expires;

    if (days) {
      var date = new Date();
      date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
      expires = "; expires=" + date.toGMTString();
    } else {
      expires = "";
    }
    document.cookie = encodeURIComponent(name) + "=" + encodeURIComponent(value) + expires + "; path=/";
  }

  function readCookie(name) {
    console.log(name)
    var nameEQ = encodeURIComponent(name) + "=";
    var ca = document.cookie.split(';');
    for (var i = 0; i < ca.length; i++) {
      var c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) > -1) return decodeURIComponent(c.substring(nameEQ.length, c.length));
    }
    return null;
  }

  function eraseCookie(name) {
    createCookie(name, "", -1);
  }

  //User login
  function logUser() {
    hideChat(true);
    $('#chat_send_email').click(function (e) {
      var email = $('#chat_log_email').val();
      if (jQuery.trim(email) !== '' && validateEmail(email)) {
        $('.chat_login_alert').html('');
        loadBeat(true);
        createCookie('fab_chat_email', email, 100);
        if (checkEmail(email)) {
          //email exist and get and set username in session
          hideChat(false);
        } else {
          setTimeout(createUsername, 3000);
        }
      } else {
        $('.chat_login_alert').html('Invalid email.');
      }
    });
  }

  function createUsername() {
    loadBeat(false);
    $('#chat_log_email').val('');
    $('#chat_send_email').children('i').removeClass('zmdi-email').addClass('zmdi-account');
    $('#chat_log_email').attr('placeholder', 'Username');
    $('#chat_send_email').attr('id', 'chat_send_username');
    $('#chat_log_email').attr('id', 'chat_log_username');
    $('#chat_send_username').click(function (e) {
      var username = $('#chat_log_username').val();
      if (jQuery.trim(username) !== '') {
        loadBeat(true);
        if (checkUsername(username)) {
          //username is taken
          $('.chat_login_alert').html('Username is taken.');
        } else {
          //save username in DB and session
          createCookie('fab_chat_username', username, 100);
          hideChat(false);
        }
      } else {
        $('.chat_login_alert').html('Please provide username.');
      }
    });
  }

  function hideChat(hide) {
    if (hide) {
      $('.chat_converse').css('display', 'none');
      $('.fab_field').css('display', 'none');
    } else {
      $('#chat_head').html(readCookie('fab_chat_username'));
      // 之後可以用在按鈕提問
      // $('#fab_help').click(function(){userSend('Help!');});
      $('.chat_login').css('display', 'none');
      $('.chat_converse').css('display', 'block');
      $('.fab_field').css('display', 'inline-block');
    }
  }

  function checkEmail(email) {
    //check if email exist in DB
    return false;
  }

  function checkUsername(username) {
    //check if username exist in DB
    return false;
  }



  function validateEmail(email) {
    var emailReg = /^([\w-\.]+@([\w-]+\.)+[\w-]{2,4})?$/;
    if (!emailReg.test(email)) {
      return false;
    } else {
      return true;
    }
  }

  if (readCookie('fab_chat_username') === null || readCookie('fab_chat_email') === null) {
    logUser();
  } else {

  }

  hideChat(false);


  //=============================== button function ============================================
  $('.account_total_money').click(function (e) {
    userSend("帳戶餘額");
    command = '帳戶餘額';
  });
  $('.account_available_balance').click(function (e) {
    userSend("可用餘額");
    command = '可用餘額';
  });
  $('.agreed_wire_transfer').click(function (e) {
    userSend("約定轉帳");
    command = '約定轉帳';
  });
  $('.regular_wire_transfer').click(function (e) {
    userSend("非約定轉帳");
    command = '非約定轉帳';
  });
  $('.account_transaction_record').click(function (e) {
    userSend("交易紀錄");
    command = '交易紀錄';
  });
  $('.share_account_imformation').click(function (e) {
    userSend("分享帳號");
    command = '分享帳號';
  });

  //============================================================================================
}]);