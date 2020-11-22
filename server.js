const express = require('express');
const request = require('request');
const path = require('path');
const http = require('http');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser')
const bcrypt = require('bcrypt');

const saltRounds = 3;
const mySecret = "super_solo322";

const app = express();

// const WebSocketServer = require('websocket')
app.use(express.static('static'));
app.use(express.urlencoded({ extended: true }));

app.set('view engine', 'ejs');
app.set('views', __dirname+'/templates');

app.use(cookieParser())


const Pool = require('pg').Pool
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'balancer',
  password: '12345',
  port: 5432,
})

var cnt1 = 0;
var cnt2 = 0;

app.get('/',(req,res)=>{
  const token = req.cookies['token'];
  if (!token) res.redirect("/login");
  jwt.verify(token, mySecret, function(err, decoded) {
    if (err) res.redirect("/login");
    res.redirect('/info');
  });
});

app.get('/info',(req,res)=>{
  const token = req.cookies['token'];
  if (!token) res.redirect("/login");
  jwt.verify(token, mySecret, function(err, decoded) {
    if (err) res.redirect("/login");
    else{
      pool.query('SELECT *, ( SELECT COUNT(*) FROM queue where status=1 and user_id=$1 ) AS count_doing FROM queue where user_id=$1 order by id DESC', [decoded['id']], (error, results) => {
        //console.log(results.rows);
        if(!results.rows) results.rows=[];
        if(decoded['role']==0)res.render('info', { header: 'header_admin' , tasks: results.rows});
        else res.render('info', { header: 'header_user' , tasks: results.rows});
        });
    }
  });
});

app.get('/all_info',(req,res)=>{
  const token = req.cookies['token'];
  if (!token) res.redirect("/login");
  jwt.verify(token, mySecret, function(err, decoded) {
    if (err) res.redirect("/login");
    else{
      if(decoded['role']==1) res.redirect('/info');
      else{
      pool.query('SELECT *, ( SELECT COUNT(*) FROM queue where status=1) AS count_doing FROM queue order by id desc',  (error, results) => {
        console.log(results.rows);
        if(!results.rows) results.rows=[];
        res.render('all_info', { header: 'header_admin' , tasks: results.rows});
        });
      }
    }
  });
});


app.get('/createtask',(req,res)=>{
  const token = req.cookies['token'];
  if (!token) res.redirect("/login");
  jwt.verify(token, mySecret, function(err, decoded) {
    if (err) res.redirect("/login");
    if(decoded['role']==1)res.render('createtask', { header: 'header_user' });
    else res.render('createtask', { header: 'header_admin' });
  });
});

app.post('/createtask',(req,res)=>{

  const token = req.cookies['token'];
  if (!token) res.send("Error");
  jwt.verify(token, mySecret, function(err, decoded) {
    if (err) res.send("Error");
   if(req.body['number']<=4000 && req.body['number']>=100){
    pool.query('insert into queue (user_id, num,status) values($1,$2,$3)', [decoded['id'], req.body['number'],0], (error, results) => {
        if(error) res.redirect('/createtask');
        else res.redirect('/info');
      });
    }else
    {
      console.log("NOT RIGHT");
      res.redirect('/createtask');
  }

    // var prt = 3001;
    // if(cnt1>cnt2)
    // {
    //   prt = 3002;
    //   cnt2 = cnt2+1;
    // }else
    // {cnt1=cnt1+1;}
    //
    // var data = JSON.stringify({
    //   number: req.body['number'],
    //   user_id: decoded['id'],
    //   task_id: 1,
    //   port: prt
    // });
    //
    // var options = {
    //   host: 'localhost',
    //   port: prt,
    //   path: '/',
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json'
    //   }
    // };
    //
    // var httpreq = http.request(options, function (response) {
    //   response.setEncoding('utf8');
    //   response.on('data', function (chunk) {
    //     console.log("body: " + chunk);
    //   });
    //   //response.on('end', function() {
    //   //res.send('ok');
    // //  })
    // });
    // httpreq.write(data);
    // httpreq.end();
    //console.log("HERE!");
  });
});

app.post('/cancel_task',(req,res)=>{
  const token = req.cookies['token'];
  if (!token) res.send("Error");
  jwt.verify(token, mySecret, function(err, decoded) {
    if (err) res.send("Error");
    pool.query('update queue set status=2 where id=$1', [req.body['task_id']], (error, results) => {});
    res.end();
  });
});

/************
SIGNUP API
************/
app.get('/signup',(req,res)=>{
  const token = req.cookies['token'];
  if (!token){
     res.sendFile(path.join(__dirname+'/static/pages/signup.html'));
  }else{
    jwt.verify(token, mySecret, function(err, decoded) {
      if (err) res.sendFile(path.join(__dirname+'/static/pages/signup.html'));
      else res.redirect('/')
    });
  }
});
const createUser = (request, response) => {
  const { uname, psw1, psw2} = request.body
  const pass_hash = bcrypt.hash(psw1, saltRounds, function (err,   hash){
    console.log(hash);
    pool.query('INSERT INTO users (email, password, role) VALUES ($1, $2, $3)', [uname, hash, 1], (error, results) => {
      try{
        if (error) {
          throw "Error while inserting"
        }
        response.redirect("/login")
      }catch (e){
        console.log(e);
        response.redirect("/signup");}
      })
  });
}
app.post('/signup', createUser)

/************
LOGIN API
************/
app.get('/login',(req,res)=>{
  const token = req.cookies['token'];
  if (!token)
  {
    res.sendFile(path.join(__dirname+'/static/pages/login.html'));
  }else{
    jwt.verify(token, mySecret, function(err, decoded) {
      if (err) res.sendFile(path.join(__dirname+'/static/pages/login.html'));
      else
      res.redirect('/');
    });
  }
});
const getUser = (request, response) => {
  const {uname, psw} = request.body
    pool.query('SELECT * FROM users WHERE email=$1', [uname], (error, results) => {
      try{
        var user_id = results.rows[0]['id'];
        var user_email = results.rows[0]['email'];
        var pass = results.rows[0]['password'];
        var role = results.rows[0]['role'];
        //console.log("ID: "+user_id);
        //console.log("ROLE: "+role);
        bcrypt.compare(psw, pass, function(err, res) {
          try{
              if (err){
                throw "Password do not match"
              }
              if (res){
                var token = jwt.sign({ id: user_id, role: role}, mySecret, { expiresIn: 86400 });// expires in 24 hours
                response.cookie('token', token);
                //console.log("TOKEN: "+token);
                response.redirect("/");
              } else {
                response.redirect('/login');
              }
          }catch(e)
          {
            console.log(e);
            response.redirect("/login");
          }
        });
        if (error) {throw "Error while finding user"}
      }catch (e){
        console.log(e);
        response.redirect("/login");}
      });
}
app.post('/login', getUser)

/************
LOGOUT API
************/
app.get('/logout',(req,res)=>{
  res.clearCookie("token");
  res.redirect("/login");
});

/************
404 API
************/
app.get('*', function(req, res){
   res.status(404).send('what???');
});


app.listen(3000, () => {
  console.log('Main server is listening on port 3000!');
});
