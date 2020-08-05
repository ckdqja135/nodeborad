// 참고 https://www.a-mean-blog.com/ko/blog/Node-JS-%EC%B2%AB%EA%B1%B8%EC%9D%8C/%EA%B2%8C%EC%8B%9C%ED%8C%90-%EB%A7%8C%EB%93%A4%EA%B8%B0-%EA%B3%A0%EA%B8%89/%EA%B2%8C%EC%8B%9C%ED%8C%90-%ED%8C%8C%EC%9D%BC%EC%B2%A8%EB%B6%80-%EA%B8%B0%EB%8A%A5-%EB%A7%8C%EB%93%A4%EA%B8%B0-5-%EC%84%9C%EB%93%9C%ED%8C%8C%ED%8B%B0-API-Box-com-%EC%82%AC%EC%9A%A9-%ED%95%98%EA%B8%B0
// 참고(https://www.a-mean-blog.com/ko/blog/Node-JS-%EC%B2%AB%EA%B1%B8%EC%9D%8C/%EA%B2%8C%EC%8B%9C%ED%8C%90-%EB%A7%8C%EB%93%A4%EA%B8%B0-%EA%B3%A0%EA%B8%89/%EA%B2%8C%EC%8B%9C%ED%8C%90-%ED%8C%8C%EC%9D%BC%EC%B2%A8%EB%B6%80-%EA%B8%B0%EB%8A%A5-%EB%A7%8C%EB%93%A4%EA%B8%B0-2-%EB%8B%A4%EC%9A%B4%EB%A1%9C%EB%93%9C)

var express  = require('express');
var router = express.Router();
var File = require('../models/File');

router.get('/:serverFileName/:originalFileName', function(req, res){ // :을 사용해 server의 파일 이름(server file name)과 업로드될 당시의 파일 이름(original file name)을 파라메터로 받는 file route이다.
  
  // serverFileName, originalFileName 파라메터를 사용해 DB에 저장된 file 데이터를 찾는다.  
  // file.getFileStream함수에 await을 사용하기 위해 async 키워드를 추가.
  File.findOne({serverFileName:req.params.serverFileName, originalFileName:req.params.originalFileName}, async function(err, file){ 
    if(err) return res.json(err);

    var stream; // file.getFileStream함수를 통해 stream과 statusCode의 값이 변경될 수 있으므로 try catch 밖으로 빼줌.
    var statusCode = 200; // 위와 동일.
    try{
      stream = await file.getFileStream(); //  file 인스턴스의 getFileStream함수로 서버 파일의 스트림을 가져온다.
    }
    catch(e){
      statusCode = e; // file.getFileStream함수에서 에러가 나는 경우 status 코드가 전달되므로 이 값을 statusCode에 담는다.
    }

    // 스트림이 존재하면 response 해더를 파일다운로드에 맞도록 'Content-Type'와 'Content-Disposition'를 설정하고, 
    // stream.pipe(res)로 파일스트림과 response를 연결해 준다. 
    // 이렇게 서버파일의 스트림을 response에 연결해서 client에 파일을 보낼 수 있다.
    if(stream){ 
      res.writeHead(statusCode, {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment; filename=' + file.originalFileName
      });
      stream.pipe(res);
    }
    else {
      res.statusCode = statusCode; // statusCode를 response의 status 코드로 사용하게 한다.
      res.end();
    }
  });
});

module.exports = router;
