// 合成
const submit_synthesis_btn = document.querySelector("#submit_synthesis");
const fileinp_synthesis = document.querySelector("#fileinp_synthesis");
const result_synthesis_real = document.querySelector("#result_synthesis_real");
const result_synthesis_fake = document.querySelector("#result_synthesis_fake");
const result_synthesis_unknow = document.querySelector("#result_synthesis_unknow");
const wait_icon_synthesis = document.querySelector("#wait_icon_synthesis");
const synthesis_play = document.querySelector("#synthesis_play");


// 側錄
const submit_recording_btn = document.querySelector("#submit_recording");
const fileinp_recording = document.querySelector("#fileinp_recording");
const result_recording_real = document.querySelector("#result_recording_real");
const result_recording_fake = document.querySelector("#result_recording_fake");
const wait_icon_recording = document.querySelector("#wait_icon_recording");
const recording_play = document.querySelector("#recording_play");


submit_synthesis_btn.onclick = () => {
    result_synthesis_real.style.visibility = "hidden";
    result_synthesis_fake.style.visibility = "hidden";
    result_synthesis_unknow.style.visibility = "hidden";
    wait_icon_synthesis.style.visibility = "visible";
    var formData_synthesis = new FormData();
    var test_file_synthesis = $("#fileinp_synthesis").val();
    var index = test_file_synthesis.lastIndexOf('\\');
    test_file_synthesis = test_file_synthesis.substring(index + 1);
    console.log('合成測試檔名: ' + test_file_synthesis)
    formData_synthesis.append('test_file', test_file_synthesis);
    $.ajax({
        url: "/synthesis_test",
        type: 'POST',
        data: formData_synthesis,
        processData: false,
        contentType: false,
        success: function (result) {
            console.log('合成結果' + result);
            wait_icon_synthesis.style.visibility = "hidden";
            if (result == 'real') {
                result_synthesis_real.style.visibility = "visible";
            } else if (result == 'fake') {
                result_synthesis_fake.style.visibility = "visible";
            } else if (result == 'unknow') {
                result_synthesis_unknow.style.visibility = "visible";
            }
        }
    });
    fileinp_synthesis.value = "";
}

fileinp_synthesis.onchange = function () {
    var file = $("#fileinp_synthesis").val();
    var index = file.lastIndexOf('\\');
    file = file.substring(index + 1);
    $("#text_synthesis").html(file);
    synthesis_play.src = "static/synthesis_file/test_audio_HMM_Real/" + file;
}

submit_recording_btn.onclick = () => {
    result_recording_real.style.visibility = "hidden";
    result_recording_fake.style.visibility = "hidden";
    wait_icon_recording.style.visibility = "visible";
    var formData_recording = new FormData();
    var test_file_recording = $("#fileinp_recording").val();
    var index = test_file_recording.lastIndexOf('\\');
    test_file_recording = test_file_recording.substring(index + 1);
    console.log('側錄測試檔名: ' + test_file_recording)
    formData_recording.append('verify_model', 'transfer_cnn_noEMD_1120.pt');
	formData_recording.append('audio_file', test_file_recording);
    $.ajax({
        url: "/spoof_test",
        type: 'POST',
        data: formData_recording,
        processData: false,
        contentType: false,
        success: function (result) {
            console.log('側錄結果' + result);
            wait_icon_recording.style.visibility = "hidden";
            if (result == '1') {
                result_recording_real.style.visibility = "visible";
            } else if (result == '0') {
                result_recording_fake.style.visibility = "visible";
            }
        }
    });
    fileinp_recording.value = "";
}

fileinp_recording.onchange = function () {
    var file = $("#fileinp_recording").val();
    var index = file.lastIndexOf('\\');
    file = file.substring(index + 1);
    $("#text_recording").html(file);
    recording_play.src = "static/spoof_file/" + file;
}