const express = require('express');
const request = require('request');
const path = require('path');
const http = require('http');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser')
const bcrypt = require('bcrypt');

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true,}));

const serverPORT=3002;
const serverID=2;
var taskID = null;

const Pool = require('pg').Pool
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'balancer',
  password: '12345',
  port: 5432,
})

async function hardest_task_ever(num) {
      var w8 = num;
      var matrixA = new Array(w8);
      var matrixB = new Array(w8);
      var matrixC = new Array(w8);
      for (var i = 0; i < w8; i++) {
        matrixA[i] = new Array(w8);
        matrixB[i] = new Array(w8);
        matrixC[i] = new Array(w8);
      }
      for (var i = 0; i < w8; i++) {
        for (var j = 0; j < w8; j++) {
            matrixA[i][j]=Math.floor(Math.random() * 10);
            matrixB[i][j]=Math.floor(Math.random() * 10);
            matrixC[i][j]=0;
        }
      }

        for (var i = 0; i < w8; i++) {
          for (var j = 0; j < w8; j++) {
            for (var k = 0; k < w8; k++) {
              matrixC[i][j]+= matrixA[i][k]*matrixB[k][j];
            }
          }
          if(i%100==0){
            await pool.query('update queue set percentage=$1 where id=$2', [Math.ceil((i+100)*100/w8),taskID]);
            let isEnded = await pool.query('select status from queue where id=$1', [taskID]);
            isEnded=(isEnded.rows[0]['status']=='2');
            if(isEnded)
            {
              taskID=null;
              break;
            }
          }
        }
    return num;
}

function onExit(){
  if(taskID!=null)
  {
    pool.query('update queue set status=2 where id=$1', [taskID], (error, results) => {
      console.log("Exit safely from "+serverID+"!");
      taskID=null;
      process.exit();
    });
  }else{
      console.log("Exit safely from "+serverID+"!");
    process.exit();
  }
}

[`exit`, `SIGINT`, `SIGUSR1`, `SIGUSR2`, `uncaughtException`, 'SIGTERM', 'SIGQUIT', 'SIGKILL'].forEach((eventType) => {
  process.on(eventType, onExit);
})

function checkIfEnabled() {
  //console.log("Checking...");
  if(taskID==null)
  {
      pool.query('select * from queue where status=0 limit 1',  (error, results) => {
      if(results.rows.length){
          taskID = results.rows[0]['id'];
          taskAmount = results.rows[0]['num'];
           pool.query('update queue set status=1, server_id=$1 where id=$2', [serverID, taskID], (error, results) => {
              console.log("Task "+taskID+" is taken.");
              const my_result = hardest_task_ever(taskAmount);
              my_result.then(function(result) {
                console.log("Done with "+taskID+"!");
                pool.query('update queue set status=3 where id=$1', [taskID], (error, results) => {
                  taskID=null;
                });
              });
          });
      }
    });
  }
}

app.listen(serverPORT, () => {
  pool.query('update queue set status=2 where server_id=$1 and status=1', [serverID]);
  console.log(serverID+' server is listening on port '+serverPORT+'!');
  let timerId = setInterval(() => checkIfEnabled(), 5000);
  timerId;
});
