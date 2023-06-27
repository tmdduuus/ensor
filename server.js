const express = require('express');
const session = require('express-session');
const axios = require('axios');
const mysql = require('mysql2');
const jwt = require('jsonwebtoken');
const secretKey = '0307';
const http = require('http');

const app = express();

app.use(session({
  secret: '0307', // 세션 암호화를 위한 비밀키
  resave: false, // 세션 데이터의 저장 여부를 지정
  saveUninitialized: false, // 초기화되지 않은 세션을 저장 여부를 지정
}));

// MySQL 연결 설정
const connection = mysql.createConnection({
  host     : '127.0.0.1',
  user     : 'root',
  password : 'tmddus0307',
  database : 'ensor',
  port : '3306'
});

app.use(express.json());
app.get('/', function(req, res){
  res.send('ensor');
})
//const accessToken = 'DJgqYZGib_uTKHWafx9C7TJFWztijKGhf27vPPXNCj11GQAAAYi9Omjr';
// 로그인
app.post('/login', async (req, res) => {
    const { accessToken } = req.query;
    
    try {
      // 카카오 API를 통해 사용자 정보 요청
      const userInfo = await getKakaoUserInfo(accessToken);
  
      // 사용자 정보를 활용하여 로그인 또는 회원가입 처리
      const user = await handleLoginOrSignup(userInfo);
      console.log(user);
      //JWT 토큰 생성
      const token = jwt.sign({ userId: user.kakao_id }, secretKey, { expiresIn: '1h' });

      req.session.kakaoUserInfo = {
        // 카카오 로그인 정보
        accessToken : accessToken,
        kakao_id: user.kakao_id,
        nickname: user.nickname,
        email: user.email
      };    

      // 로그인 또는 회원가입 성공 후 응답
      res.status(200).json({ success: true, message: 'Login successful', user, token });
    } catch (error) {
      // 에러 처리
      console.error('Failed to process login:', error);
      res.status(500).json({ success: false, message: 'Failed to process login' });
    }
});

// 로그아웃
app.post('/logout', (req, res) => {
  const kakaoUserInfo = req.session.kakaoUserInfo;

  // 카카오 API를 호출하여 로그아웃 요청
  axios.post('https://kapi.kakao.com/v1/user/logout', null, {
    headers: {
      Authorization: `Bearer ${kakaoUserInfo.accessToken}`
    }
  })
    .then(() => {
      // 로그아웃 성공 처리
      delete req.session.kakaoUserInfo;
      res.status(200).json({ message: 'Logout successful' });
      console.log("로그아웃");
    })
    .catch(error => {
      // 로그아웃 실패 처리
      console.error('Logout error:', error);
      res.status(500).json({ error: 'Logout failed' });
    });
    
    // 세션에서 카카오 로그인 정보를 제거
    delete req.session.kakaoUserInfo;
    /*
    // 카카오 로그아웃 URL 생성
    const kakaoLogoutUrl = `https://kauth.kakao.com/oauth/logout?client_id=YOUR_CLIENT_ID&logout_redirect_uri=YOUR_LOGOUT_REDIRECT_URI`;

    // 클라이언트에게 로그아웃 URL 반환
    res.json({ logoutUrl: kakaoLogoutUrl }); */
    
});

// 회원탈퇴
app.post('/withdrawal', (req, res) => {
    const kakaoUserInfo = req.session.kakaoUserInfo;
    
    // 카카오 API를 호출하여 회원 탈퇴 요청
    axios.post('https://kapi.kakao.com/v1/user/unlink', null, {
      headers: {
        Authorization: `Bearer ${kakaoUserInfo.accessToken}`
      }
    })
    .then(() => {
        // 사용자 정보 삭제 쿼리 실행
        const deleteFromSavelistQuery = 'DELETE FROM savelist WHERE kakao_id = ?';
        const deleteFromUserQuery = 'DELETE FROM user WHERE kakao_id = ?';

        connection.query(deleteFromSavelistQuery, kakaoUserInfo.kakao_id, (err, result) => {
        if (err) {
          // 삭제 실패 시 에러 처리
          console.log('Failed to delete user from savelist');
        }else{
          // savelist 삭제 성공 처리
          console.log('savelist에서 user 삭제 성공');
          // user 테이블에서 사용자 정보 삭제
          connection.query(deleteFromUserQuery, kakaoUserInfo.kakao_id, (error, deleteUserResult) => {
          if (error) {
            console.error('user 테이블에서 삭제 실패');
          }
          console.log('user 테이블에서 삭제 성공');
          console.log('회원탈퇴 성공');
        });
        }
        // 회원 탈퇴 성공 후 리다이렉트 등의 처리
        res.status(200).json({ success: true, message: 'Withdrawal successful' });
        });
        delete req.session.kakaoUserInfo;
      })
      .catch(error => {
        // 회원 탈퇴 실패 처리
        res.status(500).json({ success: false, message: 'Failed to withdrawal' });
        console.error('Withdrawal error:', error);
      }); 
});

app.get('/mypage', (req, res) => {
  const kakaoUserInfo = req.session.kakaoUserInfo;
  const email = kakaoUserInfo.email;
  const nickname = kakaoUserInfo.nickname;

  res.status(200).json({ email, nickname });
})
  
// 카카오 API를 통해 사용자 정보 요청
async function getKakaoUserInfo(accessToken) {
  try {
    const response = await axios.get('https://kapi.kakao.com/v2/user/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const userInfo = response.data;
    return userInfo;
  } catch (error) {
    console.error('Failed to get user info from Kakao API:', error);
    throw error;
  }
}

// 사용자 정보를 활용하여 로그인 또는 회원가입 처리
async function handleLoginOrSignup(userInfo) {
  const { id, properties, kakao_account } = userInfo;

  return new Promise((resolve, reject) => {
    // MySQL 쿼리 실행
    connection.query('SELECT * FROM user WHERE kakao_id = ?', [id], async (error, results) => {
      if (error) {
        console.error('Failed to execute MySQL query:', error);
        reject(error);
      } else {
        let user;

        if (results.length > 0) {
          // 이미 등록된 사용자인 경우
          user = results[0];
        } else {
          // 새로운 사용자인 경우 회원가입 처리
          const newUser = {
            kakao_id: id,
            nickname: properties.nickname,
            email: kakao_account.email
          };

          connection.query('INSERT INTO user SET ?', newUser, (error, result) => {
            if (error) {
              console.error('Failed to execute MySQL query:', error);
              reject(error);
            } else {
              newUser.id = result.insertId;
              user = newUser;
            }
          });
        }

        resolve(user);
      }
    });
  });
}

// 회원탈퇴 사용자 데이터 삭제
async function WithDrawalUser(userInfo){
    const { id, properties, kakao_account } = userInfo;

    return new Promise((resolve, reject) => {
        // 사용자 정보 삭제 쿼리
    
        connection.query(`DELETE FROM user WHERE kakao_id = ?`, [id], (error, results) => {
          if (error) {
            reject(error);
          } else {
            resolve(results);
            console.log("DELETE USER KAKAO_ID : " + id);
          }
        });
      });
}

async function getKakaoAccessToken(code) {
    try {
      const response = await axios.post('https://kauth.kakao.com/oauth/token', {
        grant_type: 'authorization_code',
        client_id: 'aaaf90b2d615d0c7779ef07484845f45',
        redirect_uri: 'http://localhost:8001/auth/kakao/callback',
        code: code,
      });
  
      const { access_token } = response.data;
      return access_token;
    } catch (error) {
      console.error('Failed to get Kakao access token:', error);
      throw error;
    }
  }
  

// MySQL 연결
connection.connect((error) => {
  if (error) {
    console.error('Failed to connect to MySQL:', error);
  } else {
    // 서버 시작
    app.listen(3000, () => {
      console.log('Server is running on port 3000');
    });
  }
});

//////////////////////////////////////////////////////

// 비건 인증 정보 목록 list
app.post('/list/vegan', (req, res) => {
    // MySQL에서 정보를 조회하는 쿼리
    const query = 'SELECT * FROM inform where category = 1';
  
    connection.query(query, (error, results) => {
      if (error) {
        console.error('Information retrieval error:', error);
        res.status(500).json({ error: 'Failed to retrieve information' });
      } else {
        res.status(200).json(results);
      }
    });
});

// 친환경 인증 정보 목록 list
app.get('/list/environment', (req, res) => {
    // MySQL에서 정보를 조회하는 쿼리
    const query = 'SELECT * FROM inform where category = 2';
  
    connection.query(query, (error, results) => {
      if (error) {
        console.error('Information retrieval error:', error);
        res.status(500).json({ error: 'Failed to retrieve information' });
      } else {
        res.status(200).json(results);
      }
    });
});

//////////////////////////////////////////
/*
var Web3 = require('web3');
var web3 = new Web3();
web3.setProvider(new web3.providers.HttpProvider("http://127.0.0.1:8545"));
console.log(web3.eth.accounts[0]);
console.log(web3.eth.getBalance(web3.eth.accounts[0]));
var abi = [{"inputs":[{"internalType":"string","name":"_hash","type":"string"}],"name":"checkHash","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"name":"hashDataMap","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"string","name":"_hash","type":"string"}],"name":"saveHash","outputs":[],"stateMutability":"nonpayable","type":"function"}];
var Contract = web3.eth.contract(abi);
var hash = Contract.at("0x78B1f4cf88C2cF94CFf1Ea772648f4D7D18131B9");
console.log(hash.checkHash("10001").call());*/

// QR 코드 데이터에 해당하는 결과 조회
app.get('/censor', (req, res) => {
    const qrCodeData = req.query.qrCodeData;

    // 블록체인 결과
    //const tfresult = hash.checkHash(qrCodeData).call();
    
    // MySQL 쿼리 실행
    const query = `SELECT * FROM inform WHERE censorID = '${qrCodeData}`;
    let tfresult = false;
  
    connection.query(query, (err, results) => {
      if (err) {
        console.error('Error executing MySQL query:', err);
        res.status(500).json({ error: 'Internal Server Error' });
      } else {
        // 검색 결과 반환
        if(results.length > 0){
          tfresult = true;
        }
        res.status(200).json({tfresult, results});
      }
    });
});

// qr코드 인증 정보 저장하기 (버튼)
app.post('/save', (req, res) => {
  const qrCodeData = req.query.qrCodeData;
  const productName = req.query.productName;
  const data = new Array(5);
 
  const kakaoUserInfo = req.session.kakaoUserInfo;
  
  connection.connect((error) => {
    if (error) {
      console.error('MySQL 연결 실패:', error);
      return;
    }
    console.log('MySQL 연결 성공');
  
    // SELECT 문 실행
    connection.query(`SELECT * FROM inform WHERE censorID = '${qrCodeData}`, (error, results) => {
      if (error) {
        console.error('SELECT 문 실행 실패:', error);
        return;
      } else {
        console.log('조회된 데이터:', results);
        for (let i = 0; i < results.length; i++) {
          data[0] = results[i].censorID;
          data[1] = results[i].censorCom;
          data[2] = results[i].censorText;
          data[3] = results[i].imgUrl;
        }
      }
  
      const values = [kakaoUserInfo.kakao_id, productName, data[0], data[1], data[2], data[3]];

      // SELECT 결과를 다른 테이블에 INSERT
      const insertQuery = `INSERT INTO savelist (kakao_id, productName, censorID, censorCom, censorText, imgUrl) VALUES (?, ?, ?, ?, ?, ?)`;
      
      connection.query(insertQuery, values, (error, results) => {
        if (error) {
          console.error('INSERT 문 실행 실패:', error);
          return;
        }else {
          // 검색 결과 반환
          res.json(results);
        }
  
        console.log('INSERT 문 실행 성공');
  
      });
    });
  });

});

// 나의 인증 정보 목록
app.get('/savelist', (req, res) =>{
  const kakaoUserInfo = req.session.kakaoUserInfo;
  
  // MySQL 쿼리 실행
  const query = `SELECT * FROM savelist WHERE kakao_id = '${kakaoUserInfo.kakao_id}'`;
  
  connection.query(query, (err, results) => {
    if (err) {
      console.error('Error executing MySQL query:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    } else {
      // 검색 결과 반환
      res.json(results);
    }
  });
})
/*
app.post('/remix', (req,res)=>{
  
var Web3 = require('web3');
var web3 = new Web3();
web3.setProvider(new web3.providers.HttpProvider("http://127.0.0.1:8545"));
console.log(web3.eth.accounts[0]);
console.log(web3.eth.getBalance(web3.eth.accounts[0]));
var abi = [{"inputs":[{"internalType":"string","name":"_hash","type":"string"}],"name":"checkHash","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"name":"hashDataMap","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"string","name":"_hash","type":"string"}],"name":"saveHash","outputs":[],"stateMutability":"nonpayable","type":"function"}];
var Contract = web3.eth.contract(abi);
var hash = Contract.at("0x78B1f4cf88C2cF94CFf1Ea772648f4D7D18131B9");
console.log(hash.checkHash("10001").call());

})*/