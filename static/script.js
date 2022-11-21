var recorderApp = angular.module('recorder', []);

var tag = document.querySelector(".tag");
var startRecord = false;

//Speak admin msg
function botSpeak(text) {
  if ('speechSynthesis' in window) {
    var msg = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(msg);
  }
}

//User msg
function userSend(text) {
  var img = '<i class="zmdi zmdi-account"></i>';
  $('#chat_converse').append('<div class="chat_msg_item chat_msg_item_user"><div class="chat_avatar">' + img + '</div>' + text + '</div>');
  $('#chatSend').val('');
  if ($('.chat_converse').height() >= 256) {
    $('.chat_converse').addClass('is-max');
  }
  $('.chat_converse').scrollTop($('.chat_converse')[0].scrollHeight);
}

//Admin msg
function adminSend(text) {
  $('#chat_converse').append('<div class="chat_msg_item chat_msg_item_admin"><div class="chat_avatar"><i class="zmdi zmdi-headset-mic"></i></div>' + text + '</div>');
  botSpeak(text);
  if ($('.chat_converse').height() >= 256) {
    $('.chat_converse').addClass('is-max');
  }
  $('.chat_converse').scrollTop($('.chat_converse')[0].scrollHeight);
}

//Send input using enter and send key
$('#chatSend').bind("enterChat", function (e) {
  userSend($('#chatSend').val());
  adminSend('How may I help you.');
});
$('#fab_send').bind("enterChat", function (e) {
  userSend($('#chatSend').val());
  adminSend('How may I help you.');
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

    //=====錄語音傳去側錄模型辨識結果========

    if (startRecord == false) {
      // 開始錄音
      console.log("錄音中...");
      startRecord = true;

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
    } else {
      // 停止錄音
      console.log("停止錄音");
      startRecord = false;

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

    //=====================================
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
				if (result == '1') {
          tag.classList.remove("rejected");
					tag.classList.add("approved");
          tag.innerHTML = 'Authorized   <i class="fa fa-unlock-alt" aria-hidden="true"></i>';
				} else if (result == '0') {
          tag.classList.remove("approved");
					tag.classList.add("rejected");
          tag.innerHTML = 'Unauthorized <i class="fa fa-lock" aria-hidden="true"></i>';
				}
			}
		});
	};
}]);


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
function account_total_money() {
  $('#chatSend').val("帳戶餘額");
}


function account_available_balance() {
  $('#chatSend').val("可用餘額");
}


function agreed_wire_transfer() {
  $('#chatSend').val("約定轉帳");
}

function regular_wire_transfer() {
  $('#chatSend').val("非約定轉帳");
}

function account_transaction_record() {
  $('#chatSend').val("交易紀錄");
}

function share_account_imformation() {
  $('#chatSend').val("分享帳戶");
}

//============================================================================================