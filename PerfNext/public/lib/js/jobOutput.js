
$(function() {
    $.get("/api/getJobIDs", function(data, status) {
        
    $.each(data, function (i) {
        $('#job').append($('<option>', { 
            text : data[i] 
        }));
    });

    $('#job').on('change', function() {
      for (var i = 1; i < 99999; i++)
        window.clearInterval(i);
      consoleOuput(this.value);
    })

    });
});



function consoleOuput(jobID) {
    var requestAPI = "/api/getConsoleOutput?jobID=" + encodeURIComponent(jobID);

    $('#console-output').html('Loading...');
    $.get(requestAPI, function(data, status) {
        $('#console-output').html(data);

        window.setInterval(function(){
            temp(jobID);
        }, 2000);

    });
}

function temp(jobID) {
    var requestAPI = "/api/getConsoleOutput?jobID=" + encodeURIComponent(jobID);

    $.get(requestAPI, function(data, status) {
        //$('html, body').scrollTop( $(document).height() );
        $('#console-output').html(data);
    });
}