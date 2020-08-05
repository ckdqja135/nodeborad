// 참고 https://www.a-mean-blog.com/ko/blog/Node-JS-%EC%B2%AB%EA%B1%B8%EC%9D%8C/%EA%B2%8C%EC%8B%9C%ED%8C%90-%EB%A7%8C%EB%93%A4%EA%B8%B0-%EA%B3%A0%EA%B8%89/%EA%B2%8C%EC%8B%9C%ED%8C%90-%ED%8C%8C%EC%9D%BC%EC%B2%A8%EB%B6%80-%EA%B8%B0%EB%8A%A5-%EB%A7%8C%EB%93%A4%EA%B8%B0-5-%EC%84%9C%EB%93%9C%ED%8C%8C%ED%8B%B0-API-Box-com-%EC%82%AC%EC%9A%A9-%ED%95%98%EA%B8%B0
// 참고(https://www.a-mean-blog.com/ko/blog/Node-JS-%EC%B2%AB%EA%B1%B8%EC%9D%8C/%EA%B2%8C%EC%8B%9C%ED%8C%90-%EB%A7%8C%EB%93%A4%EA%B8%B0-%EA%B3%A0%EA%B8%89/%EA%B2%8C%EC%8B%9C%ED%8C%90-%ED%8C%8C%EC%9D%BC%EC%B2%A8%EB%B6%80-%EA%B8%B0%EB%8A%A5-%EB%A7%8C%EB%93%A4%EA%B8%B0-2-%EB%8B%A4%EC%9A%B4%EB%A1%9C%EB%93%9C)


// 1 
// file 모델의 스키마입니다. 각각의 항목(property)들을 살펴봅시다.

// originalFileName: 업로드된 파일명입니다.
// serverFileName: 같은 이름의 파일이 업로드되는 경우를 대비하여 모든 업로드된 파일은 파일명이 바뀌어 저장됩니다. 실제 서버에 저장된 파일 이름을 저장합니다.
// size: 업로드된 파일의 크기입니다.
// uploadedBy: 어느 user에 의해 업로드되었는지를 기록합니다. 파일업로드는 로그인 된 유저에게만 혀용되므로 required가 추가되었습니다.
// postId: 이 파일이 어느 post와 관련있는지를 기록합니다. 아마 나중에 게시판이외의 경로로 업로드되는 경우가 있을것 같아서 required는 하지 않았습니다.
// isDeleted: comment와 마찬가지로 파일을 지우는 경우에 실제 파일이나 DB의 file 데이터를 지우지 않고 isDeleted를 이용하여 처리합니다.

var mongoose = require('mongoose');
var fs = require('fs'); // fs는 File System의 약어로 컴퓨터의 파일을 조작할 수 있는 node module이다. package를 따로 설치할 필요없이 node.js에서 기본적으로 제공됨.
var path = require('path'); // path 역시 node.js에서 기본적으로 제공되며, 폴더및 파일의 path를 조작할 수 있다.

// Box client setting
var BoxSDK = require('box-node-sdk');
var client; // box-node-sdk의 client를 담을 변수

// Box.com에서 생성한 client id와 app token은 보안 정보이므로 소스코드에 저장되면 안된다. 환경변수에 저장하여 불러오도록 하자.
var boxClientId = process.env.BOX_CLIENT_ID;
var boxAppToken = process.env.BOX_APP_TOKEN;

var isBoxEnabled = boxClientId && boxAppToken; // 환경변수에 box client id와 app token이 있는 경우, isBoxEnabled를 true로 한다.

if(isBoxEnabled){ // isBoxEnabled가 true인 경우에만 client를 세팅
  //  https://developer.box.com/guides/authentication/app-token/with-sdk 페이지에서 본 것처럼 코드를 입력해 준다.
  var sdk = new BoxSDK({
    clientID: boxClientId,
    clientSecret: ''
  });
  client = sdk.getBasicClient(boxAppToken);
}

// schema
var fileSchema = mongoose.Schema({ // 1
  originalFileName:{type:String},

  // Box.com API들은 파일을 읽어올 때 고유의 file id를 사용한다.
  // 해당 정보를 저장할 수 있도록 새로운 항목을 추가하였다. 
  // Box.com 업로드 API를 사용해 파일을 업로드하는 경우 file id가 생성되고 
  // 그 정보를 file document의 serverFileId에 저장하고, 
  // 파일을 다운로드하는 경우 serverFileId 항목의 값을 사용하여 box.com 다운로드 API를 호출한다.
  serverFileId:{type:String}, 

  serverFileName:{type:String},
  size:{type:Number},
  uploadedBy:{type:mongoose.Schema.Types.ObjectId, ref:'user', required:true},
  postId:{type:mongoose.Schema.Types.ObjectId, ref:'post'},
  isDeleted:{type:Boolean, default:false},
});

// instance methods
// file모델의 인스턴스(instance) 함수들을 추가한다. 
// (모델과 인스턴스의 차이점은 이전 강의에서 자세히 설명하였으니 참고.) 
// 인스턴스의 함수는 Schema.methods 객체에 추가할 수 있다. 
// 또한 이 함수들안에서 this는 인스턴스 자체를 가리킨다.
fileSchema.methods.processDelete = function(){ // processDelete함수는 삭제요청을 처리한다. 실제 파일을 지우지는 않고, file의 isDeleted항목을 true로 변경하여 저장하는 일만 한다.
  this.isDeleted = true;
  this.save();
};

fileSchema.methods.getFileStream = async function(){ // async 키워드가 추가.
  if(isBoxEnabled){ // using box.com
    try{
      // https://github.com/box/box-node-sdk/blob/master/docs/files.md#download-a-file 문서의 예제와 다르게 await를 사용하여 sync로 함수를 사용하고 있다.
      // await를 사용시 에러가 발생하는 경우를 관리하기 위해 try catch를 사용.
      var stream = await client.files.getReadStream(this.serverFileId);
    }
    catch(err){
      if(err.statusCode == 404){ // 에러의 status 코드가 404인 경우에는 processDelete함수를 호출.
        this.processDelete();
      }
      throw(err.statusCode); // 에러의 status코드를 던져준다. 이제 fileSchema.methods.getFileStream 함수가 에러를 던질 수 있으므로 해당 함수를 호출하는 모든 코드는 try catch를 사용해줘야 한다.
    }
    return stream;
  }
  else { // using server file system / isBoxEnabled가 false인 경우에는 이전과 같다.
    var stream;
    var filePath = path.join(__dirname,'..','uploadedFiles',this.serverFileName); // path.join함수를 사용해 서버 파일위치의 절대주소 만들어 filePath에 string으로 저장한다. node js에서 __dirname는 현재 파일이 있는 위치를 담고 있는 변수이다.
    var fileExists = fs.existsSync(filePath); // fs.existsSync(파일_위치)함수는 파일_위치의 파일이 존재하면 true를, 아니면 false를 return한다.
    // ** fs.existsSync처럼 이름이 Sync로 끝나는 함수들은 주로 async함수와 sync함수가 나누어져 있는 경우가 많다. 
    // ** 함수이름에서 Sync를 때서(fs.exists) async함수로 사용할 수도 있다. 현재 중요한 내용은 아니지만, 함수 이름에 의문을 가지는 사람이 있을까봐 적어본다.
    if(fileExists){ // 만약 파일이 존재하면 fs.createReadStream함수를 사용해 해당 파일의 일기 전용 스트림을 생성하여 stream변수에 담는다.
      stream = fs.createReadStream(filePath);
    }
    else { // 만약 파일이 존재하지 않으면 4번의 processDelete함수를 호출한다.
      this.processDelete();
    }
    return stream; // stream을 return한다. 만약 파일이 존재하지 않으면 stream은 undefined 상태이겠지...
  }
};

// model & export
var File = mongoose.model('file', fileSchema);

// model methods
File.createNewInstance = async function(file, uploadedBy, postId){
  if(isBoxEnabled){ // using box.com
    var filePath = path.join(__dirname,'..','uploadedFiles',file.filename); // 파일 위치를 만든다.
    var stream = fs.createReadStream(filePath); // 파일 스트림을 만든다.
    var boxResponse = await client.files.uploadFile('0', `${file.filename}_${file.originalname}`, stream); // 해당 스트림으로 box.com API를 호출.
    var uploadedFile = boxResponse.entries[0]; //  https://github.com/box/box-node-sdk/blob/master/docs/files.md#upload-a-file 를 보면 업로드 성공시 어떠한 response가 오는지를 볼 수 있다. 이를 참고하여 업로드된 파일의 정보를 찾는다.

    return await File.create({
        originalFileName:file.originalname,
        serverFileName:file.filename,
        serverFileId:uploadedFile.id, // Box.com의 파일id를 file document에 담는다.
        size:file.size,
        uploadedBy:uploadedBy,
        postId:postId,
      });
  }
  else { // using server file system / isBoxEnabled가 false인 경우에는 이전과 같다.
    return await File.create({
        originalFileName:file.originalname,
        serverFileName:file.filename,
        size:file.size,
        uploadedBy:uploadedBy,
        postId:postId,
      });
  }
};

module.exports = File;
