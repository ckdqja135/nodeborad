// 2,3 (https://www.a-mean-blog.com/ko/blog/Node-JS-%EC%B2%AB%EA%B1%B8%EC%9D%8C/%EA%B2%8C%EC%8B%9C%ED%8C%90-%EB%A7%8C%EB%93%A4%EA%B8%B0-%EA%B3%A0%EA%B8%89/%EA%B2%8C%EC%8B%9C%ED%8C%90-%ED%8C%8C%EC%9D%BC%EC%B2%A8%EB%B6%80-%EA%B8%B0%EB%8A%A5-%EB%A7%8C%EB%93%A4%EA%B8%B0-3-%EB%A6%AC%EC%8A%A4%ED%8A%B8%EC%97%90-%EC%95%84%EC%9D%B4%EC%BD%98-%EC%B6%94%EA%B0%80)
// $lookup은 항상 배열로 해당 조건을 만족하는 모든 데이터를 배열로 연결하는 특징이 있고, 
// 이 배열을 풀어주려면 $unwind를 사용하는 것도 게시판 - 댓글 기능 만들기 4 (댓글 수 표시)강의에서 설명했었습니다. 
// author와 마찬가지로 $unwind를 사용했는데, 그 모양이 조금 다릅니다.

// author는 { $unwind: '$author' } 와 $unwind에 같이 문자열('$author')을 바로 넣어주었고, 
// 여기서는 $unwind에 path와 preserveNullAndEmptyArrays항목이 들어갔습니다. 
// { $unwind: '$author' }는 { $unwind: { path:'$author' } }의 축약형으로 다들 예상하셨을 것이고, 
// preserveNullAndEmptyArrays에 대해 알아봅시다.

// unwind는 배열을 flat하게 풀어주는 대신에 배열의 수만큼 오브젝트를 생성합니다. 
// author는 모든 post에 반드시 하나 존재하므로 단순히 unwind하면 되지만, 첨부파일은 없을수도 있습니다. 
// 첨부파일이 없는 post는 unwind하게 되면 $lookup으로 생성된 첨부파일 배열의 길이가 0이므로 해당 post가 사라집니다. 
// 배열의 길이가 0이거나, 배열이 없는 항목을 unwind하는 경우 기존 오브젝트를 삭제하지 않도록 하는 설정이 preserveNullAndEmptyArrays: true 입니다.


// 4 (https://www.a-mean-blog.com/ko/blog/Node-JS-%EC%B2%AB%EA%B1%B8%EC%9D%8C/%EA%B2%8C%EC%8B%9C%ED%8C%90-%EB%A7%8C%EB%93%A4%EA%B8%B0-%EA%B3%A0%EA%B8%89/%EA%B2%8C%EC%8B%9C%ED%8C%90-%EB%8C%93%EA%B8%80-%EA%B8%B0%EB%8A%A5-%EB%A7%8C%EB%93%A4%EA%B8%B0-4-%EB%8C%93%EA%B8%80-%EC%88%98-%ED%91%9C%EC%8B%9C)
// $project 오브젝트(https://docs.mongodb.com/manual/reference/operator/aggregation/project)는 데이터를 원하는 형태로 가공하기 위해 사용된다. 
// $project:바로 다음에 원하는 schema를 넣어주면 된다. 이때 1은 보여주기를 원하는 항목을 나타낸다. 다만 _id는 반드시 표시되고 숨길 수 없다. 
// 즉 title: 1은 '데이터의 title항목을 보여줄 것'이라는 뜻이다.
// commentCount라는 항목을 새로 생성하고 있는데, 여기에는 $size (https://docs.mongodb.com/manual/reference/operator/aggregation/size)를 사용해서 comments의 길이를 가져온다.
// aggregation을 통해 post에 commentCount항목을 생성하고 관련 comments의 길이를 갖는 코드를 작성해 보았다.
// 나머지는 이 코드를 어떻게 화면에 보여줄지를 위한 코드이고, 위까지의 내용이 중요한 내용이니 잘 이해해 보도록 하자. 
// 특히나 $project는 지금 사용한건 아주 기본적인 내용이고 활용방법이 아주 다양하다.
var express  = require('express');
var router = express.Router();
var multer = require('multer');
var upload = multer({ dest: 'uploadedFiles/' });
var Post = require('../models/Post');
var User = require('../models/User');
var Comment = require('../models/Comment');
var File = require('../models/File');
var util = require('../util');

// Index
router.get('/', async function(req, res){
  var page = Math.max(1, parseInt(req.query.page));
  var limit = Math.max(1, parseInt(req.query.limit));
  page = !isNaN(page)?page:1;
  limit = !isNaN(limit)?limit:10;

  var skip = (page-1)*limit;
  var maxPage = 0;
  var searchQuery = await createSearchQuery(req.query);
  var posts = [];

  if(searchQuery) {
    var count = await Post.countDocuments(searchQuery);
    maxPage = Math.ceil(count/limit);
    //  mongoose에서 모델.aggregate함수로 모델에 대한 aggregation을 mongodb로 전달할 수 있다. 
    // 함수에 전달되는 배열의 오브젝트 형태는 mongoDB에서 사용되는 오브젝트와 정확히 일치하므로, 
    // 여기서부터는 mongoDB의 aggregation 문서(https://docs.mongodb.com/manual/aggregation)를 참고할 수 있다.
    posts = await Post.aggregate([
      { $match: searchQuery }, //  $match 오브젝트(https://docs.mongodb.com/manual/reference/operator/aggregation/match)는 모델.find함수와 동일한 역할을 한다. 
      { $lookup: { // post에 file을 $lookup을 통해 post.attachment로 연결. $lookup 오브젝트(https://docs.mongodb.com/manual/reference/operator/aggregation/lookup)는 한 collection과 다른 collection을 이어주는 역할을 한다. 
          from: 'users', // 다른 collection의 이름을 적는다.
          localField: 'author', // 현재 collection의 항목을 적는다.
          foreignField: '_id',  // 다른 collection의 항목을 적는다.
          as: 'author' //  다른 collection을 담을 항목의 이름을 적는다. 이 항목의 이름으로 다른 collection의 데이터가 생성된다.
      } },
      { $unwind: '$author' }, // 2. //  $unwind 오브젝트(https://docs.mongodb.com/manual/reference/operator/aggregation/unwind)는 배열을 flat하게 풀어주는 역할을 한다.
      { $sort : { createdAt: -1 } }, // sort 오브젝트(https://docs.mongodb.com/manual/reference/operator/aggregation/sort)는 모델.sort함수와 동일한 역할을 한다. 
                                     // 다만 '-createdAt'과 같은 형태는 사용할 수 없고, { createdAt: -1 }의 형태로 사용해야 한다. (모델.sort은 두가지 형태를 모두 사용할 수 있다.)
      { $skip: skip },
      { $limit: limit },
      { $lookup: { // 또 다시 $lookup을 사용해서 post._id와 comment.post를 연결한다. 하나의 post에 여러개의 comments가 생길 수 있으므로 이번에는 $unwind를 사용하지 않는다.
          from: 'comments',
          localField: '_id',
          foreignField: 'post',
          as: 'comments'
      } },
      { $lookup: {
          from: 'files',
          localField: 'attachment',
          foreignField: '_id',
          as: 'attachment'
      } },
      { $unwind: {
        path: '$attachment',
        preserveNullAndEmptyArrays: true
      } },
      { $project: { // 4
          title: 1,
          author: {
            username: 1,
          },
          views: 1, // post 모델의 schema에 views와 numId가 추가되었으므로 post index route의 aggregation 속 $project에도 해당 항목들이 표시될 수 있도록 수정해줌.
          numId: 1, // 게시물이 조회될 때마다 post.views를 1 증가시키고, 저장해줌.
          attachment: { $cond: [{$and: ['$attachment', {$not: '$attachment.isDeleted'}]}, true, false] }, // 3
          createdAt: 1,
          commentCount: { $size: '$comments'}
      } },
    ]).exec();
  }

  res.render('posts/index', {
    posts:posts,
    currentPage:page,
    maxPage:maxPage,
    limit:limit,
    searchType:req.query.searchType,
    searchText:req.query.searchText
  });
});

// New
router.get('/new', util.isLoggedin, function(req, res){
  var post = req.flash('post')[0] || {};
  var errors = req.flash('errors')[0] || {};
  res.render('posts/new', { post:post, errors:errors });
});

// create
router.post('/', util.isLoggedin, upload.single('attachment'), async function(req, res){ // upload.single('attachment') 미들웨어가 추가되고 마지막 callback함수 앞에 async 키워드를 추가.
  var attachment;
  try{ //  File.createNewInstance함수를 try catch로 감싸고 에러가 있는 경우 에러를 response하도록 하였다.
    attachment = req.file?await File.createNewInstance(req.file, req.user._id):undefined; //  req.file이 존재하면 createNewInstance함수를 이용해서 file 모델의 인스턴스를 생성.
  }
  catch(err){
    return res.json(err);
  }
  req.body.attachment = attachment; // 이렇게 만들어진 file 모델을 req.body.attachemnt에 담아서 post가 생성될 때 같이 저장될 수 있게 한다.
  req.body.author = req.user._id;
  Post.create(req.body, function(err, post){
    if(err){
      req.flash('post', req.body);
      req.flash('errors', util.parseError(err));
      return res.redirect('/posts/new'+res.locals.getPostQueryString());
    }
    if(attachment){ // post가 생성된 후 생성된 post의 _id를 file 모델의 postId에 담고 save함수를 이용하여 DB에 저장한다.
      attachment.postId = post._id;
      attachment.save();
    }
    res.redirect('/posts'+res.locals.getPostQueryString(false, { page:1, searchText:'' }));
  });
});

// show
router.get('/:id', function(req, res){
  var commentForm = req.flash('commentForm')[0] || { _id: null, form: {} };
  var commentError = req.flash('commentError')[0] || { _id:null, parentComment: null, errors:{} };

  Promise.all([
      // post 모델에 populate({path:'attachment',match:{isDeleted:false}})가 추가되었다. 
      // 이로써 post모델에 attachment(file 모델)가 하위 객체로 생성되는데, 
      // match:{isDeleted:false}로 인해 attachment의 isDeleted가 false인 경우에만 생성된다. 
      // 즉 isDeleted가 true인 경우에는 실제 데이터가 지워지진 않았지만 데이터를 가져오지 않음으로 지워진 것처럼 행동하게 하는 것이다.
      Post.findOne({_id:req.params.id}).populate({ path: 'author', select: 'username' }).populate({path:'attachment',match:{isDeleted:false}}),
      Comment.find({post:req.params.id}).sort('createdAt').populate({ path: 'author', select: 'username' })
    ])
    .then(([post, comments]) => {
      post.views++;
      post.save();
      var commentTrees = util.convertToTrees(comments, '_id','parentComment','childComments');
      res.render('posts/show', { post:post, commentTrees:commentTrees, commentForm:commentForm, commentError:commentError});
    })
    .catch((err) => {
      return res.json(err);
    });
});

// edit
router.get('/:id/edit', util.isLoggedin, checkPermission, function(req, res){
  var post = req.flash('post')[0];
  var errors = req.flash('errors')[0] || {};
  if(!post){
    // 게시판 - 파일첨부 기능 만들기 1 (업로드) 강의의 show route과 마찬가지로 populate을 설정하여 attachment.isDeleted가 false인 경우에만 attachment를 populate 한다.
    Post.findOne({_id:req.params.id})
      .populate({path:'attachment',match:{isDeleted:false}})
      .exec(function(err, post){
        if(err) return res.json(err);
        res.render('posts/edit', { post:post, errors:errors });
      });
  }
  else {
    post._id = req.params.id;
    res.render('posts/edit', { post:post, errors:errors });
  }
});

// update
router.put('/:id', util.isLoggedin, checkPermission, upload.single('newAttachment'), async function(req, res){ // multer를 사용한 upload.single('newAttachment') 미들웨어가 추가되었고, callback함수에 async 키워드가 추가되었다.
  var post = await Post.findOne({_id:req.params.id}).populate({path:'attachment',match:{isDeleted:false}}); // 1번과 같은 방식으로 post에 attachment를 populate함. 첨부파일 비교를 위해 기존의 post를 불러오는 과정임.
  if(post.attachment && (req.file || !req.body.attachment)){ // 수정 전의 post에 attachment가 존재했었지만, 현재 multer를 통해 req.file이 생성되었거나 form body의 attachment가 없다면 file 인스턴스의 processDelete함수를 호출한다.
    post.attachment.processDelete();
  }
  try{ //  File.createNewInstance함수를 try catch로 감싸고 에러가 있는 경우 에러를 response하도록 하였다.
    req.body.attachment = req.file?await File.createNewInstance(req.file, req.user._id, req.params.id):post.attachment; // req.file이 존재하면 file 모델의 createNewFile함수로 attachment를 만들어 넣는다.
  }
  catch(err){
    return res.json(err);
  }
  req.body.updatedAt = Date.now();
  Post.findOneAndUpdate({_id:req.params.id}, req.body, {runValidators:true}, function(err, post){
    if(err){
      req.flash('post', req.body);
      req.flash('errors', util.parseError(err));
      return res.redirect('/posts/'+req.params.id+'/edit'+res.locals.getPostQueryString());
    }
    res.redirect('/posts/'+req.params.id+res.locals.getPostQueryString());
  });
});

// destroy
router.delete('/:id', util.isLoggedin, checkPermission, function(req, res){
  Post.deleteOne({_id:req.params.id}, function(err){
    if(err) return res.json(err);
    res.redirect('/posts'+res.locals.getPostQueryString());
  });
});

module.exports = router;

// private functions
function checkPermission(req, res, next){
  Post.findOne({_id:req.params.id}, function(err, post){
    if(err) return res.json(err);
    if(post.author != req.user.id) return util.noPermission(req, res);

    next();
  });
}

async function createSearchQuery(queries){
  var searchQuery = {};
  if(queries.searchType && queries.searchText && queries.searchText.length >= 3){
    var searchTypes = queries.searchType.toLowerCase().split(',');
    var postQueries = [];
    if(searchTypes.indexOf('title')>=0){
      postQueries.push({ title: { $regex: new RegExp(queries.searchText, 'i') } });
    }
    if(searchTypes.indexOf('body')>=0){
      postQueries.push({ body: { $regex: new RegExp(queries.searchText, 'i') } });
    }
    if(searchTypes.indexOf('author!')>=0){
      var user = await User.findOne({ username: queries.searchText }).exec();
      if(user) postQueries.push({author:user._id});
    }
    else if(searchTypes.indexOf('author')>=0){
      var users = await User.find({ username: { $regex: new RegExp(queries.searchText, 'i') } }).exec();
      var userIds = [];
      for(var user of users){
        userIds.push(user._id);
      }
      if(userIds.length>0) postQueries.push({author:{$in:userIds}});
    }
    if(postQueries.length>0) searchQuery = {$or:postQueries};
    else searchQuery = null;
  }
  return searchQuery;
}
