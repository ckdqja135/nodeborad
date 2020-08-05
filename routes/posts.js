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
    posts = await Post.aggregate([
      { $match: searchQuery },
      { $lookup: { // post에 file을 $lookup을 통해 post.attachment로 연결. 게시판 - 댓글 기능 만들기 4 (댓글 수 표시)강의에서 $lookup에 대해 설명했으므로 이 설명은 생략.
          from: 'users',
          localField: 'author',
          foreignField: '_id',
          as: 'author'
      } },
      { $unwind: '$author' }, // 2.
      { $sort : { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      { $lookup: {
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
      { $project: {
          title: 1,
          author: {
            username: 1,
          },
          views: 1,
          numId: 1,
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
router.post('/', util.isLoggedin, upload.single('attachment'), async function(req, res){
  var attachment;
  try{ //  File.createNewInstance함수를 try catch로 감싸고 에러가 있는 경우 에러를 response하도록 하였다.
    attachment = req.file?await File.createNewInstance(req.file, req.user._id):undefined;
  }
  catch(err){
    return res.json(err);
  }
  req.body.attachment = attachment;
  req.body.author = req.user._id;
  Post.create(req.body, function(err, post){
    if(err){
      req.flash('post', req.body);
      req.flash('errors', util.parseError(err));
      return res.redirect('/posts/new'+res.locals.getPostQueryString());
    }
    if(attachment){
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
