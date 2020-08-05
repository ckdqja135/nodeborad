// file와 post의 관계를 만들어주는 부분이다. 
// 왜 post에도 file ref(reference)가 있고, file에도 post ref가 있으냐면, 
// post는 현재 게시물이 가지고 있는 file을 ref로 가지고 있는 것이고, file은 생성될 당시의 post를 ref로 가진다.
// 즉, 게시물에 파일이 첨부되었다가 첨부파일을 새로 업로드하게 되면 post는 두번째 업로드된 파일만 ref로 가지게 된다. 
// 이때 만약 file에 post ref가 없다면 첫번째 업로드된 파일은 어느 post를 위해 업로드되었는지 그 정보를 잃거 되므로 postId를 따로 기록하는 것이다.

var mongoose = require('mongoose');
// Post 모델에 조회수, 글번호를 위한 코드를 추가합니다.

var Counter = require('./Counter'); // Counter 모델을 사용하기 위해 require함.

// schema
var postSchema = mongoose.Schema({
  title:{type:String, required:[true,'Title is required!']},
  body:{type:String, required:[true,'Body is required!']},
  author:{type:mongoose.Schema.Types.ObjectId, ref:'user', required:true},
  views:{type:Number, default:0}, //  조회수를 위한 views항목을 추가했다.
  numId:{type:Number}, // 글번호를 위한 numId항목을 추가했다.
  attachment:{type:mongoose.Schema.Types.ObjectId, ref:'file'},
  createdAt:{type:Date, default:Date.now},
  updatedAt:{type:Date},
});

// Schema.pre함수는 첫번째 파라미터로 설정된 event가 일어나기 전(pre)에 먼저 callback 함수를 실행시킨다. 
// "save" event는 Model.create, model.save함수 실행시 발생하는 event이다.
postSchema.pre('save', async function (next){
  var post = this;
  // 새 post가 생성되는 경우(post.isNew가 true)에만 'posts' counter를 읽어오고, 숫자를 증가시키고, post의 numId에 counter를 넣어준다. 
  // 만약 'posts' counter가 존재하지 않는다면 생성한다.
  if(post.isNew){
    counter = await Counter.findOne({name:'posts'}).exec();
    if(!counter) counter = await Counter.create({name:'posts'});
    counter.count++;
    counter.save();
    post.numId = counter.count;
  }
  return next();
});

// model & export
var Post = mongoose.model('post', postSchema);
module.exports = Post;
